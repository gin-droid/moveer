import { adminClient, authenticate, json } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    const { data: profile, error: profileError } = await auth.client.from('profiles')
      .select('role').eq('id', auth.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== 'admin') return json({ error: 'Permessi amministratore richiesti' }, 403);

    const body = await req.json();
    const userId = String(body.userId || '').trim();
    if (!userId) return json({ error: 'userId obbligatorio' }, 400);
    if (userId === auth.user.id) return json({ error: 'Non puoi eliminare il tuo account da questa pagina' }, 400);
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;
    return json({ id: userId, ok: true });
  } catch (error) {
    console.error('adminDeleteUser:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore eliminazione utente' }, 500);
  }
});