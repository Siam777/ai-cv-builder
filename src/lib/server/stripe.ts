import Stripe from "stripe";
import { PLANS, type PlanId } from "./entitlements";

const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2026-03-23.acacia" as any,
  typescript: true,
});

export const STRIPE_PRICE_IDS: Record<string, string> = {
  job_hunter_weekly: process.env.STRIPE_PRICE_WEEKLY || "price_mock_weekly",
  job_hunter_monthly: process.env.STRIPE_PRICE_MONTHLY || "price_mock_monthly",
  lifetime: process.env.STRIPE_PRICE_LIFETIME || "price_mock_lifetime",
};

/**
 * Creates a Stripe Checkout Session or returns a simulated local redirect
 * if live Stripe credentials are not yet configured.
 */
export async function createBillingCheckoutSession(params: {
  userId: string;
  userEmail: string;
  planId: PlanId;
  origin: string;
}): Promise<{ url: string; sessionId?: string; isMock?: boolean }> {
  const { userId, userEmail, planId, origin } = params;

  if (planId === "free") {
    throw new Error("Cannot checkout the free plan.");
  }

  const plan = PLANS[planId];
  if (!plan) throw new Error("Invalid plan specified.");

  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const isRealStripe =
    Boolean(secretKey) &&
    (secretKey.startsWith("sk_live_") ||
      (secretKey.startsWith("sk_test_") && Boolean(process.env.STRIPE_PRICE_MONTHLY)));

  if (!isRealStripe) {
    // Development / Local offline simulation mode:
    // Generate a deterministic simulated checkout callback URL that triggers the mock activation
    const mockSessionId = `cs_mock_${Date.now()}_${userId}`;
    const redirectUrl = `${origin}/api/billing/mock-success?session_id=${mockSessionId}&user_id=${userId}&plan_id=${planId}`;
    return { url: redirectUrl, sessionId: mockSessionId, isMock: true };
  }

  const priceId = STRIPE_PRICE_IDS[planId];
  const mode = plan.cadence === "one-time" ? "payment" : "subscription";

  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    client_reference_id: userId,
    mode,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      planId,
    },
    success_url: `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?billing=canceled`,
  });

  return { url: session.url || `${origin}/?billing=error`, sessionId: session.id };
}

/**
 * Creates a Stripe Customer Portal session.
 */
export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const { stripeCustomerId, returnUrl } = params;

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder")) {
    return { url: `${returnUrl}?portal=simulated` };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}
