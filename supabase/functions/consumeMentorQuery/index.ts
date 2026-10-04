import { authenticate, consumeQuota, json } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);
  try {
    const quota = await consumeQuota(auth.client, 'mentor');
    if (quota.blocked) return json({ error: 'Account bloccato', blocked: true }, 403);
    if (!quota.allowed) return json({ allowed: false, used: quota.used, limit: quota.limit, plan: quota.plan }, 429);
    return json({ allowed: true, used: quota.used, limit: quota.limit, plan: quota.plan });
  } catch (error) {
    console.error('consumeMentorQuery:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore quota mentore' }, 500);
  }
});