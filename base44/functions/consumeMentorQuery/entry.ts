import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getOrCreateEntitlement, checkMentorQuota, incrementMentorCount } from '../../shared/entitlements.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entitlement = await getOrCreateEntitlement(base44, user.id);

    if (entitlement.blocked) {
      return Response.json({ error: 'Account bloccato', blocked: true }, { status: 403 });
    }

    const quota = checkMentorQuota(entitlement);
    if (!quota.allowed) {
      return Response.json({
        allowed: false,
        used: quota.used,
        limit: quota.limit,
        plan: quota.plan,
      }, { status: 429 });
    }

    const newCount = await incrementMentorCount(base44, entitlement);

    return Response.json({
      allowed: true,
      used: newCount,
      limit: quota.limit,
      plan: quota.plan,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}