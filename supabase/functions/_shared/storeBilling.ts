import { adminClient, fetchWithTimeout } from './runtime.ts';

type RevenueCatEntitlement = {
  expires_date?: string | null;
  product_identifier?: string | null;
};

type RevenueCatSubscription = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  store?: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
};

function providerForStore(store?: string | null) {
  if (store === 'APP_STORE' || store === 'app_store') return 'apple';
  if (store === 'PLAY_STORE' || store === 'play_store') return 'google_play';
  return null;
}

export async function refreshCachedEntitlement(userId: string) {
  const { data: current, error: currentError } = await adminClient.from('user_entitlements')
    .select('billing_provider,plan').eq('user_id', userId).maybeSingle();
  if (currentError) throw currentError;
  if (current?.billing_provider === 'admin') {
    return { plan: current.plan, billingProvider: 'admin' };
  }

  const { data: storeEntitlements, error: storeError } = await adminClient.from('user_store_entitlements')
    .select('provider,plan,product_id,expires_at').eq('user_id', userId);
  if (storeError) throw storeError;

  const now = Date.now();
  const active = (storeEntitlements || [])
    .filter((entitlement) =>
      (entitlement.plan === 'coach' || entitlement.plan === 'pro') &&
      (!entitlement.expires_at || Date.parse(entitlement.expires_at) > now)
    )
    .sort((a, b) => {
      const planDifference = Number(b.plan === 'coach') - Number(a.plan === 'coach');
      if (planDifference) return planDifference;
      const aExpiration = a.expires_at ? Date.parse(a.expires_at) : Number.POSITIVE_INFINITY;
      const bExpiration = b.expires_at ? Date.parse(b.expires_at) : Number.POSITIVE_INFINITY;
      return bExpiration - aExpiration;
    });
  const selected = active[0];
  const providers = new Set(active.filter((item) => item.plan === selected?.plan).map((item) => item.provider));
  const plan = selected?.plan || 'freemium';
  const billingProvider = providers.size > 1 ? 'multiple' : selected?.provider || null;
  const values = {
    plan,
    billing_provider: billingProvider,
    store_product_id: selected?.product_id || null,
    subscription_expires_at: selected?.expires_at || null,
  };

  const { error: entitlementError } = await adminClient.from('user_entitlements')
    .upsert({ user_id: userId, ...values }, { onConflict: 'user_id' });
  if (entitlementError) throw entitlementError;
  const { error: profileError } = await adminClient.from('profiles').update({ plan }).eq('id', userId);
  if (profileError) throw profileError;

  return { plan, billingProvider };
}

export async function syncStoreEntitlement(userId: string) {
  const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!apiKey) throw new Error('REVENUECAT_SECRET_API_KEY non configurata nei secrets Supabase');

  const response = await fetchWithTimeout(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, 30_000);
  const result = await response.json().catch(() => ({})) as RevenueCatSubscriberResponse & { message?: string };
  if (!response.ok || !result.subscriber) {
    throw new Error(result.message || `RevenueCat API HTTP ${response.status}`);
  }

  const now = Date.now();
  const activeEntitlements = Object.entries(result.subscriber.entitlements || {})
    .map(([identifier, entitlement]) => {
      const subscription = entitlement.product_identifier
        ? result.subscriber?.subscriptions?.[entitlement.product_identifier]
        : undefined;
      const gracePeriodEnd = subscription?.grace_period_expires_date;
      const effectiveExpiration = gracePeriodEnd && Date.parse(gracePeriodEnd) > now
        ? gracePeriodEnd
        : entitlement.expires_date || subscription?.expires_date || null;
      return {
        identifier,
        entitlement,
        provider: providerForStore(subscription?.store),
        effectiveExpiration,
      };
    })
    .filter(({ identifier, provider, effectiveExpiration }) =>
      (identifier === 'coach' || identifier === 'pro') &&
      provider === 'apple' &&
      (!effectiveExpiration || Date.parse(effectiveExpiration) > now)
    )
    .sort((a, b) => Number(b.identifier === 'coach') - Number(a.identifier === 'coach'));
  const active = activeEntitlements[0];

  const { data: current, error: currentError } = await adminClient.from('user_entitlements')
    .select('plan,billing_provider').eq('user_id', userId).maybeSingle();
  if (currentError) throw currentError;
  if (current?.billing_provider === 'admin') {
    return { plan: current.plan, billingProvider: 'admin' };
  }

  const { error: storeError } = await adminClient.from('user_store_entitlements')
    .upsert({
      user_id: userId,
      provider: 'apple',
      plan: active?.identifier || 'freemium',
      product_id: active?.entitlement.product_identifier || null,
      expires_at: active?.effectiveExpiration || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
  if (storeError) throw storeError;

  return refreshCachedEntitlement(userId);
}