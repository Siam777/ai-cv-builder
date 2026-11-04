import { submissionSchema } from "@/lib/applications";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { createSubmission } from "@/lib/server/applications";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import { APPLICATION_WRITE_LIMIT } from "@/lib/server/application-limits";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
/** Mark as sent: one immutable submission plus a sent event, in one transaction. */
export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("application-write", user.id, APPLICATION_WRITE_LIMIT);
    const { id } = await params;
    const input = submissionSchema.parse(await readJson(request, 4096));
    return json(await createSubmission(user.id, id, input));
  });
}
