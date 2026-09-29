import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // Sanitize: strip control chars and newlines to prevent header injection
    const sanitize = (s: string, maxLen = 500) => String(s || '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, maxLen);
    const subject = sanitize(body.subject || '', 200);
    const message = String(body.message || '').trim().slice(0, 5000);
    const category = sanitize(body.category || 'segnalazione', 100);

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
      // Use plain-text body (text) instead of HTML (body) so user-controlled
      // content is never rendered as markup by the admin's mail client.
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `[moVeerAI] ${category}: ${subject}`,
        text: emailBody,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}