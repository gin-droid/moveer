import { authenticate, json, sendBrevoEmail } from '../_shared/runtime.ts';

const sanitize = (value: unknown, maxLength = 120) => String(value || '')
  .replace(/<[^>]*>/g, '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, maxLength);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    const athleteId = String(body.athleteId || '').trim();
    const reportId = String(body.reportId || '').trim();
    if (!athleteId || !reportId) return json({ error: 'athleteId e reportId sono obbligatori' }, 400);

    const [{ data: entitlement, error: entitlementError }, { data: report, error: reportError }, { data: athlete, error: athleteError }] = await Promise.all([
      auth.client.from('user_entitlements').select('plan, blocked').eq('user_id', auth.user.id).maybeSingle(),
      auth.client.from('analysis_reports').select('athlete_id, exercise_name, score').eq('id', reportId).maybeSingle(),
      auth.client.from('athletes').select('name, email').eq('id', athleteId).maybeSingle(),
    ]);
    if (entitlementError || reportError || athleteError) throw entitlementError || reportError || athleteError;
    if (entitlement?.blocked) return json({ error: 'Account bloccato' }, 403);
    if (!['pro', 'coach'].includes(entitlement?.plan || 'freemium')) {
      return json({ skipped: true, reason: 'plan_not_allowed' }, 403);
    }
    if (!report || report.athlete_id !== athleteId || !athlete) return json({ skipped: true, reason: 'report_or_athlete_not_found' }, 404);
    if (!athlete.email) return json({ skipped: true, reason: 'no_email' });

    const athleteName = sanitize(athlete.name || 'atleta', 60);
    const exerciseName = sanitize(report.exercise_name || 'esercizio');
    const score = Number.isFinite(Number(report.score)) ? `${report.score}/100` : 'valutato';
    await sendBrevoEmail(
      athlete.email,
      'Il tuo report di analisi è pronto',
      `Ciao ${athleteName},\n\nIl report per "${exerciseName}" è pronto.\nPunteggio di esecuzione: ${score}.\n\nIl tuo coach ti condividerà i dettagli e le correzioni consigliate.\n\n— moVeerAI`,
    );
    return json({ sent: true });
  } catch (error) {
    console.error('notifyAthleteReport:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore invio notifica' }, 500);
  }
});