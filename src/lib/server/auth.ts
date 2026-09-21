import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { database } from "./database";
import * as schema from "./schema";
import { HttpError } from "./http";

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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: { deleteUser: { enabled: true } },
    rateLimit: { enabled: true },
    logger: { disabled: true },
  });
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
