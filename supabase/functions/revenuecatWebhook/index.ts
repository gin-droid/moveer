import { handle, HttpError, isUuid, json, readJson } from '../_shared/runtime.ts';
import { syncStoreEntitlement } from '../_shared/storeBilling.ts';

async function isAuthorized(header: string | null, secret: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const expected = await digest(`Bearer ${secret}`);
  const received = await digest(header || '');
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ received[index];
  return difference === 0;
}

Deno.serve(handle('revenuecatWebhook', async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret || secret.length < 32 || !await isAuthorized(req.headers.get('Authorization'), secret)) {
    throw new HttpError(401, 'Richiesta non autorizzata');
  }

    const payload = await readJson(req, 256 * 1024);
    const event = payload.event && typeof payload.event === 'object' && !Array.isArray(payload.event)
      ? payload.event as Record<string, unknown>
      : null;
    if (!event || event.type === 'TEST') return json({ received: true });

    const userId = String(event.app_user_id || '');
    if (!isUuid(userId)) {
      return json({ received: true, ignored: true });
    }

    await syncStoreEntitlement(userId);
    return json({ received: true });
}, { cors: false }));