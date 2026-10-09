import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
const date = (name: string) =>
  integer(name, { mode: "timestamp_ms" }).notNull();
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: date("createdAt"),
  updatedAt: date("updatedAt"),
});
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: date("expiresAt"),
  token: text("token").notNull().unique(),
  createdAt: date("createdAt"),
  updatedAt: date("updatedAt"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: date("createdAt"),
  updatedAt: date("updatedAt"),
});
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: date("expiresAt"),
  createdAt: date("createdAt"),
  updatedAt: date("updatedAt"),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  planId: text("plan_id").notNull(), // 'free' | 'job_hunter_monthly' | 'job_hunter_weekly' | 'lifetime'
  status: text("status").notNull(), // 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  currentPeriodEnd: integer("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptionUsage = sqliteTable("subscription_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  periodMonth: text("period_month").notNull(), // 'YYYY-MM'
  tailoredResumesGenerated: integer("tailored_resumes_generated").default(0),
  aiBulletRewrites: integer("ai_bullet_rewrites").default(0),
});

