import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getOrCreateEntitlement, syncPlanToUser } from '../../shared/entitlements.ts';

const VALID_PLANS = ['freemium', 'pro', 'coach'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const planId = (body.planId || '').trim();
    const purchaseToken = (body.purchaseToken || '').trim();

    if (!VALID_PLANS.includes(planId)) {
      return Response.json({ error: 'Piano non valido' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin';

    // Non-admins can freely downgrade to freemium.
    // Paid upgrades (pro/coach) require a verified purchase token.
    // The payment system (Google Play / App Store) is not yet configured,
    // so all non-admin paid upgrades are rejected until verification is wired.
    if (!isAdmin && (planId === 'pro' || planId === 'coach')) {
      // When the payment provider is configured, verify purchaseToken here
      // (e.g. Google Play Developer API / App Store Server API) before granting.
      return Response.json({
        error: 'I piani a pagamento saranno disponibili tramite Google Play e App Store al momento della pubblicazione.',
        code: 'payment_not_available',
      }, { status: 402 });
    }

    // Update the trusted entitlement record
    const entitlement = await getOrCreateEntitlement(base44, user.id);
    await base44.asServiceRole.entities.UserEntitlement.update(entitlement.id, { plan: planId });

    // Sync the display cache on the User entity
    await syncPlanToUser(base44, user.id, planId);

    return Response.json({ plan: planId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}