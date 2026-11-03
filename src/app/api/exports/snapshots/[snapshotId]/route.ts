import { handle, json, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import {
  deleteExportSnapshot,
  getExportSnapshot,
} from "@/lib/server/applications";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import {
  APPLICATION_READ_LIMIT,
  APPLICATION_WRITE_LIMIT,
} from "@/lib/server/application-limits";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ snapshotId: string }> };
/** What an export receipt holds (name and kind only), for the "Record this as an application?" form. */
export async function GET(request: Request, { params }: Context) {
  return handle(async () => {
    const { user } = await authorized(request);
    checkRateLimit("application-read", user.id, APPLICATION_READ_LIMIT);
    const { snapshotId } = await params;
    return json(await getExportSnapshot(user.id, snapshotId));
  });
}
/** Dismissing the prompt deletes the receipt at once. */
export async function DELETE(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("application-write", user.id, APPLICATION_WRITE_LIMIT);
    const { snapshotId } = await params;
    await deleteExportSnapshot(user.id, snapshotId);
    return json({ deleted: true });
  });
}
