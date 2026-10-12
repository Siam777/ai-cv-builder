import { createHash } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { database } from "./database";
import { documentSchema, type ResumeDocument } from "../document";
import { HttpError } from "./http";
import {
  reviewJobEvidence,
  reviewSnapshot,
  calculateJobMatches,
  coverageGroups,
  JOB_EVIDENCE_VERSION,
  JOB_TERMS_VERSION,
} from "../vault/job-evidence";
import {
  saveJobReviewSchema,
  storedJobReviewSchema,
  reviewSummarySchema,
  REVIEW_HISTORY_LIMIT,
  REVIEW_ACCOUNT_LIMIT,
  REVIEW_REPORT_BYTES,
  type SaveJobReview,
  type StoredJobReview,
} from "../job-review-history";
type Connection = Client | Transaction;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const missing = () =>
  new HttpError(
    404,
    "REVIEW_NOT_FOUND",
    "This CV or report is not available in your account.",
  );
async function ownedResume(owner: string, id: string, client: Connection) {
  const row = (
    await client.execute({
      sql: "SELECT document FROM resumes WHERE owner_id=? AND id=?",
      args: [owner, id],
    })
  ).rows[0];
  if (!row) throw missing();
  return documentSchema.parse(JSON.parse(String(row.document)));
}
const parse = (raw: unknown) =>
  storedJobReviewSchema.parse(JSON.parse(String(raw)));
function stale(report: StoredJobReview, doc: ResumeDocument) {
  return (
    report.sourceHash !== sha(reviewSnapshot(doc)) ||
    report.version !== JOB_EVIDENCE_VERSION ||
    report.termsVersion !== JOB_TERMS_VERSION
  );
}
export async function saveJobReview(owner: string, raw: SaveJobReview) {
  const input = saveJobReviewSchema.parse(raw);
  const fingerprint = sha(
    JSON.stringify({
      ...input,
      priorityOverrides: [...input.priorityOverrides].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    }),
  );
  const tx = await database().client.transaction("write");
  try {
    const doc = await ownedResume(owner, input.documentId, tx);
    const prior = (
      await tx.execute({
        sql: "SELECT report,request_hash FROM job_reviews WHERE owner_id=? AND id=?",
        args: [owner, input.requestId],
      })
    ).rows[0];
    if (prior) {
      if (prior.request_hash !== fingerprint)
        throw new HttpError(
          409,
          "REVIEW_REQUEST_CHANGED",
          "This save identifier was already used for another review.",
        );
      const report = parse(prior.report);
      await tx.commit();
      return report;
    }
    if (
      doc.revision !== input.revision ||
      sha(reviewSnapshot(doc)) !== input.sourceHash
    )
      throw new HttpError(
        409,
        "REVIEW_STALE",
        "The saved CV changed after this review. Reopen it and analyze again.",
      );
    if (
      input.rulesVersion !== JOB_EVIDENCE_VERSION ||
      input.termsVersion !== JOB_TERMS_VERSION
    )
      throw new HttpError(
        409,
        "REVIEW_RULES_CHANGED",
        "The review rules changed. Analyze the posting again before saving.",
      );
    const counts = (
      await tx.execute({
        sql: "SELECT count(*) AS total,sum(CASE WHEN resume_id=? THEN 1 ELSE 0 END) AS per_resume FROM job_reviews WHERE owner_id=?",
        args: [input.documentId, owner],
      })
    ).rows[0];
    if (
      Number(counts.total) >= REVIEW_ACCOUNT_LIMIT ||
      Number(counts.per_resume) >= REVIEW_HISTORY_LIMIT
    )
      throw new HttpError(
        409,
        "REVIEW_HISTORY_FULL",
        "History is full (20 per CV, 100 per account). Delete an older report before saving another; nothing was removed.",
      );
    let review;
    try {
      review = await reviewJobEvidence(doc, input.jobText, input.target);
    } catch (error) {
      throw new HttpError(
        400,
        "REVIEW_INPUT",
        error instanceof Error ? error.message : "Use a shorter posting or CV.",
      );
    }
    if (review.jobHash !== input.jobHash)
      throw new HttpError(
        409,
        "REVIEW_JOB_CHANGED",
        "The job posting does not match this review. Analyze it again.",
      );
    const overrides = new Map(
      input.priorityOverrides.map((row) => [row.id, row.priority]),
    );
    if (
      input.priorityOverrides.some(
        (row) => !review.matches.some((match) => match.criterion.id === row.id),
      )
    )
      throw new HttpError(
        400,
        "REVIEW_PRIORITY",
        "A reviewed priority does not refer to this posting.",
      );
    const criteria = review.matches.map((match) =>
      overrides.has(match.criterion.id)
        ? {
            ...match.criterion,
            priority: overrides.get(match.criterion.id)!,
            priorityOrigin: "candidate_review" as const,
          }
        : match.criterion,
    );
    const matches = calculateJobMatches(criteria, doc, input.target.language);
    const { sourceSnapshot, ...data } = review;
    const report = storedJobReviewSchema.parse({
      ...data,
      matches,
      groups: coverageGroups(matches),
      id: input.requestId,
      savedAt: new Date().toISOString(),
      schemaVersion: 1,
      method: "local_text_rules",
      modelVersion: null,
      promptVersion: null,
    });
    const serialized = JSON.stringify(report);
    if (Buffer.byteLength(serialized, "utf8") > REVIEW_REPORT_BYTES)
      throw new HttpError(
        413,
        "REVIEW_TOO_LARGE",
        "This report exceeds 512 KB. Review a shorter posting/CV excerpt; nothing was saved.",
      );
    await tx.execute({
      sql: "INSERT INTO job_reviews(owner_id,id,resume_id,request_hash,saved_at,report) VALUES (?,?,?,?,?,?)",
      args: [
        owner,
        input.requestId,
        input.documentId,
        fingerprint,
        report.savedAt,
        serialized,
      ],
    });
    await tx.commit();
    return parse(serialized);
  } finally {
    tx.close();
  }
}
export async function listJobReviews(owner: string, id: string) {
  const tx = await database().client.transaction("read");
  try {
    const doc = await ownedResume(owner, id, tx);
    const rows = (
      await tx.execute({
        sql: "SELECT report FROM job_reviews WHERE owner_id=? AND resume_id=? ORDER BY saved_at DESC,id DESC LIMIT ?",
        args: [owner, id, REVIEW_HISTORY_LIMIT],
      })
    ).rows;
    const currentHash = sha(reviewSnapshot(doc));
    const summaries = rows.map((row) => {
      const report = parse(row.report);
      const {
        id,
        sourceId,
        sourceRevision,
        sourceHash,
        jobHash,
        version,
        termsVersion,
        analyzedAt,
        savedAt,
        target,
        groups,
      } = report;
      return reviewSummarySchema.parse({
        id,
        sourceId,
        sourceRevision,
        sourceHash,
        jobHash,
        version,
        termsVersion,
        analyzedAt,
        savedAt,
        target,
        groups,
        stale:
          sourceHash !== currentHash ||
          version !== JOB_EVIDENCE_VERSION ||
          termsVersion !== JOB_TERMS_VERSION,
      });
    });
    await tx.commit();
    return summaries;
  } finally {
    tx.close();
  }
}
export async function getJobReview(
  owner: string,
  id: string,
  reportId: string,
) {
  const tx = await database().client.transaction("read");
  try {
    const doc = await ownedResume(owner, id, tx);
    const row = (
      await tx.execute({
        sql: "SELECT report FROM job_reviews WHERE owner_id=? AND resume_id=? AND id=?",
        args: [owner, id, reportId],
      })
    ).rows[0];
    if (!row) throw missing();
    const report = parse(row.report);
    await tx.commit();
    return { report, stale: stale(report, doc) };
  } finally {
    tx.close();
  }
}
export async function deleteJobReview(
  owner: string,
  id: string,
  reportId: string,
) {
  const tx = await database().client.transaction("write");
  try {
    await ownedResume(owner, id, tx);
    await tx.execute({
      sql: "DELETE FROM job_reviews WHERE owner_id=? AND resume_id=? AND id=?",
      args: [owner, id, reportId],
    });
    await tx.commit(); // An already-deleted report succeeds for the owned CV on retry.
  } finally {
    tx.close();
  }
}
export async function exportJobReviews(
  owner: string,
  client: Connection = database().client,
) {
  return (
    await client.execute({
      sql: "SELECT report FROM job_reviews WHERE owner_id=? ORDER BY saved_at DESC,id DESC",
      args: [owner],
    })
  ).rows.map((row) => parse(row.report));
}
