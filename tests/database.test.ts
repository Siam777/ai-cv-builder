import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDocument } from "../src/lib/document";

test("SQLite transactions roll back partial imports and account deletion cascades", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { database } = await import("../src/lib/server/database");
  const { importResumes, listResumes, receipts } =
    await import("../src/lib/server/resumes");
  const { client } = database();
  try {
    const sql = await readFile("migrations/001-foundation.sql", "utf8");
    await client.executeMultiple(sql);
    await client.execute(
      "INSERT INTO user VALUES ('owner','Test','synthetic@example.test',0,NULL,0,0)",
    );
    const valid = createDocument();
    const invalid = { ...createDocument(), name: "" };
    await assert.rejects(importResumes("owner", [valid, invalid]));
    assert.equal((await listResumes("owner")).length, 0);
    assert.equal((await receipts("owner")).length, 0);
    await importResumes("owner", [valid]);
    assert.equal((await listResumes("owner")).length, 1);
    await client.execute("DELETE FROM user WHERE id='owner'");
    assert.equal((await listResumes("owner")).length, 0);
    assert.equal((await receipts("owner")).length, 0);
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
  }
});
