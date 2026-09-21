import { randomUUID } from "node:crypto";
import { type Client, type Transaction } from "@libsql/client";
import { documentSchema, type ResumeDocument } from "../document";
import { HttpError } from "./http";
import { database } from "./database";
const conflict = () =>
  new HttpError(
    409,
    "REVISION_CONFLICT",
    "This resume changed or was deleted elsewhere. Download a recovery backup before reloading.",
  );
type Connection = Client | Transaction;
const parse = (value: unknown) =>
  documentSchema.parse(JSON.parse(String(value)));
export async function listResumes(
  owner: string,
  client: Connection = database().client,
) {
  const result = await client.execute({
    sql: "SELECT document FROM resumes WHERE owner_id = ? ORDER BY updated_at DESC",
    args: [owner],
  });
  return result.rows.map((row) => parse(row.document));
}
export async function getResume(owner: string, id: string) {
  const result = await database().client.execute({
    sql: "SELECT document FROM resumes WHERE owner_id = ? AND id = ?",
    args: [owner, id],
  });
  if (!result.rows.length)
    throw new HttpError(
      404,
      "NOT_FOUND",
      "This resume is not available in your account.",
    );
  return parse(result.rows[0].document);
}
export async function saveResume(
  owner: string,
  input: ResumeDocument,
  expected: number | null,
  client: Connection = database().client,
) {
  const doc = documentSchema.parse({
    ...input,
    revision: (expected ?? -1) + 1,
    updatedAt: new Date().toISOString(),
  });
  const result =
    expected === null
      ? await client.execute({
          sql: "INSERT INTO resumes(owner_id,id,revision,updated_at,document) VALUES (?,?,?,?,?) ON CONFLICT(owner_id,id) DO NOTHING",
          args: [
            owner,
            doc.id,
            doc.revision,
            doc.updatedAt,
            JSON.stringify(doc),
          ],
        })
      : await client.execute({
          sql: "UPDATE resumes SET revision=?, updated_at=?, document=? WHERE owner_id=? AND id=? AND revision=?",
          args: [
            doc.revision,
            doc.updatedAt,
            JSON.stringify(doc),
            owner,
            doc.id,
            expected,
          ],
        });
  if (result.rowsAffected !== 1) throw conflict();
  return doc;
}
export async function removeResume(
  owner: string,
  id: string,
  revision: number,
) {
  const result = await database().client.execute({
    sql: "DELETE FROM resumes WHERE owner_id=? AND id=? AND revision=?",
    args: [owner, id, revision],
  });
  if (result.rowsAffected !== 1) throw conflict();
}
export async function receipts(
  owner: string,
  client: Connection = database().client,
) {
  return (
    await client.execute({
      sql: "SELECT source_id,resume_id,imported_at FROM resume_imports WHERE owner_id=?",
      args: [owner],
    })
  ).rows;
}
export async function importResumes(
  owner: string,
  documents: ResumeDocument[],
) {
  const tx = await database().client.transaction("write");
  try {
    const result = [];
    for (const source of documents) {
      const existing = await tx.execute({
        sql: "SELECT resume_id FROM resume_imports WHERE owner_id=? AND source_id=?",
        args: [owner, source.id],
      });
      if (existing.rows.length) {
        result.push({
          sourceId: source.id,
          resumeId: String(existing.rows[0].resume_id),
          status: "already_imported",
        });
        continue;
      }
      const id = randomUUID();
      const doc = await saveResume(owner, { ...source, id }, null, tx);
      await tx.execute({
        sql: "INSERT INTO resume_imports VALUES (?,?,?,?)",
        args: [owner, source.id, id, doc.updatedAt],
      });
      result.push({ sourceId: source.id, resumeId: id, status: "imported" });
    }
    await tx.commit();
    return result;
  } finally {
    tx.close();
  }
}
