import { z } from "zod";
import {
  APPLICATION_BODY_BYTES,
  createApplicationSchema,
  stageSchema,
} from "@/lib/applications";
import { handle, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { createApplication, listApplications } from "@/lib/server/applications";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import {
  APPLICATION_READ_LIMIT,
  APPLICATION_WRITE_LIMIT,
} from "@/lib/server/application-limits";
export const dynamic = "force-dynamic";

const filters = z.strictObject({
  stage: stageSchema.optional(),
  /** The viewer's local date: return applications with a next action on or before it. */
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export async function GET(request: Request) {
  return handle(async () => {
    const { user } = await authorized(request);
    checkRateLimit("application-read", user.id, APPLICATION_READ_LIMIT);
    const query = filters.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return json(
      await listApplications(user.id, { stage: query.stage, dueBy: query.due }),
    );
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("application-write", user.id, APPLICATION_WRITE_LIMIT);
    const input = createApplicationSchema.parse(
      await readJson(request, APPLICATION_BODY_BYTES),
    );
    return json(await createApplication(user.id, input));
  });
}
