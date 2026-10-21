import { json } from '../_shared/runtime.ts';
import { syncStoreEntitlement } from '../_shared/storeBilling.ts';

function isAuthorized(header: string | null, secret: string) {
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  const received = new TextEncoder().encode(header || '');
  if (expected.length !== received.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ received[index];
  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Metodo non supportato' }, 405);

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret || !isAuthorized(req.headers.get('Authorization'), secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await req.json();
    const event = payload?.event;
    if (!event || event.type === 'TEST') return json({ received: true });

    const userId = String(event.app_user_id || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ received: true, ignored: true });
    }

    await syncStoreEntitlement(userId);
    return json({ received: true });
  } catch (error) {
    console.error('revenuecatWebhook:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore webhook store' }, 500);
  }
});