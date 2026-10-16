import { askRequestSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestAsk } from "@/lib/server/ai-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = askRequestSchema.parse(await readJson(request, 16384));
    return json(await requestAsk(user.id, input));
  });
}
