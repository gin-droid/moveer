import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// Stripe Price ID for the moVeerAI Pro monthly subscription (€9.99/mo).
const PRO_PRICE_ID = 'price_1UL9htCfCFTGm6E2ROddBeu5';
const APP_ORIGIN = 'https://moveer.base44.app';

export default async function(req: Request): Promise<Response> {
  try {
    // Authenticate the caller — user identity is derived from the verified
    // session, not from the request body, so only the signed-in user can
    // start a checkout attributed to themselves.
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const planId = (body.planId || '').trim();

    if (planId !== 'pro') {
      return Response.json({ error: 'Solo il piano Pro è disponibile tramite checkout Stripe' }, { status: 400 });
    }

    const userId = user.id;
    const userEmail = user.email;
    if (!userEmail) {
      return Response.json({ error: 'Account senza email' }, { status: 400 });
    }

    const stripeKey = secrets.get('STRIPE_SECRET_KEY');
    const appId = secrets.get('BASE44_APP_ID');

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', PRO_PRICE_ID);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${APP_ORIGIN}/abbonamento?status=success`);
    params.append('cancel_url', `${APP_ORIGIN}/abbonamento?status=cancel`);
    params.append('customer_email', userEmail);
    params.append('metadata[base44_app_id]', appId);
    params.append('metadata[user_id]', userId);
    params.append('metadata[user_email]', userEmail);
    params.append('metadata[plan]', planId);
    params.append('subscription_data[metadata][base44_app_id]', appId);
    params.append('subscription_data[metadata][user_id]', userId);
    params.append('subscription_data[metadata][plan]', planId);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Stripe-Version': '2025-10-29.clover',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (!res.ok) {
      console.error('Stripe checkout error:', session.error?.message);
      return Response.json({ error: session.error?.message || 'Errore creazione sessione' }, { status: 500 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}