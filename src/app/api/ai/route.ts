import { generateSchema } from "@/lib/ai-contract";
import { auth, authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { requestRewrite } from "@/lib/server/ai-service";
import { openAIConfigured } from "@/lib/server/openai-provider";
import { getAiConsent, requireAiConsent } from "@/lib/server/ai-consent";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  return handle(async () => {
    const session = await auth().api.getSession({ headers: request.headers });
    return json({
      configured: openAIConfigured(),
      jobCoaching: openAIConfigured(),
      signedIn: Boolean(session),
      // One-time AI consent stored on the account (Data & privacy).
      aiConsent: session ? (await getAiConsent(session.user.id)).enabled : false,
      provider: "OpenAI",
    });
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const input = generateSchema.parse(await readJson(request, 131072));
    // Job coaching keeps its own consent for the job post; bullet rewrites use the account setting.
    if (!input.job) await requireAiConsent(user.id);
    return json(await requestRewrite(user.id, input));
  });
}
