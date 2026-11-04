import {
  APPLICATION_BODY_BYTES,
  updateApplicationSchema,
} from "@/lib/applications";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import {
  deleteApplication,
  getApplication,
  updateApplication,
} from "@/lib/server/applications";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import {
  APPLICATION_READ_LIMIT,
  APPLICATION_WRITE_LIMIT,
} from "@/lib/server/application-limits";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return handle(async () => {
    const { user } = await authorized(request);
    checkRateLimit("application-read", user.id, APPLICATION_READ_LIMIT);
    const { id } = await params;
    return json(await getApplication(user.id, id));
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("application-write", user.id, APPLICATION_WRITE_LIMIT);
    const { id } = await params;
    const input = updateApplicationSchema.parse(
      await readJson(request, APPLICATION_BODY_BYTES),
    );
    return json(await updateApplication(user.id, id, input));
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("application-write", user.id, APPLICATION_WRITE_LIMIT);
    const { id } = await params;
    await deleteApplication(user.id, id);
    return json({ deleted: true });
  });
}
