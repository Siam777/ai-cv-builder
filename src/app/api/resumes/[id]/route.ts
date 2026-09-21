import { deleteRequestSchema } from "@/lib/cloud-contract";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { getResume, removeResume } from "@/lib/server/resumes";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return handle(async () => {
    const { user } = await authorized(request);
    return json(await getResume(user.id, (await context.params).id));
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const body = deleteRequestSchema.parse(await readJson(request, 4096));
    await removeResume(
      user.id,
      (await context.params).id,
      body.expectedRevision,
    );
    return json({ deleted: true });
  });
}
