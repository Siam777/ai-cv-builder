import Stripe from "stripe";
import { PLANS, type PlanId } from "./entitlements";
import { HttpError } from "./http";

const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2026-03-23.acacia" as any,
  typescript: true,
});

/** Stripe monthly price IDs for the paid tiers. */
export function stripePriceId(planId: PlanId) {
  if (planId === "go") return process.env.STRIPE_PRICE_GO?.trim() || "";
  if (planId === "pro") return process.env.STRIPE_PRICE_PRO?.trim() || "";
  return "";
}

/**
 * Creates a Stripe Checkout Session only when billing is configured.
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
  const priceId = stripePriceId(planId);
  const isRealStripe =
    (secretKey.startsWith("sk_live_") || secretKey.startsWith("sk_test_")) &&
    Boolean(priceId);

  if (!isRealStripe) {
    throw new HttpError(503, "BILLING_NOT_CONFIGURED", "Checkout is not available on this installation. No payment or subscription change was made.");
  }

  const mode = "subscription";

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
    success_url: `${origin}/builder?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/builder?billing=canceled`,
  });

  return { url: session.url || `${origin}/builder?billing=error`, sessionId: session.id };
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
