import { saveJobReviewSchema } from "@/lib/job-review-history";
import {
  handle,
  json,
  readJson,
  requireSameOrigin,
  HttpError,
} from "@/lib/server/http";
import { authorized, origin } from "@/lib/server/auth";
import { saveJobReview, listJobReviews } from "@/lib/server/job-review-history";
import { checkRateLimit } from "@/lib/server/rate-limiter";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return handle(async () => {
    const { user } = await authorized(request);
    const { id } = await params;
    return json(await listJobReviews(user.id, id));
  });
}
export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorized(request);
    checkRateLimit("job-review-save", user.id, {
      windowMs: 60000,
      maxRequests: 20,
    });
    const { id } = await params;
    const input = saveJobReviewSchema.parse(await readJson(request, 131072));
    if (input.documentId !== id)
      throw new HttpError(
        400,
        "REVIEW_TARGET",
        "The report target does not match this CV.",
      );
    return json(await saveJobReview(user.id, input));
  });
}
