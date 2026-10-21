import { adminClient } from './runtime.ts';

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
  if (store === 'PLAY_STORE' || store === 'play_store') return 'google';
  return null;
}

export async function syncStoreEntitlement(userId: string) {
  const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!apiKey) throw new Error('REVENUECAT_SECRET_API_KEY non configurata nei secrets Supabase');

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
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
      provider &&
      (!effectiveExpiration || Date.parse(effectiveExpiration) > now)
    )
    .sort((a, b) => Number(b.identifier === 'coach') - Number(a.identifier === 'coach'));
  const active = activeEntitlements[0];

  const { data: current, error: currentError } = await adminClient.from('user_entitlements')
    .select('plan,billing_provider').eq('user_id', userId).maybeSingle();
  if (currentError) throw currentError;
  if (!active && current?.billing_provider === 'admin') {
    return { plan: current.plan, billingProvider: 'admin' };
  }

  const plan = active?.identifier || 'freemium';
  const billingProvider = active?.provider || null;
  const values = {
    plan,
    billing_provider: billingProvider,
    store_product_id: active?.entitlement.product_identifier || null,
    subscription_expires_at: active?.effectiveExpiration || null,
  };

  const { error: entitlementError } = await adminClient.from('user_entitlements')
    .upsert({ user_id: userId, ...values }, { onConflict: 'user_id' });
  if (entitlementError) throw entitlementError;
  const { error: profileError } = await adminClient.from('profiles').update({ plan }).eq('id', userId);
  if (profileError) throw profileError;

  return { plan, billingProvider };
}