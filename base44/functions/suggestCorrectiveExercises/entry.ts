import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getOrCreateEntitlement } from '../../shared/entitlements.ts';

const CORRECTIVE_CATEGORIES = ['Riabilitazione', 'Mobilità', 'Posturali', 'Corpo Libero', 'Funzionale'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Server-side plan check (trusted source: UserEntitlement entity, not client-writable user.plan)
    const entitlement = await getOrCreateEntitlement(base44, user.id);
    if (entitlement.blocked) {
      return Response.json({ error: 'Account bloccato' }, { status: 403 });
    }
    const plan = entitlement.plan || 'freemium';
    if (plan !== 'pro' && plan !== 'coach') {
      return Response.json({ error: 'Funzionalità disponibile solo per i piani Pro e Coach' }, { status: 403 });
    }

    const body = await req.json();
    const reportId = (body.reportId || '').trim();
    if (!reportId) return Response.json({ error: 'reportId obbligatorio' }, { status: 400 });

    const report = await base44.entities.AnalysisReport.get(reportId);
    if (!report) return Response.json({ error: 'Report non trovato' }, { status: 404 });

    const issues = report.issues_detected || [];
    if (issues.length === 0) {
      return Response.json({ suggestions: [], reason: 'no_issues' });
    }

    // Carica esercizi candidati dalle categorie correttive / riabilitative
    const allExercises = await base44.entities.Exercise.list("-created_date", 1000);
    const candidates = allExercises
      .filter((e) => CORRECTIVE_CATEGORIES.includes(e.macro_category))
      .slice(0, 150)
      .map((e) => ({
        id: e.id,
        name: e.name,
        macro_category: e.macro_category,
        muscle_groups: (e.muscle_groups || []).join(', '),
        description: (e.description || '').slice(0, 180),
      }));

    if (candidates.length === 0) {
      return Response.json({ suggestions: [], reason: 'no_candidates' });
    }

    const issuesText = issues
      .map((iss, i) => `${i + 1}. [${iss.severity || 'Lievo'}] ${iss.title}: ${iss.description || ''}`)
      .join('\n');

    const candidatesText = candidates
      .map((e) => `${e.id} | ${e.name} | ${e.macro_category} | ${e.muscle_groups} | ${e.description}`)
      .join('\n');

    const prompt = [
      `Sei un esperto di biomeccanica e riabilitazione sportiva.`,
      `Analizza i seguenti difetti di postura rilevati in un report biomeccanico per l'esercizio "${report.exercise_name}" (macro-categoria: ${report.macro_category || 'generale'}):`,
      ``,
      `DIFETTI RILEVATI:`,
      issuesText,
      ``,
      `Seleziona dal catalogo seguente fino a 5 esercizi che meglio correggono questi difetti.`,
      `Per ogni esercizio indica: quale difetto targetizza (target_issue), perché aiuta (why) e una proposta di serie/ripetizioni (sets_reps).`,
      `Scegli solo esercizi realmente pertinenti ai difetti; se nessun esercizio è chiaramente pertinente, restituisci un array vuoto.`,
      `Usa ESATTAMENTE gli exercise_id forniti nel catalogo.`,
      ``,
      `CATALOGO (id | nome | macro-categoria | gruppi muscolari | descrizione):`,
      candidatesText,
    ].join('\n');

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                exercise_id: { type: "string" },
                exercise_name: { type: "string" },
                target_issue: { type: "string" },
                why: { type: "string" },
                sets_reps: { type: "string" },
              },
              required: ["exercise_id", "exercise_name", "target_issue", "why"],
            },
          },
        },
        required: ["suggestions"],
      },
    });

    // Filtra solo suggerimenti con exercise_id validi (presenti nel catalogo)
    const validIds = new Set(candidates.map((c) => c.id));
    const suggestions = (llmRes.suggestions || []).filter((s) => validIds.has(s.exercise_id));

    return Response.json({ suggestions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}