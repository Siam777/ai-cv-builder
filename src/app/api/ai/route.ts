import { generateSchema } from "@/lib/ai-contract";
import { auth, authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestRewrite } from "@/lib/server/ai-service";
import { openAIConfigured } from "@/lib/server/openai-provider";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  return handle(async () => {
    const session = await auth().api.getSession({ headers: request.headers });
    return json({
      configured: openAIConfigured(),
      signedIn: Boolean(session),
      provider: "OpenAI",
    });
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = generateSchema.parse(await readJson(request, 8192));
    return json(await requestRewrite(user.id, input));
  });
}
