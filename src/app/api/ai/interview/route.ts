import { interviewStartSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { startInterview } from "@/lib/server/ai-service";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = interviewStartSchema.parse(await readJson(request, 1024));
    return json(await startInterview(user.id, input));
  });
}
