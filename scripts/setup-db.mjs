import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());
if (!process.env.TURSO_DATABASE_URL && process.env.NODE_ENV !== "production") {
  await mkdir("data", { recursive: true });
  let contents = await readFile(".env.local", "utf8").catch(() => "");
  if (!process.env.BETTER_AUTH_SECRET) {
    contents += `\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\n`;
    await writeFile(".env.local", contents, { mode: 0o600 });
  }
}
const url = process.env.TURSO_DATABASE_URL || "file:./data/cv-builder.db";
if (
  process.env.NODE_ENV === "production" &&
  (!url.startsWith("libsql://") || !process.env.TURSO_AUTH_TOKEN)
)
  throw new Error("Configure Turso before production migration.");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    // Line endings depend on the checkout (core.autocrlf), so a migration is
    // recorded with LF endings and either form of a recorded checksum matches.
    const sql = (await readFile(`migrations/${name}`, "utf8")).replace(/\r\n/g, "\n");
    const hash = (text) => createHash("sha256").update(text).digest("hex");
    const checksum = hash(sql);
    const accepted = [checksum, hash(sql.replace(/\n/g, "\r\n"))];
    const tx = await client.transaction("write");
    try {
      const old = await tx.execute({
        sql: "SELECT checksum FROM schema_migrations WHERE name = ?",
        args: [name],
      });
      if (old.rows.length && !accepted.includes(String(old.rows[0].checksum)))
        throw new Error(`Applied migration changed: ${name}`);
      if (!old.rows.length) {
        for (const statement of sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean))
          await tx.execute(statement);
        await tx.execute({
          sql: "INSERT INTO schema_migrations VALUES (?,?,?)",
          args: [name, checksum, new Date().toISOString()],
        });
      }
      await tx.commit();
    } finally {
      tx.close();
    }
    console.log(`Migration ready: ${name}`);
  }
} finally {
  client.close();
}
