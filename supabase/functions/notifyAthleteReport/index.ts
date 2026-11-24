import { authenticate, enforceRateLimit, handle, HttpError, isUuid, json, readJson, sendBrevoEmail } from '../_shared/runtime.ts';

const sanitize = (value: unknown, maxLength = 120) => String(value || '')
  .replace(/<[^>]*>/g, '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, maxLength);

Deno.serve(handle('notifyAthleteReport', async (req) => {
  const auth = await authenticate(req);
  if (!auth) throw new HttpError(401, 'Accesso richiesto');
  const body = await readJson(req);
  const athleteId = String(body.athleteId || '').trim();
  const reportId = String(body.reportId || '').trim();
  if (!isUuid(athleteId) || !isUuid(reportId)) throw new HttpError(400, 'Identificativi non validi');

  const [
    { data: entitlement, error: entitlementError },
    { data: effectivePlan, error: planError },
    { data: report, error: reportError },
    { data: athlete, error: athleteError },
  ] = await Promise.all([
    auth.client.from('user_entitlements').select('plan, blocked').eq('user_id', auth.user.id).maybeSingle(),
    auth.client.rpc('get_effective_entitlement_plan'),
    auth.client.from('analysis_reports').select('athlete_id, exercise_name, score').eq('id', reportId).maybeSingle(),
    auth.client.from('athletes').select('name, email').eq('id', athleteId).maybeSingle(),
  ]);
  if (entitlementError || planError || reportError || athleteError) {
    throw entitlementError || planError || reportError || athleteError;
  }
  if (entitlement?.blocked) return json({ error: 'Account bloccato' }, 403);
  if (!['pro', 'coach'].includes(effectivePlan || 'freemium')) {
    return json({ skipped: true, reason: 'plan_not_allowed' }, 403);
  }
  if (!report || report.athlete_id !== athleteId || !athlete) return json({ skipped: true, reason: 'report_or_athlete_not_found' }, 404);
  if (!athlete.email) return json({ skipped: true, reason: 'no_email' });
  await enforceRateLimit(`notifyAthleteReport:report:${reportId}`, 1, 30 * 24 * 60 * 60);
  await enforceRateLimit(`notifyAthleteReport:coach:${auth.user.id}`, 30, 60 * 60);

  const athleteName = sanitize(athlete.name || 'atleta', 60);
  const exerciseName = sanitize(report.exercise_name || 'esercizio');
  const score = Number.isFinite(Number(report.score)) ? `${report.score}/100` : 'valutato';
  await sendBrevoEmail(
    athlete.email,
    'Il tuo report di analisi è pronto',
    `Ciao ${athleteName},\n\nIl report per "${exerciseName}" è pronto.\nPunteggio di esecuzione: ${score}.\n\nIl tuo coach ti condividerà i dettagli e le correzioni consigliate.\n\n— moVeerAI`,
  );
  return json({ sent: true });
}));