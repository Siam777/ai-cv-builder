import { z } from "zod";
import { auth, authorized, origin } from "@/lib/server/auth";
import { googleProvider } from "@/lib/server/google-config";
import {
  handle,
  HttpError,
  readJson,
  requireSameOrigin,
} from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { action, flow } = z
      .strictObject({ action: z.enum(["signin", "link"]), flow: z.uuid() })
      .parse(await readJson(request, 1024));
    if (!googleProvider())
      throw new HttpError(
        503,
        "GOOGLE_UNAVAILABLE",
        "Google sign-in is not configured here. Use email and password; your draft stays in this tab.",
      );
    if (action === "link") {
      const session = await authorized(request);
      if (!session.user.emailVerified)
        throw new HttpError(
          403,
          "EMAIL_VERIFICATION_REQUIRED",
          "Verify your account email before linking Google.",
        );
      if (Date.now() - new Date(session.session.createdAt).getTime() >= 600_000)
        throw new HttpError(
          403,
          "RECENT_SIGN_IN_REQUIRED",
          "Sign in again before linking Google. Your current draft is kept.",
        );
    }
    const callbackURL = `${origin()}/auth/google-complete?mode=${action}&flow=${flow}`;
    const body = {
      provider: "google" as const,
      callbackURL,
      errorCallbackURL: callbackURL,
      disableRedirect: true,
    };
    // Use the HTTP handler so Better Auth's rate limiting also covers OAuth starts.
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.set("content-type", "application/json");
    const path = action === "link" ? "link-social" : "sign-in/social";
    const response = await auth().handler(
      new Request(`${origin()}/api/auth/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
