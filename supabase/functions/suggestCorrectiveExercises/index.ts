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
      auth.client.from('analysis_reports').select('id, exercise_name, macro_category, issues_detected')
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
      .select('id, name, macro_category, muscle_groups, description')
      .in('macro_category', correctiveCategories).order('created_at', { ascending: false }).limit(150);
    if (exerciseError) throw exerciseError;
    if (!exercises?.length) return json({ suggestions: [], reason: 'no_candidates' });

    const prompt = `Per l'esercizio "${report.exercise_name}" (${report.macro_category || 'generale'}), seleziona al massimo 5 esercizi del catalogo che correggano i difetti elencati. Restituisci JSON {"suggestions":[{"exercise_id":"id esatto","exercise_name":"nome","target_issue":"difetto","why":"motivazione","sets_reps":"serie e ripetizioni"}]}. Se nessun esercizio è pertinente, restituisci un array vuoto.
DIFETTI: ${JSON.stringify(issues)}
CATALOGO: ${JSON.stringify(exercises)}`;
    const result = parseGeminiJson(await generateGeminiText([{ role: 'user', parts: [{ text: prompt }] }]));
    const validExercises = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const suggestions = (Array.isArray(result.suggestions) ? result.suggestions : [])
      .filter((item) => validExercises.has(item.exercise_id))
      .slice(0, 5)
      .map((item) => ({
        exercise_id: item.exercise_id,
        exercise_name: validExercises.get(item.exercise_id).name,
        target_issue: String(item.target_issue || '').slice(0, 300),
        why: String(item.why || '').slice(0, 500),
        sets_reps: String(item.sets_reps || '').slice(0, 80),
      }));

    return json({ suggestions });
  } catch (error) {
    console.error('suggestCorrectiveExercises:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore nei suggerimenti' }, 500);
  }
});