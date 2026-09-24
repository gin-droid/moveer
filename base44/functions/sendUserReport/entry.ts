import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();
    const category = (body.category || 'segnalazione').trim();

    if (!subject || !message) {
      return Response.json({ error: 'Oggetto e messaggio sono obbligatori' }, { status: 400 });
    }

    // Trova gli amministratori registrati per inviare la segnalazione
    const allUsers = await base44.asServiceRole.entities.User.list("-created_date", 200);
    const admins = allUsers.filter((u) => u.role === 'admin' && u.email);
    if (admins.length === 0) {
      return Response.json({ error: 'Nessun amministratore trovato' }, { status: 500 });
    }

    const userEmail = user.email || 'sconosciuto';
    const userName = user.full_name || userEmail;
    const emailBody = [
      `Nuova segnalazione da moVeerAI`,
      ``,
      `Utente: ${userName}`,
      `Email: ${userEmail}`,
      `Categoria: ${category}`,
      ``,
      `--- Messaggio ---`,
      ``,
      message,
    ].join('\n');

    // Invia a tutti gli amministratori registrati
    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `[moVeerAI] ${category}: ${subject}`,
        body: emailBody,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}