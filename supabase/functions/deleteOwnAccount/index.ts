import { adminClient, authenticate, json } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);
  const { error } = await adminClient.auth.admin.deleteUser(auth.user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});