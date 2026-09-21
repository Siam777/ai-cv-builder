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
