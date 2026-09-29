import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { setPlan } from '../../shared/entitlements.ts';

/**
 * Verify the Stripe webhook signature using Web Crypto (HMAC-SHA256).
 * Returns the parsed event object, or null if verification fails.
 */
async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<any | null> {
  const parts = signatureHeader.split(',').map((p) => p.trim());
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));

  if (!timestampPart || signatures.length === 0) return null;

  const timestamp = parseInt(timestampPart.slice(2), 10);
  if (isNaN(timestamp)) return null;

  // Reject if older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return null;

  const signedPayload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const expectedBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(expectedBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison against any provided signature
  let match = false;
  for (const sig of signatures) {
    if (sig.length === expectedHex.length) {
      let diff = 0;
      for (let i = 0; i < expectedHex.length; i++) {
        diff |= expectedHex.charCodeAt(i) ^ sig.charCodeAt(i);
      }
      if (diff === 0) match = true;
    }
  }

  if (!match) return null;
  return JSON.parse(rawBody);
}

export default async function(req: Request): Promise<Response> {
  try {
    const webhookSecret = secrets.get('STRIPE_WEBHOOK_SECRET');
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return Response.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    const rawBody = await req.text();
    const event = await verifyStripeWebhook(rawBody, signature, webhookSecret);
    if (!event) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan || 'pro';
        if (userId) {
          await setPlan(base44, userId, plan);
          console.log(`Upgraded user ${userId} to ${plan}`);
        } else {
          console.error('checkout.session.completed: missing user_id in metadata');
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;
        if (userId) {
          await setPlan(base44, userId, 'freemium');
          console.log(`Downgraded user ${userId} to freemium (subscription canceled)`);
        } else {
          console.error('customer.subscription.deleted: missing user_id in metadata');
        }
        break;
      }
      default:
        // Unhandled event type — acknowledge so Stripe doesn't retry
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}