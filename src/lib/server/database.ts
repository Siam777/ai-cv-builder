import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function connectDatabase(
  url = process.env.TURSO_DATABASE_URL || "file:./data/cv-builder.db",
  authToken = process.env.TURSO_AUTH_TOKEN,
) {
  if (
    process.env.NODE_ENV === "production" &&
    (!url.startsWith("libsql://") || !authToken)
  )
    throw new Error(
      "Production requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  const client = createClient({ url, authToken });
  return { client, db: drizzle(client, { schema }) };
}
let connection: ReturnType<typeof connectDatabase> | undefined;
export function database() {
  return (connection ??= connectDatabase());
}
export async function enableForeignKeys(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
}
