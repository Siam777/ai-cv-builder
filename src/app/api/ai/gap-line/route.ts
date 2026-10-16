import { gapLineRequestSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestGapLine } from "@/lib/server/ai-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = gapLineRequestSchema.parse(await readJson(request, 4096));
    return json(await requestGapLine(user.id, input));
  });
}
