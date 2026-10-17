import { coverLetterRequestSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestCoverLetter } from "@/lib/server/ai-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = coverLetterRequestSchema.parse(await readJson(request, 65536));
    return json(await requestCoverLetter(user.id, input));
  });
}
