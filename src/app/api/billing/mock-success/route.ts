import { NextResponse } from "next/server";
import { upsertSubscription, type PlanId } from "@/lib/server/entitlements";
import { origin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const planId = (searchParams.get("plan_id") as PlanId) || "job_hunter_monthly";
  const sessionId = searchParams.get("session_id") || `cs_sim_${Date.now()}`;

  if (userId) {
    // 30 days from now
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await upsertSubscription({
      userId,
      stripeCustomerId: `cus_sim_${userId}`,
      stripeSubscriptionId: `sub_sim_${sessionId}`,
      planId,
      status: "active",
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
  }

  return NextResponse.redirect(`${origin()}/?billing=success`);
}
