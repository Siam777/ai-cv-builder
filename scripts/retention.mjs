// Deletes expired temporary records. Run on a schedule (for example daily):
//   npm run db:retention
// Export snapshots (export receipts kept so an export can be recorded as an
// application) expire after 7 days. Snapshot writes also purge expired rows.
import { createClient } from "@libsql/client";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());
const url = process.env.TURSO_DATABASE_URL || "file:./data/cv-builder.db";
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const result = await client.execute({
    sql: "DELETE FROM export_snapshots WHERE expires_at <= ?",
    args: [new Date().toISOString()],
  });
  console.log(`Expired export snapshots deleted: ${result.rowsAffected}`);
} finally {
  client.close();
}
