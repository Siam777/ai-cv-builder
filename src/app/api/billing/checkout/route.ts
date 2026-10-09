import { z } from "zod";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { auth, origin } from "@/lib/server/auth";
import { createBillingCheckoutSession } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

const checkoutSchema = z.strictObject({
  planId: z.enum(["job_hunter_monthly", "job_hunter_weekly", "lifetime"]),
});

export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const session = await auth().api.getSession({ headers: request.headers });

    if (!session?.user) {
      return json(
        { error: "Please sign in or create an account to activate a subscription." },
        401,
      );
    }

    const body = checkoutSchema.parse(await readJson(request, 1024));
    const appOrigin = origin();

    const result = await createBillingCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      planId: body.planId,
      origin: appOrigin,
    });

    return json({ url: result.url, isMock: result.isMock });
  });
}
