import { summaryRequestSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestSummaryDraft } from "@/lib/server/ai-service";
import { requireAiConsent } from "@/lib/server/ai-consent";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = summaryRequestSchema.parse(await readJson(request, 4096));
    await requireAiConsent(user.id);
    return json(await requestSummaryDraft(user.id, input));
  });
}
