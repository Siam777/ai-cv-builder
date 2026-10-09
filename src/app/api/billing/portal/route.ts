import { handle, json, requireSameOrigin } from "@/lib/server/http";
import { auth, origin } from "@/lib/server/auth";
import { getUserSubscription } from "@/lib/server/entitlements";
import { createBillingPortalSession } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const session = await auth().api.getSession({ headers: request.headers });

    if (!session?.user) {
      return json({ error: "Sign in required." }, 401);
    }

    const sub = await getUserSubscription(session.user.id);
    if (!sub.stripeCustomerId) {
      return json({ error: "No active Stripe customer found." }, 400);
    }

    const result = await createBillingPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: origin(),
    });

    return json({ url: result.url });
  });
}
