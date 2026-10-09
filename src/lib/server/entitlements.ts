import { database } from "./database";
import { PLANS, type PlanConfig, type PlanId } from "../billing-plans";

export type { PlanConfig, PlanId };
export { PLANS };

export type EntitlementFeature =
  | "watermark_free_export"
  | "unlimited_variants"
  | "career_vault_storage"
  | "job_tailoring_engine"
  | "all_templates";

export interface UserSubscriptionDetails {
  planId: PlanId;
  plan: PlanConfig;
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  entitlements: Record<EntitlementFeature, boolean>;
}

/**
 * Retrieves the active subscription for a given user.
 * Falls back to Free tier if user has no subscription or subscription is expired/canceled.
 */
export async function getUserSubscription(
  userId: string | null,
): Promise<UserSubscriptionDetails> {
  if (!userId) {
    return {
      planId: "free",
      plan: PLANS.free,
      status: "none",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      entitlements: {
        watermark_free_export: false,
        unlimited_variants: false,
        career_vault_storage: false,
        job_tailoring_engine: false,
        all_templates: false,
      },
    };
  }

  const { client } = database();
  const result = await client.execute({
    sql: "SELECT * FROM subscriptions WHERE user_id = ?",
    args: [userId],
  });

  if (!result.rows.length) {
    return {
      planId: "free",
      plan: PLANS.free,
      status: "none",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      entitlements: {
        watermark_free_export: false,
        unlimited_variants: false,
        career_vault_storage: false,
        job_tailoring_engine: false,
        all_templates: false,
      },
    };
  }

  const row = result.rows[0];
  const planId = (row.plan_id as PlanId) || "free";
  const plan = PLANS[planId] || PLANS.free;
  const status = (row.status as string) || "canceled";
  const nowMs = Date.now();
  const currentPeriodEnd = row.current_period_end ? Number(row.current_period_end) : null;

  const isActive =
    (status === "active" || status === "trialing" || planId === "lifetime") &&
    (!currentPeriodEnd || currentPeriodEnd * 1000 > nowMs);

  const effectivePlan = isActive ? plan : PLANS.free;

  return {
    planId: isActive ? planId : "free",
    plan: effectivePlan,
    status: isActive ? (status as any) : "canceled",
    stripeCustomerId: String(row.stripe_customer_id || ""),
    stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    entitlements: {
      watermark_free_export: !effectivePlan.hasWatermark,
      unlimited_variants: effectivePlan.maxVariants > 1,
      career_vault_storage: isActive,
      job_tailoring_engine: isActive,
      all_templates: effectivePlan.allTemplates,
    },
  };
}

/**
 * Checks a specific entitlement flag for a user.
 */
export async function checkEntitlement(
  userId: string | null,
  feature: EntitlementFeature,
): Promise<boolean> {
  const details = await getUserSubscription(userId);
  return details.entitlements[feature];
}

/**
 * Upserts a subscription record into the database (called by Stripe Webhook handler).
 */
export async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  planId: PlanId;
  status: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const { client } = database();
  const id = `sub_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO subscriptions (
      id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = excluded.updated_at`,
    args: [
      id,
      data.userId,
      data.stripeCustomerId,
      data.stripeSubscriptionId ?? null,
      data.planId,
      data.status,
      data.currentPeriodEnd ?? null,
      data.cancelAtPeriodEnd ? 1 : 0,
      now,
      now,
    ],
  });
}

/**
 * Records monthly consumption quota (tailored resumes or AI bullet actions).
 */
export async function recordUsage(
  userId: string,
  action: "tailored_resumes_generated" | "ai_bullet_rewrites",
) {
  const { client } = database();
  const periodMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const id = `usg_${crypto.randomUUID()}`;

  await client.execute({
    sql: `INSERT INTO subscription_usage (id, user_id, period_month, ${action})
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, period_month) DO UPDATE SET
      ${action} = ${action} + 1`,
    args: [id, userId, periodMonth],
  });
}

/**
 * Retrieves monthly feature usage for a given user.
 */
export async function getMonthlyUsage(
  userId: string,
): Promise<{ tailored_resumes_generated: number; ai_bullet_rewrites: number }> {
  const { client } = database();
  const periodMonth = new Date().toISOString().slice(0, 7);
  const result = await client.execute({
    sql: "SELECT tailored_resumes_generated, ai_bullet_rewrites FROM subscription_usage WHERE user_id = ? AND period_month = ?",
    args: [userId, periodMonth],
  });
  if (!result.rows.length) {
    return { tailored_resumes_generated: 0, ai_bullet_rewrites: 0 };
  }
  const row = result.rows[0];
  return {
    tailored_resumes_generated: Number(row.tailored_resumes_generated || 0),
    ai_bullet_rewrites: Number(row.ai_bullet_rewrites || 0),
  };
}

