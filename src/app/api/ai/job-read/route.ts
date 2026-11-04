import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestJobRead } from "@/lib/server/ai-service";
import type { JobReadRequest } from "@/lib/ai-contract";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/**
 * Read with AI (job capture §4.2). 192 KiB fits 30,000 four-byte characters
 * plus JSON overhead (review finding 5); the character limit itself is in the
 * schema, so a long post gets the character message, not a size error.
 */
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const body = (await readJson(request, 196608)) as JobReadRequest;
    return json(await requestJobRead(user.id, body));
  });
}
