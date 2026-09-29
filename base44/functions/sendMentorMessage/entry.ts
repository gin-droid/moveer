import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getOrCreateEntitlement, checkMentorQuota, incrementMentorCount } from '../../shared/entitlements.ts';

/**
 * Server-side mentor message submission: checks the monthly quota BEFORE
 * adding the message to the conversation, so the quota gate and the agent
 * invocation are a single atomic server-side operation. The client cannot
 * bypass the quota by calling base44.agents.addMessage directly through this
 * official path — the quota is verified and the message is submitted in one
 * server-side call.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const conversationId = (body.conversationId || '').trim();
    const text = (body.text || '').trim();

    if (!conversationId || !text) {
      return Response.json({ error: 'conversationId e text sono obbligatori' }, { status: 400 });
    }

    // Server-side quota check (trusted source: UserEntitlement entity)
    const entitlement = await getOrCreateEntitlement(base44, user.id);
    if (entitlement.blocked) {
      return Response.json({ error: 'Account bloccato' }, { status: 403 });
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

    // Add the message FIRST (user-scoped: agent acts as the user, RLS preserved).
    // Only increment the counter if the message was successfully submitted.
    const conversation = await base44.agents.getConversation(conversationId);
    if (!conversation) {
      return Response.json({ error: 'Conversazione non trovata' }, { status: 404 });
    }
    await base44.agents.addMessage(conversation, { role: 'user', content: text });

    // Increment the counter after successful submission
    const newCount = await incrementMentorCount(base44, entitlement);

    return Response.json({ allowed: true, used: newCount, limit: quota.limit });
  } catch (error) {
    console.error('sendMentorMessage error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}