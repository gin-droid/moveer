import { authenticate, generateGeminiText, json, parseGeminiJson } from '../_shared/runtime.ts';

const correctiveCategories = ['Riabilitazione', 'Mobilità', 'Posturali', 'Corpo Libero', 'Funzionale'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    const reportId = String(body.reportId || '').trim();
    if (!reportId) return json({ error: 'reportId obbligatorio' }, 400);

    const [{ data: entitlement, error: entitlementError }, { data: report, error: reportError }] = await Promise.all([
      auth.client.from('user_entitlements').select('plan, blocked').eq('user_id', auth.user.id).maybeSingle(),
      auth.client.from('analysis_reports').select('id, exercise_name, macro_category, issues_detected, corrections, corrective_exercises')
        .eq('id', reportId).maybeSingle(),
    ]);
    if (entitlementError) throw entitlementError;
    if (reportError) throw reportError;
    if (entitlement?.blocked) return json({ error: 'Account bloccato' }, 403);
    if (!['pro', 'coach'].includes(entitlement?.plan || 'freemium')) {
      return json({ error: 'Funzionalità disponibile solo per i piani Pro e Coach' }, 403);
    }
    if (!report) return json({ error: 'Report non trovato' }, 404);

    const issues = Array.isArray(report.issues_detected) ? report.issues_detected : [];
    if (!issues.length) return json({ suggestions: [], reason: 'no_issues' });

    const { data: exercises, error: exerciseError } = await auth.client.from('exercises')
      .select('id, name, macro_category, subcategory, muscle_groups, description')
      .in('macro_category', correctiveCategories).order('created_at', { ascending: false });
    if (exerciseError) throw exerciseError;
    if (!exercises?.length) return json({ suggestions: [], reason: 'no_candidates' });

    const corrections = Array.isArray(report.corrections) ? report.corrections : [];
    const reportExercises = Array.isArray(report.corrective_exercises) ? report.corrective_exercises : [];
    const prompt = `Sei un esperto di biomeccanica e riabilitazione sportiva. Collega i difetti del report a esercizi correttivi realmente presenti nel catalogo.
ESERCIZIO ANALIZZATO: ${report.exercise_name} (${report.macro_category || 'generale'})
DIFETTI RILEVATI: ${JSON.stringify(issues)}
CORREZIONI TECNICHE DEL REPORT: ${JSON.stringify(corrections)}
ESERCIZI GIÀ INDICATI DAL REPORT: ${JSON.stringify(reportExercises)}
CATALOGO CORRETTIVO COMPLETO (id, nome, categoria, sottocategoria, muscoli e descrizione): ${JSON.stringify(exercises)}
Seleziona fino a 5 esercizi pertinenti ai difetti e alle correzioni, considerando gruppi muscolari e descrizione. Usa esclusivamente gli exercise_id presenti nel catalogo; non inventare o modificare gli ID. Per ogni elemento restituisci exercise_id, target_issue, why e sets_reps. Se nessun esercizio del catalogo è pertinente, restituisci suggestions vuoto.`;
    const responseSchema = {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            properties: {
              exercise_id: { type: 'string', enum: exercises.map((exercise) => exercise.id) },
              target_issue: { type: 'string' },
              why: { type: 'string' },
              sets_reps: { type: 'string' },
            },
            required: ['exercise_id', 'target_issue', 'why', 'sets_reps'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    };
    const result = parseGeminiJson(await generateGeminiText(
      [{ role: 'user', parts: [{ text: prompt }] }],
      undefined,
      true,
      responseSchema,
    ));
    const validExercises = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    type CorrectiveSuggestion = {
      exercise_id: string;
      target_issue?: unknown;
      why?: unknown;
      sets_reps?: unknown;
    };
    const candidates: unknown[] = Array.isArray(result.suggestions) ? result.suggestions : [];
    const suggestions = candidates
      .filter((item): item is CorrectiveSuggestion =>
        typeof item === 'object' && item !== null && !Array.isArray(item) &&
        'exercise_id' in item && typeof item.exercise_id === 'string'
      )
      .filter((item) => validExercises.has(item.exercise_id))
      .slice(0, 5)
      .flatMap((item) => {
        const exercise = validExercises.get(item.exercise_id);
        if (!exercise) return [];
        return [{
          exercise_id: item.exercise_id,
          exercise_name: exercise.name,
          target_issue: String(item.target_issue || '').slice(0, 300),
          why: String(item.why || '').slice(0, 500),
          sets_reps: String(item.sets_reps || '').slice(0, 80),
        }];
      });

    return json({ suggestions });
  } catch (error) {
    console.error('suggestCorrectiveExercises:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore nei suggerimenti' }, 500);
  }
});