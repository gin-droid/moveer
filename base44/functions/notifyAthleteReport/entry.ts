import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getOrCreateEntitlement } from '../../shared/entitlements.ts';

// Strip HTML tags and control characters, cap length — defense in depth for
// values interpolated into the email body.
function sanitize(value: string, maxLen = 120): string {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t<>]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Server-side plan check (trusted source: UserEntitlement entity)
    const entitlement = await getOrCreateEntitlement(base44, user.id);
    if (entitlement.blocked) {
      return Response.json({ error: 'Account bloccato' }, { status: 403 });
    }
    const plan = entitlement.plan || 'freemium';
    if (plan !== 'pro' && plan !== 'coach') {
      return Response.json({ skipped: true, reason: 'plan_not_allowed' }, { status: 403 });
    }

    const body = await req.json();
    const athleteId = (body.athleteId || '').trim();
    const reportId = (body.reportId || '').trim();

    if (!athleteId || !reportId) {
      return Response.json({ error: 'athleteId e reportId sono obbligatori' }, { status: 400 });
    }

    // Fetch the report from the DB to use trusted values (exercise_name, score)
    // instead of caller-supplied data that could contain injected content.
    const report = await base44.entities.AnalysisReport.get(reportId);
    if (!report) {
      return Response.json({ skipped: true, reason: 'report_not_found' });
    }

    // Recupera l'atleta (user-scoped: RLS permette la lettura solo al proprietario o admin)
    const athlete = await base44.entities.Athlete.get(athleteId);
    if (!athlete) {
      return Response.json({ skipped: true, reason: 'athlete_not_found' });
    }
    if (!athlete.email) {
      return Response.json({ skipped: true, reason: 'no_email' });
    }

    // Use trusted DB values, sanitized as defense in depth
    const exerciseName = sanitize(report.exercise_name || 'esercizio');
    const athleteName = sanitize(athlete.name || 'atleta', 60);
    const score = report.score;
    const scoreText = (typeof score === 'number') ? `${score}/100` : 'valutato';
    const emailBody = [
      `Ciao ${athleteName},`,
      ``,
      `Il tuo report di analisi per l'esercizio "${exerciseName}" è pronto.`,
      `Punteggio di esecuzione: ${scoreText}.`,
      ``,
      `Il tuo coach ti condividerà i dettagli, le correzioni e gli esercizi correttivi consigliati.`,
      ``,
      `— moVeerAI`,
    ].join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: athlete.email,
      subject: 'Il tuo report di analisi è pronto',
      body: emailBody,
    });

    return Response.json({ sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}