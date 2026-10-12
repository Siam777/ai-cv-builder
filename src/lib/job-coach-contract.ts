import { z } from "zod";
import { criterionSchema, prioritySchema } from "./vault/job-evidence";
import { reviewTargetSchema } from "./job-review-history";
const id = z.string().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const jobCoachInputSchema = z.strictObject({
  jobText: z.string().min(1).max(20000),
  criterionId: id,
  priority: prioritySchema,
  priorityOrigin: z.enum(["posting", "candidate_review"]),
  target: reviewTargetSchema,
  sourceHash: hash,
  jobHash: hash,
  rulesVersion: z.string().min(1).max(100),
  termsVersion: z.string().min(1).max(100),
});
export type JobCoachInput = z.infer<typeof jobCoachInputSchema>;
export const assessmentSchema = z.strictObject({
  status: z.enum(["relevant", "uncertain", "not_demonstrated"]),
  explanation: z.string().min(1).max(1500),
  evidenceIds: z.array(id).max(10),
});
export const coachingRecordSchema = z.strictObject({
  criterion: criterionSchema,
  target: reviewTargetSchema,
  sourceHash: hash,
  jobHash: hash,
  rulesVersion: z.string().min(1).max(100),
  termsVersion: z.string().min(1).max(100),
  promptVersion: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  analyzedAt: z.string().datetime(),
  selectedBulletId: id,
  assessment: assessmentSchema,
  sources: z
    .array(
      z.strictObject({
        id,
        sectionId: id,
        entryId: id,
        text: z.string().min(1).max(20000),
      }),
    )
    .min(1)
    .max(10),
});
export type JobCoachContext = Pick<
  z.infer<typeof coachingRecordSchema>,
  | "criterion"
  | "target"
  | "sourceHash"
  | "jobHash"
  | "rulesVersion"
  | "termsVersion"
>;
