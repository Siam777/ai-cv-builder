import { handle, json } from "@/lib/server/http";
import { auth } from "@/lib/server/auth";
import { getUserSubscription } from "@/lib/server/entitlements";
import { betaTrialDays } from "@/lib/billing-plans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const session = await auth().api.getSession({ headers: request.headers });
    const userId = session?.user?.id ?? null;
    const subscription = await getUserSubscription(userId);

    return json({
      subscription,
      betaTrialDays: betaTrialDays(),
      user: session ? { id: session.user.id, email: session.user.email } : null,
    });
  });
}
