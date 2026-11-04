import { DOCUMENT_BODY_BYTES, freezeDocumentSchema } from "@/lib/applications";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { freezeDocument } from "@/lib/server/applications";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import { APPLICATION_WRITE_LIMIT } from "@/lib/server/application-limits";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
/** Freeze a CV or letter: { snapshotId } first, else a stored revision, a device CV or letter text. */
export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("application-write", user.id, APPLICATION_WRITE_LIMIT);
    const { id } = await params;
    const input = freezeDocumentSchema.parse(
      await readJson(request, DOCUMENT_BODY_BYTES),
    );
    return json(await freezeDocument(user.id, id, input));
  });
}
