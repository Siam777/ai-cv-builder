import { authRequestSchema } from "@/lib/cloud-contract";
import {
  handle,
  HttpError,
  readJson,
  requireSameOrigin,
} from "@/lib/server/http";
import { auth, origin } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const body = authRequestSchema.parse(await readJson(request, 4096));
    if (body.action === "reset")
      throw new HttpError(
        501,
        "EMAIL_NOT_CONFIGURED",
        "Password recovery email is not configured on this installation.",
      );
    const path =
      body.action === "signin"
        ? "sign-in/email"
        : body.action === "signup"
          ? "sign-up/email"
          : "sign-out";
    const payload =
      body.action === "signout"
        ? {}
        : {
            email: body.email,
            password: body.password,
            ...(body.action === "signup"
              ? { name: body.email.split("@")[0] }
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
