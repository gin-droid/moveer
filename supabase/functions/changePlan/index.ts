import { adminClient, authenticate, json } from '../_shared/runtime.ts';

const validPlans = ['freemium', 'pro', 'coach'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    const planId = String(body.planId || '').trim();
    if (!validPlans.includes(planId)) return json({ error: 'Piano non valido' }, 400);

    const { data: profile, error: profileError } = await auth.client.from('profiles')
      .select('role').eq('id', auth.user.id).maybeSingle();
    if (profileError) throw profileError;
    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && planId !== 'freemium') {
      return json({
        error: 'Gli upgrade a pagamento devono essere verificati tramite checkout o store.',
        code: 'payment_verification_required',
      }, 402);
    }

    const { error: entitlementError } = await adminClient.from('user_entitlements')
      .upsert({ user_id: auth.user.id, plan: planId }, { onConflict: 'user_id' });
    if (entitlementError) throw entitlementError;
    const { error: updateError } = await adminClient.from('profiles')
      .update({ plan: planId }).eq('id', auth.user.id);
    if (updateError) throw updateError;
    return json({ plan: planId });
  } catch (error) {
    console.error('changePlan:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore cambio piano' }, 500);
  }
});