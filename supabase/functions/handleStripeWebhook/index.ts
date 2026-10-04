import { adminClient, json } from '../_shared/runtime.ts';

async function verifySignature(body: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith('t='))?.slice(2));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0 || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
    return difference === 0;
  });
}

async function setPlan(userId: string, plan: string) {
  const { error: entitlementError } = await adminClient.from('user_entitlements')
    .upsert({ user_id: userId, plan }, { onConflict: 'user_id' });
  if (entitlementError) throw entitlementError;
  const { error } = await adminClient.from('profiles').update({ plan }).eq('id', userId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature) return json({ error: 'Stripe webhook non configurato' }, 400);

  try {
    const rawBody = await req.text();
    if (!await verifySignature(rawBody, signature, secret)) return json({ error: 'Firma Stripe non valida' }, 400);
    const event = JSON.parse(rawBody);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      if (userId && plan === 'pro') await setPlan(userId, plan);
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      if (userId) await setPlan(userId, 'freemium');
    }
    return json({ received: true });
  } catch (error) {
    console.error('handleStripeWebhook:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore webhook Stripe' }, 500);
  }
});