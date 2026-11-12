import { adminClient, fetchWithTimeout, HttpError } from './runtime.ts';
import { refreshCachedEntitlement } from './storeBilling.ts';

const packageName = 'com.moveerai.app';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const publisherScope = 'https://www.googleapis.com/auth/androidpublisher';
const productPlans: Record<string, 'pro' | 'coach'> = {
  'pro-monthly': 'pro',
  'pro-annual': 'pro',
  'coach-monthly': 'coach',
  'coach-annual': 'coach',
};
const activeStates = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
};

type GoogleSubscription = {
  subscriptionState?: string;
  latestOrderId?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
  };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
  }>;
};

type PurchaseCandidate = {
  productId: string;
  plan: 'pro' | 'coach';
  expiresAt: string;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToBytes(pem: string) {
  const encoded = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const rawCredentials = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!rawCredentials) {
    throw new HttpError(503, 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON non configurato nei secrets Supabase');
  }

  let credentials: GoogleServiceAccount;
  try {
    credentials = JSON.parse(rawCredentials) as GoogleServiceAccount;
  } catch {
    throw new HttpError(503, 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON non è un JSON valido');
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new HttpError(503, 'Il service account Google Play deve includere client_email e private_key');
  }

  let privateKey: CryptoKey;
  try {
    privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(credentials.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch {
    throw new HttpError(503, 'La private key del service account Google Play non è valida');
  }

  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = [
    base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))),
    base64Url(new TextEncoder().encode(JSON.stringify({
      iss: credentials.client_email,
      scope: publisherScope,
      aud: tokenUrl,
      iat: now,
      exp: now + 3600,
    }))),
  ].join('.');
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetchWithTimeout(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  }, 20_000);
  const result = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !result.access_token) {
    throw new HttpError(502, `Autenticazione Google Play non riuscita (HTTP ${response.status})`);
  }

  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(60, result.expires_in || 3600) * 1000,
  };
  return result.access_token;
}

async function obfuscatedAccountId(userId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`moveerai:${userId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getSubscription(token: string) {
  const accessToken = await getAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  }, 20_000);
  if (response.status === 404) return null;

  const result = await response.json().catch(() => ({})) as GoogleSubscription & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new HttpError(502, `Verifica Google Play non riuscita (HTTP ${response.status})`);
  }
  return result;
}

function candidatesFor(subscription: GoogleSubscription): PurchaseCandidate[] {
  if (!activeStates.has(subscription.subscriptionState || '')) return [];
  const now = Date.now();
  return (subscription.lineItems || []).flatMap((line): PurchaseCandidate[] => {
    const plan = line.productId ? productPlans[line.productId] : undefined;
    const expiry = line.expiryTime ? Date.parse(line.expiryTime) : Number.NaN;
    if (!plan || !Number.isFinite(expiry) || expiry <= now) return [];
    return [{ productId: line.productId!, plan, expiresAt: new Date(expiry).toISOString() }];
  });
}

function selectBestCandidate(candidates: PurchaseCandidate[]) {
  return candidates.sort((a, b) => {
    const planDifference = Number(b.plan === 'coach') - Number(a.plan === 'coach');
    return planDifference || Date.parse(b.expiresAt) - Date.parse(a.expiresAt);
  })[0];
}

async function savePurchase(
  token: string,
  userId: string,
  subscription: GoogleSubscription | null,
  purchaseTokenWasSubmitted: boolean,
) {
  if (!subscription) {
    if (purchaseTokenWasSubmitted) throw new HttpError(400, 'Token Google Play non valido o non trovato');
    const { error } = await adminClient.from('google_play_purchases')
      .update({
        subscription_state: 'SUBSCRIPTION_STATE_EXPIRED',
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('purchase_token', token).eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const accountId = subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (accountId && accountId !== await obfuscatedAccountId(userId)) {
    throw new HttpError(403, 'Questo acquisto Google Play è associato a un altro account moVeerAI');
  }

  const allCandidates = candidatesFor(subscription);
  const selected = selectBestCandidate(allCandidates);
  const knownProducts = (subscription.lineItems || [])
    .map((line) => line.productId)
    .filter((productId): productId is string => Boolean(productId && productPlans[productId]));
  if (!knownProducts.length) {
    throw new HttpError(400, 'Il prodotto Google Play non è associato a un piano moVeerAI');
  }

  const values = {
    product_id: selected?.productId || knownProducts[0],
    subscription_state: subscription.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED',
    expires_at: selected?.expiresAt || null,
    order_id: subscription.latestOrderId || null,
    updated_at: new Date().toISOString(),
  };
  const { error: insertError } = await adminClient.from('google_play_purchases')
    .insert({ purchase_token: token, user_id: userId, ...values });
  if (!insertError) return;
  if (insertError.code !== '23505') throw insertError;

  const { data: existing, error: existingError } = await adminClient.from('google_play_purchases')
    .select('user_id').eq('purchase_token', token).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.user_id !== userId) {
    throw new HttpError(409, 'Questo acquisto Google Play è già collegato a un altro account moVeerAI');
  }
  const { error: updateError } = await adminClient.from('google_play_purchases')
    .update(values).eq('purchase_token', token).eq('user_id', userId);
  if (updateError) throw updateError;
}

async function syncStoredPurchases(userId: string) {
  const { data: purchases, error } = await adminClient.from('google_play_purchases')
    .select('purchase_token').eq('user_id', userId).limit(50);
  if (error) throw error;
  for (const purchase of purchases || []) {
    const subscription = await getSubscription(purchase.purchase_token);
    await savePurchase(purchase.purchase_token, userId, subscription, false);
  }
}

async function refreshGoogleEntitlement(userId: string) {
  const { data: purchases, error } = await adminClient.from('google_play_purchases')
    .select('product_id,subscription_state,expires_at').eq('user_id', userId);
  if (error) throw error;

  const now = Date.now();
  const candidates = (purchases || []).flatMap((purchase): PurchaseCandidate[] => {
    const plan = purchase.product_id ? productPlans[purchase.product_id] : undefined;
    const expiry = purchase.expires_at ? Date.parse(purchase.expires_at) : Number.NaN;
    if (
      !plan ||
      !activeStates.has(purchase.subscription_state) ||
      !Number.isFinite(expiry) ||
      expiry <= now
    ) return [];
    return [{ productId: purchase.product_id!, plan, expiresAt: new Date(expiry).toISOString() }];
  });
  const selected = selectBestCandidate(candidates);
  const { error: entitlementError } = await adminClient.from('user_store_entitlements')
    .upsert({
      user_id: userId,
      provider: 'google_play',
      plan: selected?.plan || 'freemium',
      product_id: selected?.productId || null,
      expires_at: selected?.expiresAt || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
  if (entitlementError) throw entitlementError;
}

export async function syncGooglePlayEntitlement(
  userId: string,
  purchaseToken?: string,
  productId?: string,
) {
  const { data: current, error: currentError } = await adminClient.from('user_entitlements')
    .select('plan,billing_provider').eq('user_id', userId).maybeSingle();
  if (currentError) throw currentError;
  if (current?.billing_provider === 'admin') {
    return { plan: current.plan, billingProvider: 'admin' };
  }

  if (purchaseToken) {
    if (purchaseToken.length > 4096) throw new HttpError(400, 'Token Google Play non valido');
    if (productId && !productPlans[productId]) {
      throw new HttpError(400, 'Prodotto Google Play non valido');
    }
    const subscription = await getSubscription(purchaseToken);
    if (!subscription) throw new HttpError(400, 'Token Google Play non valido o non trovato');
    const responseProducts = (subscription.lineItems || []).map((line) => line.productId);
    if (productId && !responseProducts.includes(productId)) {
      throw new HttpError(400, 'Il prodotto non corrisponde al token Google Play');
    }
    await savePurchase(purchaseToken, userId, subscription, true);
  } else {
    await syncStoredPurchases(userId);
  }

  await refreshGoogleEntitlement(userId);
  return refreshCachedEntitlement(userId);
}
