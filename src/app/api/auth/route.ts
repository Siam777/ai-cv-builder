import { authRequestSchema } from "@/lib/cloud-contract";
import { handle, readJson, requireSameOrigin } from "@/lib/server/http";
import { auth, authorized, origin } from "@/lib/server/auth";
import { requireEmailDelivery } from "@/lib/server/auth-email";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const body = authRequestSchema.parse(await readJson(request, 4096));
    if (body.action === "reset" || body.action === "verify")
      requireEmailDelivery();
    const session = body.action === "verify" ? await authorized(request) : null;
    const path =
      body.action === "reset"
        ? "request-password-reset"
        : body.action === "complete-reset"
          ? "reset-password"
          : body.action === "verify"
            ? "send-verification-email"
            : body.action === "signin"
              ? "sign-in/email"
              : body.action === "signup"
                ? "sign-up/email"
                : "sign-out";
    const payload =
      body.action === "reset"
        ? { email: body.email, redirectTo: `${origin()}/auth/reset-password` }
        : body.action === "complete-reset"
          ? { token: body.token, newPassword: body.password }
          : body.action === "verify"
            ? {
                email: session!.user.email,
                callbackURL: `${origin()}/auth/complete`,
              }
            : body.action === "signout"
              ? {}
              : {
                  email: body.email,
                  password: body.password,
                  ...(body.action === "signup"
                    ? {
                        name: body.email.split("@")[0],
                        callbackURL: `${origin()}/auth/complete`,
                      }
                    : {}),
                };
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.set("content-type", "application/json");
    const response = await auth().handler(
      new Request(`${origin()}/api/auth/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
