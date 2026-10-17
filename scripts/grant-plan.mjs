// Gives an existing account a paid plan without Stripe, for testing Go or Pro.
// It never creates accounts or passwords.
//
//   node scripts/grant-plan.mjs --email you@example.com --plan pro [--days 365]
//   node scripts/grant-plan.mjs --email you@example.com --plan free   # removes it
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const email = arg("email")?.trim().toLowerCase();
const plan = arg("plan", "pro");
const days = Number(arg("days", "365"));
if (!email) throw new Error("Pass --email of an existing account.");
if (!["free", "go", "pro"].includes(plan)) throw new Error("--plan must be free, go or pro.");
if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("--days must be 1 to 3650.");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./data/cv-builder.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const user = (
  await client.execute({ sql: 'SELECT id FROM "user" WHERE lower(email) = ?', args: [email] })
).rows[0];
if (!user) throw new Error(`No account with the email ${email}.`);

if (plan === "free") {
  await client.execute({ sql: "DELETE FROM subscriptions WHERE user_id = ? AND stripe_customer_id LIKE 'local_grant_%'", args: [user.id] });
  console.log(`Removed the granted plan from ${email}.`);
} else {
  const existing = (
    await client.execute({ sql: "SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?", args: [user.id] })
  ).rows[0];
  if (existing && !String(existing.stripe_customer_id).startsWith("local_grant_"))
    throw new Error("This account has a Stripe subscription; change it in Stripe instead.");
  const now = new Date().toISOString();
  const periodEnd = Math.floor(Date.now() / 1000) + days * 86_400;
  await client.execute({
    sql: `INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, created_at, updated_at)
          VALUES (?, ?, ?, NULL, ?, 'active', ?, 0, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, status = 'active', current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`,
    args: [`sub_${randomUUID()}`, user.id, `local_grant_${user.id}`, plan, periodEnd, now, now],
  });
  console.log(`${email} now has ${plan} until ${new Date(periodEnd * 1000).toISOString().slice(0, 10)}.`);
}
client.close();
