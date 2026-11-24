import { deleteUserStorage } from '../_shared/accounts.ts';
import {
  adminClient,
  authenticate,
  enforceRateLimit,
  handle,
  HttpError,
  isUuid,
  json,
  readJson,
  requireAdmin,
} from '../_shared/runtime.ts';

const validPlans = new Set(['freemium', 'pro', 'coach']);
const userPageSize = 1000;

async function listAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: userPageSize });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < userPageSize) break;
  }
  return users;
}

async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const escapedEmail = normalizedEmail.replace(/[\\%_]/g, '\\$&');
  const { data: profile, error } = await adminClient.from('profiles')
    .select('id').ilike('email', escapedEmail).limit(1).maybeSingle();
  if (error) throw error;
  if (profile) {
    const { data } = await adminClient.auth.admin.getUserById(profile.id);
    if (data.user) return data.user;
  }
  const users = await listAuthUsers();
  return users.find((user) => user.email?.toLowerCase() === normalizedEmail) || null;
}

async function getManagedUser(userId: string, adminId: string) {
  if (!isUuid(userId)) throw new HttpError(400, 'Identificativo utente non valido');
  if (userId === adminId) throw new HttpError(403, 'Non puoi modificare il tuo account da questa pagina');

  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error || !data.user) throw new HttpError(404, 'Utente non trovato');

  const { data: profile, error: profileError } = await adminClient.from('profiles')
    .select('role').eq('id', userId).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role === 'admin') throw new HttpError(403, 'Gli account amministratore non possono essere modificati da questa pagina');
  return data.user;
}

Deno.serve(handle('adminManageUsers', async (req) => {
    const auth = await authenticate(req);
    if (!auth) throw new HttpError(401, 'Accesso richiesto');
    await requireAdmin(auth);
    await enforceRateLimit(`adminManageUsers:${auth.user.id}`, 120, 60);

    const body = await readJson(req);
    const action = String(body.action || '').trim();

    if (action === 'list') {
      const authUsers = await listAuthUsers();
      const ids = authUsers.map((user) => user.id);
      if (!ids.length) return json({ users: [] });

      const [{ data: profiles, error: profilesError }, { data: entitlements, error: entitlementsError }] = await Promise.all([
        adminClient.from('profiles').select('id, email, role, plan').in('id', ids),
        adminClient.from('user_entitlements').select('user_id, plan, blocked').in('user_id', ids),
      ]);
      if (profilesError) throw profilesError;
      if (entitlementsError) throw entitlementsError;

      const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
      const entitlementByUserId = new Map((entitlements || []).map((item) => [item.user_id, item]));
      return json({
        users: authUsers.map((user) => ({
          id: user.id,
          email: user.email || '',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          banned_until: user.banned_until || null,
          ...(profileById.get(user.id) || {}),
          entitlement: entitlementByUserId.get(user.id) || null,
        })),
      });
    }

    if (action === 'set-plan') {
      const email = String(body.email || '').trim();
      const plan = String(body.plan || '').trim();
      if (!email) return json({ error: 'Inserisci un indirizzo email' }, 400);
      if (!validPlans.has(plan)) return json({ error: 'Piano non valido' }, 400);

      const user = await findAuthUserByEmail(email);
      if (!user) return json({ error: 'Nessun account registrato con questa email' }, 404);
      await getManagedUser(user.id, auth.user.id);

      const { error: entitlementError } = await adminClient.from('user_entitlements')
        .upsert({
          user_id: user.id,
          plan,
          billing_provider: plan === 'freemium' ? null : 'admin',
          store_product_id: null,
          subscription_expires_at: null,
        }, { onConflict: 'user_id' });
      if (entitlementError) throw entitlementError;
      const { error: profileError } = await adminClient.from('profiles')
        .update({ plan }).eq('id', user.id);
      if (profileError) throw profileError;
      return json({ id: user.id, email: user.email, plan });
    }

    if (action === 'set-status') {
      const userId = String(body.userId || '').trim();
      const status = String(body.status || '').trim();
      if (!['active', 'blocked', 'suspended'].includes(status)) {
        return json({ error: 'Stato utente non valido' }, 400);
      }
      const managedUser = await getManagedUser(userId, auth.user.id);
      const previousBanUntil = managedUser.banned_until ? new Date(managedUser.banned_until).getTime() : 0;
      const previousBanDuration = previousBanUntil > Date.now()
        ? `${Math.max(1, Math.ceil((previousBanUntil - Date.now()) / 3600000))}h`
        : 'none';

      const banDuration = status === 'suspended' ? '876000h' : 'none';
      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
      });
      if (authError) throw authError;

      const { error: entitlementError } = await adminClient.from('user_entitlements')
        .upsert({ user_id: userId, blocked: status !== 'active' }, { onConflict: 'user_id' });
      if (entitlementError) {
        await adminClient.auth.admin.updateUserById(userId, { ban_duration: previousBanDuration });
        throw entitlementError;
      }
      if (status !== 'active') {
        const { error: sessionsError } = await adminClient.rpc('revoke_user_sessions', { p_user_id: userId });
        if (sessionsError) throw sessionsError;
      }
      return json({ id: userId, status });
    }

    if (action === 'delete') {
      const userId = String(body.userId || '').trim();
      await getManagedUser(userId, auth.user.id);
      await deleteUserStorage(userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ id: userId, ok: true });
    }

    return json({ error: 'Operazione non valida' }, 400);
}));