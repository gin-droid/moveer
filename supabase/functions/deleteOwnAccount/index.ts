import { deleteUserStorage } from '../_shared/accounts.ts';
import { adminClient, authenticate, enforceRateLimit, handle, HttpError, json, readJson } from '../_shared/runtime.ts';

Deno.serve(handle('deleteOwnAccount', async (req) => {
  await readJson(req);
  const auth = await authenticate(req);
  if (!auth) throw new HttpError(401, 'Accesso richiesto');
  await enforceRateLimit(`deleteOwnAccount:${auth.user.id}`, 3, 60 * 60);
  await deleteUserStorage(auth.user.id);
  const { error } = await adminClient.auth.admin.deleteUser(auth.user.id);
  if (error) throw error;
  return json({ ok: true });
}));