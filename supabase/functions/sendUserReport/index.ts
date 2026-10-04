import { adminClient, authenticate, json, sendBrevoEmail } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    const cleanHeader = (value: unknown, maxLength: number) => String(value || '')
      .replace(/[\r\n\t<>]/g, ' ').trim().slice(0, maxLength);
    const subject = cleanHeader(body.subject, 200);
    const category = cleanHeader(body.category || 'segnalazione', 100);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!subject || !message) return json({ error: 'Oggetto e messaggio sono obbligatori' }, 400);

    const { data: admins, error } = await adminClient.from('profiles')
      .select('email').eq('role', 'admin').not('email', 'is', null).limit(50);
    if (error) throw error;
    const recipients = (admins || []).map((admin) => admin.email).filter(Boolean);
    if (!recipients.length) return json({ error: 'Nessun amministratore configurato' }, 500);

    const userName = String(auth.user.user_metadata?.full_name || auth.user.email || 'utente').slice(0, 120);
    const text = [
      'Nuova segnalazione da moVeerAI',
      '',
      `Utente: ${userName}`,
      `Email: ${auth.user.email || 'sconosciuta'}`,
      `Categoria: ${category}`,
      '',
      '--- Messaggio ---',
      '',
      message,
    ].join('\n');
    await sendBrevoEmail(recipients, `[moVeerAI] ${category}: ${subject}`, text);
    return json({ ok: true });
  } catch (error) {
    console.error('sendUserReport:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore invio segnalazione' }, 500);
  }
});