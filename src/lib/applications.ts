import { z } from "zod";
import { documentSchema } from "./document";

/** Application tracker (career roadmap step 2, phase A): shared schemas, stages, labels and limits. */

export const STAGES = [
  "saved",
  "applied",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type Stage = (typeof STAGES)[number];
export const stageSchema = z.enum(STAGES);
export const STAGE_LABELS: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
export const CLOSED_STAGES: readonly Stage[] = [
  "accepted",
  "rejected",
  "withdrawn",
];
/** The list groups: one per open stage, then Closed. */
export const STAGE_GROUPS: { id: string; label: string; stages: Stage[] }[] = [
  { id: "saved", label: "Saved", stages: ["saved"] },
  { id: "applied", label: "Applied", stages: ["applied"] },
  { id: "assessment", label: "Assessment", stages: ["assessment"] },
  { id: "interview", label: "Interview", stages: ["interview"] },
  { id: "offer", label: "Offer", stages: ["offer"] },
  {
    id: "closed",
    label: "Closed",
    stages: ["accepted", "rejected", "withdrawn"],
  },
];

export const APPLICATION_LIMITS = {
  company: 200,
  role: 200,
  location: 200,
  source: 200,
  url: 2000,
  nextAction: 300,
  notes: 5000,
  jobPost: 30000,
  contacts: 10,
  contactNotes: 1000,
  documentBytes: 524288,
  documentsPerApplication: 5,
  applicationsPerAccount: 500,
  letterText: 20000,
  letterName: 200,
  /** Unclaimed export snapshots kept per account; the oldest is dropped. */
  unclaimedSnapshots: 20,
  snapshotDays: 7,
  /** "Applied" with no change for this long shows a muted "No reply yet". */
  noReplyDays: 21,
} as const;
/** Request body caps for the routes (bytes). Job posts may be multibyte. */
export const APPLICATION_BODY_BYTES = 196608;
export const DOCUMENT_BODY_BYTES = 4_000_000;

const id = z.string().min(1).max(100);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date (YYYY-MM-DD).");
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const httpUrl = z
  .string()
  .trim()
  .max(APPLICATION_LIMITS.url)
  .refine(
    (value) => value === "" || /^https?:\/\/\S+$/i.test(value),
    "Use a link that starts with http:// or https://.",
  );

export const contactSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).default(""),
  email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+$/.test(value),
      "Check the email address.",
    )
    .default(""),
  phone: z.string().trim().max(50).default(""),
  profileUrl: httpUrl.default(""),
  notes: z.string().max(APPLICATION_LIMITS.contactNotes).default(""),
});
export type Contact = z.infer<typeof contactSchema>;
export const contactsSchema = z
  .array(contactSchema)
  .max(APPLICATION_LIMITS.contacts);

/** Reviewed requirements from a job post (job capture §3): must or nice, each with the words it came from. */
export const requirementSchema = z.strictObject({
  id,
  text: z.string().min(1).max(300),
  kind: z.enum(["must", "nice"]),
  quote: z.string().max(300),
});
export const requirementsSchema = z.array(requirementSchema).max(40);
export type Requirement = z.infer<typeof requirementSchema>;
const EMPLOYMENT_TYPE_KEYS = ["full-time", "part-time", "contract", "temporary", "internship", "freelance", "permanent"] as const;

const fields = {
  company: z
    .string()
    .trim()
    .min(1, "Add the company.")
    .max(APPLICATION_LIMITS.company),
  role: z.string().trim().min(1, "Add the role.").max(APPLICATION_LIMITS.role),
  jobUrl: httpUrl.nullable().optional(),
  location: optionalText(APPLICATION_LIMITS.location),
  source: optionalText(APPLICATION_LIMITS.source),
  stage: stageSchema,
  appliedAt: day.nullable().optional(),
  nextActionAt: day.nullable().optional(),
  nextAction: optionalText(APPLICATION_LIMITS.nextAction),
  notes: z.string().max(APPLICATION_LIMITS.notes),
  // Counted in characters, as the job post box and Read with AI count them.
  jobPost: z
    .string()
    .refine((post) => [...post].length <= APPLICATION_LIMITS.jobPost, "The job post can be at most 30,000 characters.")
    .nullable()
    .optional(),
  contacts: contactsSchema,
  resumeId: id.nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPE_KEYS).nullable().optional(),
  salaryText: optionalText(200),
  deadlineAt: day.nullable().optional(),
  requirements: requirementsSchema,
};
export const CAPTURED_VIA = ["manual", "paste", "bookmarklet", "extension", "suggested"] as const;

export const createApplicationSchema = z.strictObject({
  requestId: z.string().uuid(),
  ...fields,
  stage: fields.stage.default("saved"),
  notes: fields.notes.default(""),
  contacts: fields.contacts.default([]),
  requirements: fields.requirements.default([]),
  /** How the job arrived; metadata only, never shown to employers. */
  capturedVia: z.enum(CAPTURED_VIA).default("manual"),
});
export type CreateApplication = z.input<typeof createApplicationSchema>;

export const updateApplicationSchema = z.strictObject({
  updatedAt: z.string().datetime(),
  company: fields.company.optional(),
  role: fields.role.optional(),
  jobUrl: fields.jobUrl,
  location: fields.location,
  source: fields.source,
  stage: fields.stage.optional(),
  appliedAt: fields.appliedAt,
  nextActionAt: fields.nextActionAt,
  nextAction: fields.nextAction,
  notes: fields.notes.optional(),
  jobPost: fields.jobPost,
  contacts: fields.contacts.optional(),
  resumeId: fields.resumeId,
  employmentType: fields.employmentType,
  salaryText: fields.salaryText,
  deadlineAt: fields.deadlineAt,
  requirements: fields.requirements.optional(),
});
export type UpdateApplication = z.input<typeof updateApplicationSchema>;

/**
 * Freeze a document into an application. A snapshot from an export is
 * preferred: it is exactly what was downloaded. Every freeze carries a
 * client requestId so a lost-response retry returns the same document.
 */
export const freezeDocumentSchema = z.discriminatedUnion("source", [
  z.strictObject({
    requestId: z.string().uuid(),
    source: z.literal("snapshot"),
    snapshotId: id,
  }),
  z.strictObject({
    requestId: z.string().uuid(),
    source: z.literal("account"),
    resumeId: id,
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({
    requestId: z.string().uuid(),
    source: z.literal("device"),
    document: documentSchema,
  }),
  z.strictObject({
    requestId: z.string().uuid(),
    source: z.literal("letter"),
    text: z.string().trim().min(1).max(APPLICATION_LIMITS.letterText),
    name: z.string().trim().min(1).max(APPLICATION_LIMITS.letterName),
    /** Optional stored CV for the letterhead (ownership checked). */
    resumeId: id.optional(),
  }),
]);
export type FreezeDocument = z.input<typeof freezeDocumentSchema>;

export const submissionSchema = z.strictObject({
  requestId: z.string().uuid(),
  sentAt: z.string().datetime(),
  cvDocumentId: id,
  letterDocumentId: id.nullable().optional(),
});
export type CreateSubmission = z.input<typeof submissionSchema>;

/** What a frozen copy or export snapshot stores. */
export const frozenContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal("cv"),
    document: documentSchema,
    /** True when a photo was removed to keep the copy within 512 KB. */
    photoOmitted: z.boolean(),
  }),
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal("cover_letter"),
    name: z.string().min(1).max(APPLICATION_LIMITS.letterName),
    text: z.string().min(1).max(APPLICATION_LIMITS.letterText),
    /** Letterhead document (photo always removed), or null without a CV. */
    document: documentSchema.nullable(),
    photoOmitted: z.boolean(),
  }),
]);
export type FrozenContent = z.infer<typeof frozenContentSchema>;

export const eventSchema = z.strictObject({
  id,
  at: z.string(),
  kind: z.enum(["created", "stage", "sent"]),
  fromStage: stageSchema.nullable(),
  toStage: stageSchema.nullable(),
  submissionId: id.nullable(),
});
/** A sent event must name its submission; other kinds must not (review finding 10). */
export const storedEventSchema = eventSchema.refine(
  (event) => (event.kind === "sent") === (event.submissionId !== null),
  "A sent event must reference a submission.",
);
export type ApplicationEvent = z.infer<typeof eventSchema>;

export interface ApplicationSummary {
  id: string;
  company: string;
  role: string;
  jobUrl: string | null;
  location: string | null;
  source: string | null;
  stage: Stage;
  stageChangedAt: string;
  appliedAt: string | null;
  nextActionAt: string | null;
  nextAction: string | null;
  resumeId: string | null;
  sentCount: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface DocumentSummary {
  id: string;
  kind: "cv" | "cover_letter";
  name: string;
  sourceResumeId: string | null;
  sourceRevision: number | null;
  exportSnapshotId: string | null;
  sha256: string;
  createdAt: string;
  photoOmitted: boolean;
}
export interface Submission {
  id: string;
  sentAt: string;
  stageAtSend: Stage;
  cvDocumentId: string;
  letterDocumentId: string | null;
  createdAt: string;
}
export interface ApplicationDetail extends ApplicationSummary {
  notes: string;
  jobPost: string | null;
  employmentType: string | null;
  salaryText: string | null;
  deadlineAt: string | null;
  requirements: Requirement[];
  capturedVia: (typeof CAPTURED_VIA)[number];
  contacts: Contact[];
  events: ApplicationEvent[];
  documents: DocumentSummary[];
  submissions: Submission[];
}
export interface FrozenDocument extends DocumentSummary {
  content: FrozenContent;
}

/** Local calendar date (YYYY-MM-DD) for reminders, in the viewer's time zone. */
export function localDay(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export type DueState = "overdue" | "due" | null;
export function dueState(nextActionAt: string | null, today: string): DueState {
  if (!nextActionAt) return null;
  if (nextActionAt < today) return "overdue";
  if (nextActionAt === today) return "due";
  return null;
}
/** Computed, not a stage: applied with no change for 21 days. */
export function noReplyYet(
  app: Pick<ApplicationSummary, "stage" | "stageChangedAt">,
  now = Date.now(),
) {
  return (
    app.stage === "applied" &&
    now - Date.parse(app.stageChangedAt) >=
      APPLICATION_LIMITS.noReplyDays * 86_400_000
  );
}
