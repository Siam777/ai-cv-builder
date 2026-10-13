import { z } from "zod";
import {
  handle,
  HttpError,
  json,
  readJson,
  requireSameOrigin,
} from "@/lib/server/http";
import { auth, authorized, origin } from "@/lib/server/auth";
import {
  emailDeliveryMode,
  exportVerificationSatisfied,
} from "@/lib/server/auth-email";
import { googleProvider } from "@/lib/server/google-config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const value = await auth().api.getSession({ headers: request.headers });
    const accounts = value
      ? await auth().api.listUserAccounts({ headers: request.headers })
      : [];
    return json({
      configured: true,
      user: value
        ? {
            id: value.user.id,
            email: value.user.email,
            name: value.user.name,
            emailVerified: value.user.emailVerified,
            canExport: exportVerificationSatisfied(value.user.emailVerified),
          }
        : null,
      emailDelivery: emailDeliveryMode(),
      googleConfigured: Boolean(googleProvider()),
      googleLinked: accounts.some((account) => account.providerId === "google"),
      hasPassword: accounts.some(
        (account) => account.providerId === "credential",
      ),
      canDeleteAccount: true,
    });
  });
}
export async function DELETE(request: Request) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const session = await authorized(request);
    const body = z
      .strictObject({
        password: z.string().min(1).max(128).optional(),
        confirmation: z.literal("DELETE MY ACCOUNT"),
      })
      .parse(await readJson(request, 4096));
    const accounts = await auth().api.listUserAccounts({
      headers: request.headers,
    });
    if (
      accounts.some((account) => account.providerId === "credential") &&
      !body.password
    )
      throw new HttpError(
        400,
        "PASSWORD_REQUIRED",
        "Confirm your current password to delete this account.",
      );
    if (
      !body.password &&
      Date.now() - new Date(session.session.createdAt).getTime() >= 600_000
    )
      throw new HttpError(
        403,
        "RECENT_SIGN_IN_REQUIRED",
        "Sign in with Google again, then confirm deletion within ten minutes. Your CVs are kept until deletion succeeds.",
      );
    const response = await auth().api.deleteUser({
      headers: request.headers,
      body: body.password ? { password: body.password } : {},
      asResponse: true,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
