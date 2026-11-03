import { createHash, randomUUID } from "node:crypto";
import type { Client, Row, Transaction } from "@libsql/client";
import { database } from "./database";
import { HttpError } from "./http";
import { logOperation } from "./logger";
import { documentSchema, type ResumeDocument } from "../document";
import { letterDocument } from "../letter-layout";
import type { ExportRequest } from "../export-contract";
import {
  APPLICATION_LIMITS,
  contactsSchema,
  createApplicationSchema,
  freezeDocumentSchema,
  frozenContentSchema,
  storedEventSchema,
  submissionSchema,
  updateApplicationSchema,
  type ApplicationDetail,
  type ApplicationSummary,
  type CreateApplication,
  type CreateSubmission,
  type DocumentSummary,
  type FreezeDocument,
  type FrozenContent,
  type FrozenDocument,
  type Stage,
  type Submission,
  type UpdateApplication,
} from "../applications";

type Connection = Client | Transaction;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const now = () => new Date().toISOString();

const notFound = () =>
  new HttpError(
    404,
    "APPLICATION_NOT_FOUND",
    "This application is not available in your account.",
  );
const changed = (message: string) =>
  new HttpError(409, "APPLICATION_CHANGED", message);
const limit = (message: string) =>
  new HttpError(409, "APPLICATION_LIMIT", message);

function isBusy(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  const message = error instanceof Error ? error.message : "";
  return (
    code === "SQLITE_BUSY" ||
    code === "TRANSACTION_ACTIVE" ||
    /SQLITE_BUSY|database is locked/i.test(message)
  );
}
function isUniqueViolation(error: unknown) {
  const text = `${(error as { code?: string })?.code ?? ""} ${error instanceof Error ? error.message : ""}`;
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(
    text,
  );
}

/**
 * Runs work in one write transaction. Concurrent writers do not wait inside
 * SQLite here (the in-memory client has one connection; files return
 * SQLITE_BUSY), so acquiring the transaction is retried with a short backoff.
 * Limits and idempotency checks inside the work are therefore serialized.
 */
async function write<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let tx: Transaction;
    try {
      tx = await database().client.transaction("write");
    } catch (error) {
      if (isBusy(error) && attempt < 40) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            5 + Math.random() * 20 * Math.min(attempt + 1, 5),
          ),
        );
        continue;
      }
      throw error;
    }
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      if (isBusy(error) && attempt < 40) {
        tx.close();
        await new Promise((resolve) =>
          setTimeout(resolve, 10 + Math.random() * 30),
        );
        continue;
      }
      throw error;
    } finally {
      tx.close();
    }
  }
}
const text = (value: unknown) =>
  value === null || value === undefined ? null : String(value);
function summary(row: Row): ApplicationSummary {
  return {
    id: String(row.id),
    company: String(row.company),
    role: String(row.role),
    jobUrl: text(row.job_url),
    location: text(row.location),
    source: text(row.source),
    stage: String(row.stage) as Stage,
    stageChangedAt: String(row.stage_changed_at),
    appliedAt: text(row.applied_at),
    nextActionAt: text(row.next_action_at),
    nextAction: text(row.next_action),
    resumeId: text(row.resume_id),
    sentCount: Number(row.sent_count ?? 0),
    documentCount: Number(row.document_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
const SUMMARY_COLUMNS =
  "a.id,a.company,a.role,a.job_url,a.location,a.source,a.stage,a.stage_changed_at,a.applied_at,a.next_action_at,a.next_action,a.resume_id,a.created_at,a.updated_at," +
  "(SELECT count(*) FROM application_submissions s WHERE s.owner_id=a.owner_id AND s.application_id=a.id) AS sent_count," +
  "(SELECT count(*) FROM application_documents d WHERE d.owner_id=a.owner_id AND d.application_id=a.id) AS document_count";

async function ownedRow(owner: string, id: string, client: Connection) {
  const row = (
    await client.execute({
      sql: "SELECT * FROM applications WHERE owner_id=? AND id=?",
      args: [owner, id],
    })
  ).rows[0];
  if (!row) throw notFound();
  return row;
}
async function insertEvent(
  tx: Transaction,
  owner: string,
  applicationId: string,
  event: {
    kind: "created" | "stage" | "sent";
    at: string;
    fromStage: Stage | null;
    toStage: Stage | null;
    submissionId: string | null;
  },
) {
  const parsed = storedEventSchema.parse({ id: randomUUID(), ...event });
  await tx.execute({
    sql: "INSERT INTO application_events(owner_id,application_id,id,at,kind,from_stage,to_stage,submission_id) VALUES (?,?,?,?,?,?,?,?)",
    args: [
      owner,
      applicationId,
      parsed.id,
      parsed.at,
      parsed.kind,
      parsed.fromStage,
      parsed.toStage,
      parsed.submissionId,
    ],
  });
}
const blank = (value: string | null | undefined) =>
  value === undefined
    ? undefined
    : value === null || value.trim() === ""
      ? null
      : value.trim();

export async function listApplications(
  owner: string,
  filters: { stage?: Stage; dueBy?: string } = {},
) {
  const where = ["a.owner_id=?"];
  const args: (string | number)[] = [owner];
  if (filters.stage) {
    where.push("a.stage=?");
    args.push(filters.stage);
  }
  if (filters.dueBy) {
    where.push("a.next_action_at IS NOT NULL AND a.next_action_at<=?");
    args.push(filters.dueBy);
  }
  const rows = (
    await database().client.execute({
      sql: `SELECT ${SUMMARY_COLUMNS} FROM applications a WHERE ${where.join(" AND ")} ORDER BY a.updated_at DESC, a.id`,
      args,
    })
  ).rows;
  return rows.map(summary);
}

export async function createApplication(owner: string, raw: CreateApplication) {
  const input = createApplicationSchema.parse(raw);
  const fingerprint = sha(JSON.stringify(input));
  const started = Date.now();
  const result = await write(async (tx) => {
    const prior = (
      await tx.execute({
        sql: "SELECT request_hash FROM applications WHERE owner_id=? AND id=?",
        args: [owner, input.requestId],
      })
    ).rows[0];
    if (prior) {
      if (prior.request_hash !== fingerprint)
        throw changed(
          "This request identifier was already used for a different application. Nothing was changed.",
        );
      return { id: input.requestId, created: false };
    }
    const total = Number(
      (
        await tx.execute({
          sql: "SELECT count(*) AS total FROM applications WHERE owner_id=?",
          args: [owner],
        })
      ).rows[0].total,
    );
    if (total >= APPLICATION_LIMITS.applicationsPerAccount)
      throw limit(
        `You can keep up to ${APPLICATION_LIMITS.applicationsPerAccount} applications. Delete an old one to add another; nothing was removed.`,
      );
    const at = now();
    await tx.execute({
      sql: "INSERT INTO applications(owner_id,id,company,role,job_url,location,source,stage,stage_changed_at,applied_at,next_action_at,next_action,notes,job_post,contacts,resume_id,request_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        owner,
        input.requestId,
        input.company,
        input.role,
        blank(input.jobUrl) ?? null,
        blank(input.location) ?? null,
        blank(input.source) ?? null,
        input.stage,
        at,
        input.appliedAt ?? null,
        input.nextActionAt ?? null,
        blank(input.nextAction) ?? null,
        input.notes,
        input.jobPost?.trim() ? input.jobPost : null,
        JSON.stringify(input.contacts),
        input.resumeId ?? null,
        fingerprint,
        at,
        at,
      ],
    });
    await insertEvent(tx, owner, input.requestId, {
      kind: "created",
      at,
      fromStage: null,
      toStage: input.stage,
      submissionId: null,
    });
    return { id: input.requestId, created: true };
  });
  logOperation({
    level: "info",
    event: result.created
      ? "application_created"
      : "application_create_replayed",
    durationMs: Date.now() - started,
    statusCode: 200,
    metadata: {
      stage: input.stage,
      contactCount: input.contacts.length,
      hasJobPost: Boolean(input.jobPost),
    },
  });
  return getApplication(owner, result.id);
}

async function detail(
  owner: string,
  id: string,
  client: Connection,
): Promise<ApplicationDetail> {
  const row = (
    await client.execute({
      sql: `SELECT ${SUMMARY_COLUMNS},a.notes,a.job_post,a.contacts FROM applications a WHERE a.owner_id=? AND a.id=?`,
      args: [owner, id],
    })
  ).rows[0];
  if (!row) throw notFound();
  const events = (
    await client.execute({
      sql: "SELECT id,at,kind,from_stage,to_stage,submission_id FROM application_events WHERE owner_id=? AND application_id=? ORDER BY at, rowid",
      args: [owner, id],
    })
  ).rows.map((event) =>
    storedEventSchema.parse({
      id: String(event.id),
      at: String(event.at),
      kind: String(event.kind),
      fromStage: text(event.from_stage),
      toStage: text(event.to_stage),
      submissionId: text(event.submission_id),
    }),
  );
  const documents = (
    await client.execute({
      sql: "SELECT id,kind,name,source_resume_id,source_revision,export_snapshot_id,sha256,created_at,json_extract(content,'$.photoOmitted') AS photo_omitted FROM application_documents WHERE owner_id=? AND application_id=? ORDER BY created_at, rowid",
      args: [owner, id],
    })
  ).rows.map(documentSummary);
  const submissions = (
    await client.execute({
      sql: "SELECT id,sent_at,stage_at_send,cv_document_id,letter_document_id,created_at FROM application_submissions WHERE owner_id=? AND application_id=? ORDER BY sent_at, rowid",
      args: [owner, id],
    })
  ).rows.map(submissionRow);
  return {
    ...summary(row),
    notes: String(row.notes),
    jobPost: text(row.job_post),
    contacts: contactsSchema.parse(JSON.parse(String(row.contacts))),
    events,
    documents,
    submissions,
  };
}
function documentSummary(row: Row): DocumentSummary {
  return {
    id: String(row.id),
    kind: String(row.kind) as "cv" | "cover_letter",
    name: String(row.name),
    sourceResumeId: text(row.source_resume_id),
    sourceRevision:
      row.source_revision === null ? null : Number(row.source_revision),
    exportSnapshotId: text(row.export_snapshot_id),
    sha256: String(row.sha256),
    createdAt: String(row.created_at),
    photoOmitted: Boolean(Number(row.photo_omitted ?? 0)),
  };
}
function submissionRow(row: Row): Submission {
  return {
    id: String(row.id),
    sentAt: String(row.sent_at),
    stageAtSend: String(row.stage_at_send) as Stage,
    cvDocumentId: String(row.cv_document_id),
    letterDocumentId: text(row.letter_document_id),
    createdAt: String(row.created_at),
  };
}

export async function getApplication(owner: string, id: string) {
  return detail(owner, id, database().client);
}

export async function updateApplication(
  owner: string,
  id: string,
  raw: UpdateApplication,
) {
  const input = updateApplicationSchema.parse(raw);
  let stageChanged = false;
  await write(async (tx) => {
    const row = await ownedRow(owner, id, tx);
    if (String(row.updated_at) !== input.updatedAt)
      throw changed(
        "This application changed in another tab or device. Reload it to see the latest version; your edit was not saved.",
      );
    let at = now();
    if (at <= String(row.updated_at))
      at = new Date(Date.parse(String(row.updated_at)) + 1).toISOString();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const set = (column: string, value: string | number | null | undefined) => {
      if (value === undefined) return;
      sets.push(`${column}=?`);
      args.push(value);
    };
    set("company", input.company);
    set("role", input.role);
    set("job_url", blank(input.jobUrl));
    set("location", blank(input.location));
    set("source", blank(input.source));
    set("applied_at", input.appliedAt);
    set("next_action_at", input.nextActionAt);
    set("next_action", blank(input.nextAction));
    set("notes", input.notes);
    set(
      "job_post",
      input.jobPost === undefined
        ? undefined
        : input.jobPost?.trim()
          ? input.jobPost
          : null,
    );
    set(
      "contacts",
      input.contacts === undefined ? undefined : JSON.stringify(input.contacts),
    );
    set("resume_id", input.resumeId);
    const from = String(row.stage) as Stage;
    if (input.stage && input.stage !== from) {
      stageChanged = true;
      set("stage", input.stage);
      set("stage_changed_at", at);
      await insertEvent(tx, owner, id, {
        kind: "stage",
        at,
        fromStage: from,
        toStage: input.stage,
        submissionId: null,
      });
    }
    set("updated_at", at);
    await tx.execute({
      sql: `UPDATE applications SET ${sets.join(",")} WHERE owner_id=? AND id=?`,
      args: [...args, owner, id],
    });
  });
  logOperation({
    level: "info",
    event: "application_updated",
    statusCode: 200,
    metadata: { stageChanged, stage: input.stage ?? null },
  });
  return getApplication(owner, id);
}

export async function deleteApplication(owner: string, id: string) {
  await write(async (tx) => {
    // An already-deleted application succeeds on retry, like job reviews.
    await tx.execute({
      sql: "DELETE FROM applications WHERE owner_id=? AND id=?",
      args: [owner, id],
    });
  });
  logOperation({
    level: "info",
    event: "application_deleted",
    statusCode: 200,
  });
}

/** Builds stored frozen content; a photo is dropped (and flagged) only when needed to fit 512 KB. */
export function frozenCvContent(doc: ResumeDocument): FrozenContent {
  const document = documentSchema.parse(doc);
  let content: FrozenContent = {
    schemaVersion: 1,
    kind: "cv",
    document,
    photoOmitted: false,
  };
  if (
    Buffer.byteLength(JSON.stringify(content), "utf8") >
      APPLICATION_LIMITS.documentBytes &&
    document.contact.photoUrl
  ) {
    content = {
      ...content,
      document: { ...document, contact: { ...document.contact, photoUrl: "" } },
      photoOmitted: true,
    };
  }
  return content;
}
export function frozenLetterContent(
  text: string,
  name: string,
  source: ResumeDocument | null,
): FrozenContent {
  const hadPhoto = Boolean(source?.contact.photoUrl);
  return {
    schemaVersion: 1,
    kind: "cover_letter",
    name,
    text,
    document: source
      ? documentSchema.parse(letterDocument(source, text))
      : null,
    photoOmitted: hadPhoto,
  };
}
function serialize(content: FrozenContent) {
  const serialized = JSON.stringify(frozenContentSchema.parse(content));
  if (Buffer.byteLength(serialized, "utf8") > APPLICATION_LIMITS.documentBytes)
    throw new HttpError(
      413,
      "APPLICATION_DOCUMENT_TOO_LARGE",
      "This document is larger than 512 KB, even without its photo. Nothing was saved.",
    );
  return serialized;
}
async function storedResume(owner: string, id: string, client: Connection) {
  const row = (
    await client.execute({
      sql: "SELECT document FROM resumes WHERE owner_id=? AND id=?",
      args: [owner, id],
    })
  ).rows[0];
  if (!row)
    throw new HttpError(
      404,
      "RESUME_NOT_FOUND",
      "This CV is not available in your account.",
    );
  return documentSchema.parse(JSON.parse(String(row.document)));
}

async function existingDocument(
  tx: Connection,
  owner: string,
  applicationId: string,
  requestId: string,
  fingerprint: string,
) {
  const prior = (
    await tx.execute({
      sql: "SELECT id,request_hash FROM application_documents WHERE owner_id=? AND application_id=? AND request_id=?",
      args: [owner, applicationId, requestId],
    })
  ).rows[0];
  if (!prior) return null;
  if (prior.request_hash !== fingerprint)
    throw changed(
      "This request identifier was already used for a different document. Nothing was saved.",
    );
  return String(prior.id);
}

export async function freezeDocument(
  owner: string,
  applicationId: string,
  raw: FreezeDocument,
) {
  const input = freezeDocumentSchema.parse(raw);
  const fingerprint = sha(JSON.stringify(input));
  let replayed = false;
  let documentId: string;
  try {
    documentId = await write(async (tx) => {
      await ownedRow(owner, applicationId, tx);
      const prior = await existingDocument(
        tx,
        owner,
        applicationId,
        input.requestId,
        fingerprint,
      );
      if (prior) {
        replayed = true;
        return prior;
      }
      const count = Number(
        (
          await tx.execute({
            sql: "SELECT count(*) AS total FROM application_documents WHERE owner_id=? AND application_id=?",
            args: [owner, applicationId],
          })
        ).rows[0].total,
      );
      if (count >= APPLICATION_LIMITS.documentsPerApplication)
        throw limit(
          `An application can keep up to ${APPLICATION_LIMITS.documentsPerApplication} documents. Nothing was saved.`,
        );
      let content: FrozenContent;
      let sourceResumeId: string | null = null;
      let sourceRevision: number | null = null;
      let snapshotId: string | null = null;
      const at = now();
      if (input.source === "snapshot") {
        const snapshot = (
          await tx.execute({
            sql: "SELECT content,source_resume_id,source_revision FROM export_snapshots WHERE owner_id=? AND id=? AND expires_at>?",
            args: [owner, input.snapshotId, at],
          })
        ).rows[0];
        if (!snapshot)
          throw new HttpError(
            404,
            "EXPORT_SNAPSHOT_NOT_FOUND",
            "The copy kept from this export has expired or was removed. Attach the CV from the editor instead.",
          );
        content = frozenContentSchema.parse(
          JSON.parse(String(snapshot.content)),
        );
        sourceResumeId = text(snapshot.source_resume_id);
        sourceRevision =
          snapshot.source_revision === null
            ? null
            : Number(snapshot.source_revision);
        snapshotId = input.snapshotId;
      } else if (input.source === "account") {
        const doc = await storedResume(owner, input.resumeId, tx);
        if (doc.revision !== input.revision)
          throw new HttpError(
            409,
            "REVISION_CONFLICT",
            "This CV changed after you chose it. Reload it and attach the version you sent.",
          );
        content = frozenCvContent(doc);
        sourceResumeId = doc.id;
        sourceRevision = doc.revision;
      } else if (input.source === "device") {
        content = frozenCvContent(input.document);
      } else {
        const letterhead = input.resumeId
          ? await storedResume(owner, input.resumeId, tx)
          : null;
        content = frozenLetterContent(input.text, input.name, letterhead);
        sourceResumeId = letterhead?.id ?? null;
        sourceRevision = letterhead?.revision ?? null;
      }
      const serialized = serialize(content);
      const id = randomUUID();
      const name = content.kind === "cv" ? content.document.name : content.name;
      await tx.execute({
        sql: "INSERT INTO application_documents(owner_id,application_id,id,kind,name,source_resume_id,source_revision,export_snapshot_id,content,sha256,created_at,request_id,request_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [
          owner,
          applicationId,
          id,
          content.kind,
          name.slice(0, 200),
          sourceResumeId,
          sourceRevision,
          snapshotId,
          serialized,
          sha(serialized),
          at,
          input.requestId,
          fingerprint,
        ],
      });
      if (snapshotId)
        await tx.execute({
          sql: "UPDATE export_snapshots SET claimed_at=? WHERE owner_id=? AND id=? AND claimed_at IS NULL",
          args: [at, owner, snapshotId],
        });
      await tx.execute({
        sql: "UPDATE applications SET updated_at=? WHERE owner_id=? AND id=?",
        args: [at, owner, applicationId],
      });
      return id;
    });
  } catch (error) {
    // A concurrent retry with the same requestId committed first.
    if (!isUniqueViolation(error)) throw error;
    const prior = await existingDocument(
      database().client,
      owner,
      applicationId,
      input.requestId,
      fingerprint,
    );
    if (!prior) throw error;
    replayed = true;
    documentId = prior;
  }
  logOperation({
    level: "info",
    event: replayed
      ? "application_document_replayed"
      : "application_document_frozen",
    statusCode: 200,
    metadata: { source: input.source },
  });
  return getFrozenDocument(owner, applicationId, documentId);
}

export async function getFrozenDocument(
  owner: string,
  applicationId: string,
  documentId: string,
): Promise<FrozenDocument> {
  const row = (
    await database().client.execute({
      sql: "SELECT id,kind,name,source_resume_id,source_revision,export_snapshot_id,sha256,created_at,content,json_extract(content,'$.photoOmitted') AS photo_omitted FROM application_documents WHERE owner_id=? AND application_id=? AND id=?",
      args: [owner, applicationId, documentId],
    })
  ).rows[0];
  if (!row) throw notFound();
  return {
    ...documentSummary(row),
    content: frozenContentSchema.parse(JSON.parse(String(row.content))),
  };
}

export async function createSubmission(
  owner: string,
  applicationId: string,
  raw: CreateSubmission,
) {
  const input = submissionSchema.parse(raw);
  const fingerprint = sha(JSON.stringify(input));
  let replayed = false;
  const id = await write(async (tx) => {
    const app = await ownedRow(owner, applicationId, tx);
    const prior = (
      await tx.execute({
        sql: "SELECT id,request_hash FROM application_submissions WHERE owner_id=? AND application_id=? AND request_id=?",
        args: [owner, applicationId, input.requestId],
      })
    ).rows[0];
    if (prior) {
      if (prior.request_hash !== fingerprint)
        throw changed(
          "This request identifier was already used for a different submission. Nothing was saved.",
        );
      replayed = true;
      return String(prior.id);
    }
    const kinds = new Map(
      (
        await tx.execute({
          sql: "SELECT id,kind FROM application_documents WHERE owner_id=? AND application_id=?",
          args: [owner, applicationId],
        })
      ).rows.map((row) => [String(row.id), String(row.kind)]),
    );
    if (
      kinds.get(input.cvDocumentId) !== "cv" ||
      (input.letterDocumentId &&
        kinds.get(input.letterDocumentId) !== "cover_letter")
    )
      throw new HttpError(
        400,
        "APPLICATION_DOCUMENT_MISMATCH",
        "Choose a CV and an optional letter saved on this application.",
      );
    const at = now();
    const submissionId = randomUUID();
    const stage = String(app.stage) as Stage;
    await tx.execute({
      sql: "INSERT INTO application_submissions(owner_id,application_id,id,sent_at,stage_at_send,cv_document_id,letter_document_id,request_id,request_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [
        owner,
        applicationId,
        submissionId,
        input.sentAt,
        stage,
        input.cvDocumentId,
        input.letterDocumentId ?? null,
        input.requestId,
        fingerprint,
        at,
      ],
    });
    await insertEvent(tx, owner, applicationId, {
      kind: "sent",
      at,
      fromStage: null,
      toStage: null,
      submissionId,
    });
    if (stage === "saved") {
      // Sending moves a saved job to Applied, recorded as a stage event.
      await insertEvent(tx, owner, applicationId, {
        kind: "stage",
        at,
        fromStage: "saved",
        toStage: "applied",
        submissionId: null,
      });
      await tx.execute({
        sql: "UPDATE applications SET stage='applied',stage_changed_at=?,applied_at=coalesce(applied_at,?),updated_at=? WHERE owner_id=? AND id=?",
        args: [at, input.sentAt.slice(0, 10), at, owner, applicationId],
      });
    } else
      await tx.execute({
        sql: "UPDATE applications SET updated_at=? WHERE owner_id=? AND id=?",
        args: [at, owner, applicationId],
      });
    return submissionId;
  });
  logOperation({
    level: "info",
    event: replayed
      ? "application_submission_replayed"
      : "application_submission_created",
    statusCode: 200,
    metadata: { withLetter: Boolean(input.letterDocumentId) },
  });
  const app = await getApplication(owner, applicationId);
  return {
    submission: app.submissions.find((row) => row.id === id)!,
    application: app,
  };
}

// Export snapshots (review finding 6): the exact document an export rendered.

/** Deletes expired snapshots. Called on every snapshot write and by the retention script. */
export async function purgeExpiredSnapshots(
  client: Connection = database().client,
  at = now(),
) {
  return (
    await client.execute({
      sql: "DELETE FROM export_snapshots WHERE expires_at<=?",
      args: [at],
    })
  ).rowsAffected;
}

export async function createExportSnapshot(
  owner: string,
  input: {
    format: string;
    sourceResumeId: string | null;
    sourceRevision: number | null;
    content: FrozenContent;
  },
) {
  let serialized: string;
  try {
    serialized = serialize(input.content);
  } catch {
    return null; // Too large to keep; the export itself still succeeds.
  }
  const id = randomUUID();
  const created = new Date();
  const expires = new Date(
    created.getTime() + APPLICATION_LIMITS.snapshotDays * 86_400_000,
  );
  await write(async (tx) => {
    await purgeExpiredSnapshots(tx, created.toISOString());
    await tx.execute({
      sql: "INSERT INTO export_snapshots(owner_id,id,kind,format,source_resume_id,source_revision,content,sha256,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [
        owner,
        id,
        input.content.kind,
        input.format,
        input.sourceResumeId,
        input.sourceRevision,
        serialized,
        sha(serialized),
        created.toISOString(),
        expires.toISOString(),
      ],
    });
    // Keep at most 20 unclaimed per account: the oldest are dropped.
    await tx.execute({
      sql: "DELETE FROM export_snapshots WHERE owner_id=? AND claimed_at IS NULL AND id NOT IN (SELECT id FROM export_snapshots WHERE owner_id=? AND claimed_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT ?)",
      args: [owner, owner, APPLICATION_LIMITS.unclaimedSnapshots],
    });
  });
  logOperation({
    level: "info",
    event: "export_snapshot_created",
    statusCode: 200,
    metadata: { kind: input.content.kind, format: input.format },
  });
  return id;
}

/**
 * The export service's receipt: CV and cover letter exports keep exactly the
 * document rendered (account or device CV, or the letter text as edited).
 * JSON backups get none. A failure never fails the export.
 */
export async function exportReceipt(
  owner: string,
  input: ExportRequest,
  doc: ResumeDocument,
) {
  if (input.kind === "resume" && input.format === "json") return null;
  if (input.source.storage === "frozen") return null;
  const account = input.source.storage === "account";
  return createExportSnapshot(owner, {
    format: input.format,
    sourceResumeId: account ? doc.id : null,
    sourceRevision: account ? doc.revision : null,
    content:
      input.kind === "letter"
        ? frozenLetterContent(input.text, input.name, doc)
        : frozenCvContent(doc),
  }).catch(() => null);
}

export async function getExportSnapshot(owner: string, id: string) {
  const row = (
    await database().client.execute({
      sql: "SELECT id,kind,format,source_resume_id,source_revision,created_at,expires_at,claimed_at,content FROM export_snapshots WHERE owner_id=? AND id=? AND expires_at>?",
      args: [owner, id, now()],
    })
  ).rows[0];
  if (!row)
    throw new HttpError(
      404,
      "EXPORT_SNAPSHOT_NOT_FOUND",
      "The copy kept from this export has expired or was removed.",
    );
  const content = frozenContentSchema.parse(JSON.parse(String(row.content)));
  return {
    id: String(row.id),
    kind: String(row.kind) as "cv" | "cover_letter",
    format: String(row.format),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    claimed: row.claimed_at !== null,
    name: content.kind === "cv" ? content.document.name : content.name,
    sourceResumeId: text(row.source_resume_id),
    sourceRevision:
      row.source_revision === null ? null : Number(row.source_revision),
  };
}

/** Dismissing "Record this as an application?" deletes the snapshot at once. */
export async function deleteExportSnapshot(owner: string, id: string) {
  await database().client.execute({
    sql: "DELETE FROM export_snapshots WHERE owner_id=? AND id=?",
    args: [owner, id],
  });
}

const parseJson = (value: unknown) => JSON.parse(String(value));
/** Every tracker table plus export snapshots that still exist, for account-data export. */
export async function exportApplicationData(
  owner: string,
  client: Connection = database().client,
) {
  type Record_ = Record<string, unknown>;
  const rows = async (sql: string) =>
    (await client.execute({ sql, args: [owner] })).rows.map(
      (row) => ({ ...row }) as Record_,
    );
  const applications = (
    await rows(
      "SELECT * FROM applications WHERE owner_id=? ORDER BY created_at",
    )
  ).map((row): Record_ => {
    const { owner_id: _owner, request_hash: _hash, ...rest } = row;
    return {
      ...rest,
      contacts: parseJson(row.contacts),
      requirements: parseJson(row.requirements),
    };
  });
  const applicationEvents = await rows(
    "SELECT application_id,id,at,kind,from_stage,to_stage,submission_id FROM application_events WHERE owner_id=? ORDER BY at",
  );
  const applicationDocuments = (
    await rows(
      "SELECT application_id,id,kind,name,source_resume_id,source_revision,export_snapshot_id,content,sha256,created_at FROM application_documents WHERE owner_id=? ORDER BY created_at",
    )
  ).map((row): Record_ => ({ ...row, content: parseJson(row.content) }));
  const applicationSubmissions = await rows(
    "SELECT application_id,id,sent_at,stage_at_send,cv_document_id,letter_document_id,created_at FROM application_submissions WHERE owner_id=? ORDER BY sent_at",
  );
  const exportSnapshots = (
    await rows(
      "SELECT id,kind,format,source_resume_id,source_revision,content,sha256,created_at,expires_at,claimed_at FROM export_snapshots WHERE owner_id=? ORDER BY created_at",
    )
  ).map((row): Record_ => ({ ...row, content: parseJson(row.content) }));
  return {
    applications,
    applicationEvents,
    applicationDocuments,
    applicationSubmissions,
    exportSnapshots,
  };
}
