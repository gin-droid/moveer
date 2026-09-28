import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Solo i piani a pagamento (Pro / Coach) possono inviare notifiche agli atleti
    const paidPlans = ['pro', 'coach'];
    if (!paidPlans.includes(user.plan)) {
      return Response.json({ skipped: true, reason: 'plan_not_allowed' }, { status: 403 });
    }

    const body = await req.json();
    const athleteId = (body.athleteId || '').trim();
    const reportId = (body.reportId || '').trim();
    const exerciseName = (body.exerciseName || 'esercizio').trim();
    const score = body.score;

    if (!athleteId || !reportId) {
      return Response.json({ error: 'athleteId e reportId sono obbligatori' }, { status: 400 });
    }

    // Recupera l'atleta (user-scoped: RLS permette la lettura solo al proprietario o admin)
    const athlete = await base44.entities.Athlete.get(athleteId);
    if (!athlete) {
      return Response.json({ skipped: true, reason: 'athlete_not_found' });
    }
    if (!athlete.email) {
      return Response.json({ skipped: true, reason: 'no_email' });
    }

    const scoreText = (typeof score === 'number') ? `${score}/100` : 'valutato';
    const emailBody = [
      `Ciao ${athlete.name},`,
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