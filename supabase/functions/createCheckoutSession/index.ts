import { authenticate, json } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await req.json();
    if (String(body.planId || '').trim() !== 'pro') {
      return json({ error: 'Checkout disponibile solo per il piano Pro' }, 400);
    }
    if (!auth.user.email) return json({ error: 'Account senza email' }, 400);
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
    const origin = Deno.env.get('APP_ORIGIN');
    if (!stripeKey || !priceId || !origin) {
      return json({ error: 'Stripe non configurato nei secrets Supabase' }, 503);
    }

    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/abbonamento?status=success`,
      cancel_url: `${origin}/abbonamento?status=cancel`,
      customer_email: auth.user.email,
      'metadata[user_id]': auth.user.id,
      'metadata[plan]': 'pro',
      'subscription_data[metadata][user_id]': auth.user.id,
      'subscription_data[metadata][plan]': 'pro',
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Version': '2025-10-29.clover',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('Stripe checkout error:', result.error?.message);
      return json({ error: result.error?.message || 'Errore creazione checkout' }, 502);
    }
    return json({ url: result.url });
  } catch (error) {
    console.error('createCheckoutSession:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore checkout' }, 500);
  }
});