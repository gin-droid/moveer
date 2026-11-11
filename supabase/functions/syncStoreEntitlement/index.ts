import { authenticate, enforceRateLimit, handle, HttpError, json, readJson } from '../_shared/runtime.ts';
import { syncStoreEntitlement } from '../_shared/storeBilling.ts';

Deno.serve(handle('syncStoreEntitlement', async (req) => {
  await readJson(req);
  const auth = await authenticate(req);
  if (!auth) throw new HttpError(401, 'Accesso richiesto');
  await enforceRateLimit(`syncStoreEntitlement:${auth.user.id}`, 20, 60 * 60);

  return json(await syncStoreEntitlement(auth.user.id));
}));