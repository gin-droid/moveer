// Server-side entitlement logic shared across backend functions.
// The UserEntitlement entity is the trusted source of truth for plan,
// blocked status, and monthly usage counters. The User entity fields
// (plan, mentor_query_count, etc.) are display-only caches synced here.

const PLAN_LIMITS: Record<string, { analysesPerMonth: number; mentorQueriesPerMonth: number }> = {
  freemium: { analysesPerMonth: 3, mentorQueriesPerMonth: 5 },
  pro: { analysesPerMonth: 30, mentorQueriesPerMonth: 50 },
  coach: { analysesPerMonth: 100, mentorQueriesPerMonth: 200 },
};

const DEFAULT_LIMITS = PLAN_LIMITS.freemium;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] || DEFAULT_LIMITS;
}

export function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Fetch the user's entitlement record via service role (bypasses RLS).
 * Creates a default freemium record if none exists yet.
 */
export async function getOrCreateEntitlement(base44: any, userId: string) {
  const existing = await base44.asServiceRole.entities.UserEntitlement.filter(
    { user_id: userId },
    '-created_date',
    1
  );
  if (existing && existing.length > 0) {
    return existing[0];
  }
  const mk = monthKey();
  return await base44.asServiceRole.entities.UserEntitlement.create({
    user_id: userId,
    plan: 'freemium',
    blocked: false,
    mentor_query_count: 0,
    mentor_query_month: mk,
    analysis_count: 0,
    analysis_month: mk,
  });
}

/**
 * Check the analysis quota for the current month.
 */
export function checkAnalysisQuota(entitlement: any) {
  const plan = entitlement.plan || 'freemium';
  const limits = getPlanLimits(plan);
  const mk = monthKey();
  const used = entitlement.analysis_month === mk ? entitlement.analysis_count || 0 : 0;
  return {
    allowed: used < limits.analysesPerMonth,
    used,
    limit: limits.analysesPerMonth,
    plan,
  };
}

/**
 * Check the mentor query quota for the current month.
 */
export function checkMentorQuota(entitlement: any) {
  const plan = entitlement.plan || 'freemium';
  const limits = getPlanLimits(plan);
  const mk = monthKey();
  const used = entitlement.mentor_query_month === mk ? entitlement.mentor_query_count || 0 : 0;
  return {
    allowed: used < limits.mentorQueriesPerMonth,
    used,
    limit: limits.mentorQueriesPerMonth,
    plan,
  };
}

/**
 * Increment the analysis counter (service role). Resets when the month changes.
 */
export async function incrementAnalysisCount(base44: any, entitlement: any) {
  const mk = monthKey();
  const newCount = entitlement.analysis_month === mk ? (entitlement.analysis_count || 0) + 1 : 1;
  await base44.asServiceRole.entities.UserEntitlement.update(entitlement.id, {
    analysis_count: newCount,
    analysis_month: mk,
  });
  return newCount;
}

/**
 * Increment the mentor query counter (service role). Resets when the month changes.
 * Also syncs the display cache on the User entity.
 */
export async function incrementMentorCount(base44: any, entitlement: any) {
  const mk = monthKey();
  const newCount = entitlement.mentor_query_month === mk ? (entitlement.mentor_query_count || 0) + 1 : 1;
  await base44.asServiceRole.entities.UserEntitlement.update(entitlement.id, {
    mentor_query_count: newCount,
    mentor_query_month: mk,
  });
  try {
    await base44.asServiceRole.entities.User.update(entitlement.user_id, {
      mentor_query_count: newCount,
      mentor_query_month: mk,
    });
  } catch {
    /* non-blocking display sync */
  }
  return newCount;
}

/**
 * Sync the plan display cache on the User entity (service role).
 */
export async function syncPlanToUser(base44: any, userId: string, plan: string) {
  try {
    await base44.asServiceRole.entities.User.update(userId, { plan });
  } catch {
    /* non-blocking */
  }
}

/**
 * Set the user's plan on the trusted UserEntitlement entity and sync the display cache.
 * Used by the Stripe webhook (after confirmed payment) and changePlan (admin / free downgrade).
 */
export async function setPlan(base44: any, userId: string, plan: string) {
  const entitlement = await getOrCreateEntitlement(base44, userId);
  await base44.asServiceRole.entities.UserEntitlement.update(entitlement.id, { plan });
  await syncPlanToUser(base44, userId, plan);
  return entitlement;
}