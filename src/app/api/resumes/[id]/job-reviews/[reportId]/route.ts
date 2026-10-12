import { handle, json, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { getJobReview, deleteJobReview } from "@/lib/server/job-review-history";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; reportId: string }> };
export async function GET(request: Request, { params }: Context) {
  return handle(async () => {
    const { user } = await authorized(request);
    const { id, reportId } = await params;
    return json(await getJobReview(user.id, id, reportId));
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const { id, reportId } = await params;
    await deleteJobReview(user.id, id, reportId);
    return json({ deleted: true });
  });
}
