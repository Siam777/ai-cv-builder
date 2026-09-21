import { saveRequestSchema } from "@/lib/cloud-contract";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { listResumes, saveResume } from "@/lib/server/resumes";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const { user } = await authorized(request);
    return json(await listResumes(user.id));
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    const body = saveRequestSchema.parse(await readJson(request));
    return json(
      await saveResume(user.id, body.document, body.expectedRevision),
    );
  });
}
