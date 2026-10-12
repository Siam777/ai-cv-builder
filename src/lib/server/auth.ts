import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { database } from "./database";
import * as schema from "./schema";
import { HttpError } from "./http";
import { after } from "next/server";
import { emailDeliveryMode, sendAuthEmail } from "./auth-email";
import { googleProvider } from "./google-config";

export const origin = () => process.env.APP_ORIGIN || "http://localhost:3000";
let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  return (instance ??= createAuth());
}
function createAuth() {
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error("Run npm run db:setup and configure BETTER_AUTH_SECRET.");
  return betterAuth({
    database: drizzleAdapter(database().db, {
      provider: "sqlite",
      schema,
      transaction: true,
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: origin(),
    trustedOrigins: [origin()],
    socialProviders: { google: googleProvider() },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        updateUserInfoOnLink: false,
      },
    },
    session: { freshAge: 600 },
    onAPIError: { errorURL: `${origin()}/auth/google-complete` },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Schedule delivery after the generic response, including on serverless hosts.
        after(async () => {
          try {
            await sendAuthEmail(user.email, url, "recovery");
          } catch {
            console.error("auth_email_delivery_failed: recovery");
          }
        });
      },
    },
    emailVerification: {
      expiresIn: 86400,
      sendOnSignUp: emailDeliveryMode() !== "unconfigured",
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail(user.email, url, "verification");
      },
    },
    user: { deleteUser: { enabled: true } },
    rateLimit: { enabled: true },
    logger: { disabled: true },
  });
}
export async function authorizedExport(request: Request) {
  const session = await authorized(request);
  if (!session.user.emailVerified)
    throw new HttpError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verify your email before exporting. Your draft and chosen format are kept.",
    );
  return session;
}
export async function authorized(request: Request) {
  const value = await auth().api.getSession({ headers: request.headers });
  if (!value)
    throw new HttpError(
      401,
      "SIGN_IN_REQUIRED",
      "Sign in again to access your account. Your current edits are kept.",
    );
  if (request.headers.get("X-Workspace-User") !== value.user.id)
    throw new HttpError(
      409,
      "WORKSPACE_CHANGED",
      "The signed-in account changed. Keep a recovery backup and reopen the correct account workspace.",
    );
  return value;
}
