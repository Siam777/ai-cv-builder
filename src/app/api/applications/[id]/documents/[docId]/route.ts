import { handle, json } from "@/lib/server/http";
import { authorized } from "@/lib/server/auth";
import { getFrozenDocument } from "@/lib/server/applications";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import { APPLICATION_READ_LIMIT } from "@/lib/server/application-limits";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; docId: string }> };
export async function GET(request: Request, { params }: Context) {
  return handle(async () => {
    const { user } = await authorized(request);
    checkRateLimit("application-read", user.id, APPLICATION_READ_LIMIT);
    const { id, docId } = await params;
    return json(await getFrozenDocument(user.id, id, docId));
  });
}
