import { z } from "zod";
import {
  criterionSchema,
  prioritySchema,
  type JobEvidenceReview,
} from "./vault/job-evidence";
export const REVIEW_HISTORY_LIMIT = 20;
export const REVIEW_ACCOUNT_LIMIT = 100;
export const REVIEW_REPORT_BYTES = 524288;
const id = z.string().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const reviewTargetSchema = z.strictObject({
  role: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200),
  seniority: z.string().min(1).max(100),
  language: z.enum(["english", "other"]),
});
export const saveJobReviewSchema = z.strictObject({
  requestId: z.string().uuid(),
  documentId: id,
  revision: z.number().int().nonnegative(),
  sourceHash: hash,
  jobHash: hash,
  rulesVersion: z.string().min(1).max(100),
  termsVersion: z.string().min(1).max(100),
  jobText: z.string().min(1).max(20000),
  target: reviewTargetSchema,
  priorityOverrides: z
    .array(z.strictObject({ id, priority: prioritySchema }))
    .max(60)
    .refine(
      (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      "Duplicate priority override",
    ),
  consent: z.literal(true),
});
export type SaveJobReview = z.infer<typeof saveJobReviewSchema>;
const groupSchema = z.strictObject({
  total: z.number().int().min(0).max(60),
  direct: z.number().int().min(0).max(60),
  partial: z.number().int().min(0).max(60),
  unknown: z.number().int().min(0).max(60),
  absent: z.number().int().min(0).max(60),
  scorable: z.number().int().min(0).max(60),
  supportUnits: z.number().min(0).max(60),
  weight: z.number().min(0).max(2),
});
const groups = z.strictObject({
  required: groupSchema,
  preferred: groupSchema,
  uncertain: groupSchema,
});
const evidenceSchema = z.strictObject({
  id: z.string().min(1).max(400),
  sectionId: id,
  entryId: id,
  bulletId: id.optional(),
  quote: z.string().min(1).max(20000),
  label: z.string().max(40005),
  kind: z.string().max(100),
  field: z.enum(["title", "description", "bullet"]),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});
export const storedJobReviewSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sourceId: id,
  sourceRevision: z.number().int().nonnegative(),
  sourceHash: hash,
  jobHash: hash,
  version: z.string().min(1).max(100),
  termsVersion: z.string().min(1).max(100),
  method: z.literal("local_text_rules"),
  modelVersion: z.null(),
  promptVersion: z.null(),
  analyzedAt: z.string().datetime(),
  savedAt: z.string().datetime(),
  jobText: z.string().min(1).max(20000),
  target: reviewTargetSchema,
  matches: z
    .array(
      z.strictObject({
        criterion: criterionSchema,
        status: z.enum(["direct", "partial", "unknown", "absent"]),
        reason: z.string().max(4000),
        evidence: z.array(evidenceSchema).max(3),
      }),
    )
    .max(60),
  groups,
  warnings: z.array(z.string().max(2000)).max(20),
});
export type StoredJobReview = z.infer<typeof storedJobReviewSchema>;
export const reviewSummarySchema = storedJobReviewSchema
  .pick({
    id: true,
    sourceId: true,
    sourceRevision: true,
    sourceHash: true,
    jobHash: true,
    version: true,
    termsVersion: true,
    analyzedAt: true,
    savedAt: true,
    target: true,
    groups: true,
  })
  .extend({ stale: z.boolean() });
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export const reviewDetailSchema = z.strictObject({
  report: storedJobReviewSchema,
  stale: z.boolean(),
});
export function reviewSaveInput(
  review: JobEvidenceReview,
  requestId: string,
): SaveJobReview {
  return saveJobReviewSchema.parse({
    requestId,
    documentId: review.sourceId,
    revision: review.sourceRevision,
    sourceHash: review.sourceHash,
    jobHash: review.jobHash,
    rulesVersion: review.version,
    termsVersion: review.termsVersion,
    jobText: review.jobText,
    target: review.target,
    priorityOverrides: review.matches
      .filter((match) => match.criterion.priorityOrigin === "candidate_review")
      .map((match) => ({
        id: match.criterion.id,
        priority: match.criterion.priority,
      })),
    consent: true,
  });
}
