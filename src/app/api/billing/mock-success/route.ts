import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Legacy simulation URLs must never grant production or local entitlements.
export async function GET() {
  return json({ error: "SIMULATION_REMOVED", message: "Subscriptions can only be activated through verified payment events." }, 410);
}
