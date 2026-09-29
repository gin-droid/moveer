import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const CONTACT_EMAIL = "gianlusis91@gmail.com";

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const name = (body.name || '').trim().slice(0, 100);
    const email = (body.email || '').trim().slice(0, 200);
    const subject = (body.subject || '').trim().slice(0, 200);
    const message = (body.message || '').trim().slice(0, 5000);

    if (!name || !email || !subject || !message) {
      return Response.json({ error: 'Tutti i campi sono obbligatori' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Email non valida' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const emailText = [
      `Nuova segnalazione dal form contatti di moVeerAI`,
      ``,
      `Nome: ${name}`,
      `Email: ${email}`,
      `Oggetto: ${subject}`,
      ``,
      `--- Messaggio ---`,
      ``,
      message,
    ].join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: CONTACT_EMAIL,
      subject: `[moVeerAI Contatti] ${subject}`,
      text: emailText,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}