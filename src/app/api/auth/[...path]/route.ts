import { auth, origin } from "@/lib/server/auth";
import { handle, HttpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const path = new URL(request.url).pathname;
    if (
      path !== "/api/auth/verify-email" &&
      path !== "/api/auth/callback/google" &&
      !/^\/api\/auth\/reset-password\/[^/]+$/.test(path)
    )
      throw new HttpError(
        404,
        "NOT_FOUND",
        "This authentication route is unavailable.",
      );
    const response = await auth().handler(
      new Request(`${origin()}${path}${new URL(request.url).search}`, request),
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  });
}
