import { decisionSchema } from "@/lib/ai-contract";
import { authorized, origin } from "@/lib/server/auth";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { decideProposal } from "@/lib/server/ai-service";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const body = decisionSchema.parse(await readJson(request, 1024));
    return json(
      await decideProposal(user.id, (await context.params).id, body.decision),
    );
  });
}
