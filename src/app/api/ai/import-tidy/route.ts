import { importTidyRequestSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestImportTidy } from "@/lib/server/ai-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = importTidyRequestSchema.parse(await readJson(request, 3000000));
    return json(await requestImportTidy(user.id, input));
  });
}
