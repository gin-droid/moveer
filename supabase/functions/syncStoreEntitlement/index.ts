import { authenticate, json } from '../_shared/runtime.ts';
import { syncStoreEntitlement } from '../_shared/storeBilling.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Metodo non supportato' }, 405);

  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    return json(await syncStoreEntitlement(auth.user.id));
  } catch (error) {
    console.error('syncStoreEntitlement:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore sincronizzazione acquisto' }, 500);
  }
});