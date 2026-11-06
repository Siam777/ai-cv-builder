import { z } from "zod";
import { accountRequest } from "./cloud-repository";
import { givenRequirementSchema } from "./ai-contract";
import {
  APPLICATION_LIMITS,
  type ApplicationDetail,
  type ApplicationSummary,
  type CreateApplication,
  type CreateSubmission,
  type FreezeDocument,
  type FrozenDocument,
  type Submission,
  type UpdateApplication,
} from "./applications";

/** Browser calls to the tracker routes, scoped to the signed-in workspace. */
export function trackerApi(owner: string) {
  const send = (path: string, method: string, body?: unknown) =>
    accountRequest(
      path,
      { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      owner,
    );
  return {
    list: (due?: string) =>
      accountRequest(
        `/api/applications${due ? `?due=${encodeURIComponent(due)}` : ""}`,
        {},
        owner,
      ) as Promise<ApplicationSummary[]>,
    get: (id: string) =>
      accountRequest(
        `/api/applications/${encodeURIComponent(id)}`,
        {},
        owner,
      ) as Promise<ApplicationDetail>,
    create: (input: CreateApplication) =>
      send("/api/applications", "POST", input) as Promise<ApplicationDetail>,
    update: (id: string, input: UpdateApplication) =>
      send(
        `/api/applications/${encodeURIComponent(id)}`,
        "PATCH",
        input,
      ) as Promise<ApplicationDetail>,
    remove: (id: string) =>
      send(`/api/applications/${encodeURIComponent(id)}`, "DELETE"),
    freeze: (id: string, input: FreezeDocument) =>
      send(
        `/api/applications/${encodeURIComponent(id)}/documents`,
        "POST",
        input,
      ) as Promise<FrozenDocument>,
    document: (id: string, documentId: string) =>
      accountRequest(
        `/api/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
        {},
        owner,
      ) as Promise<FrozenDocument>,
    submit: (id: string, input: CreateSubmission) =>
      send(
        `/api/applications/${encodeURIComponent(id)}/submissions`,
        "POST",
        input,
      ) as Promise<{
        submission: Submission;
        application: ApplicationDetail;
      }>,
    snapshot: (snapshotId: string) =>
      accountRequest(
        `/api/exports/snapshots/${encodeURIComponent(snapshotId)}`,
        {},
        owner,
      ) as Promise<{
        id: string;
        kind: "cv" | "cover_letter";
        format: string;
        name: string;
        createdAt: string;
        expiresAt: string;
        claimed: boolean;
      }>,
    dismissSnapshot: (snapshotId: string) =>
      send(
        `/api/exports/snapshots/${encodeURIComponent(snapshotId)}`,
        "DELETE",
      ),
  };
}

/**
 * Handing a job or letter between the editor and /applications. The data stays
 * in this tab's sessionStorage, never in the address, so it is not in server
 * logs or history.
 */
const HANDOFF_KEY = "cv-application-handoff";
const short = (max: number) => z.string().max(max);
const post = z.string().refine((text) => [...text].length <= APPLICATION_LIMITS.jobPost);
export const handoffSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("job"),
    company: short(APPLICATION_LIMITS.company),
    role: short(APPLICATION_LIMITS.role),
    post: post,
    resumeId: z.string().max(100).optional(),
    url: z.string().max(2000).optional(),
    /** A reviewed draft from the Add a job form (a guest signing in to save it). */
    fields: z.record(z.string(), z.string().max(2000)).optional(),
    requirements: z
      .array(
        z.strictObject({
          id: z.string().max(100),
          text: z.string().max(300),
          kind: z.enum(["must", "nice", "unstated"]),
          quote: z.string().max(300),
          paraphrased: z.boolean(),
        }),
      )
      .max(40)
      .optional(),
  }),
  z.strictObject({
    kind: z.literal("letter"),
    company: short(APPLICATION_LIMITS.company),
    role: short(APPLICATION_LIMITS.role),
    text: z.string().min(1).max(APPLICATION_LIMITS.letterText),
    name: z.string().min(1).max(APPLICATION_LIMITS.letterName),
    resumeId: z.string().max(100).optional(),
  }),
  /** From an application to the editor's Match a job tab. */
  z.strictObject({
    kind: z.literal("match"),
    company: short(APPLICATION_LIMITS.company),
    role: short(APPLICATION_LIMITS.role),
    post: post,
    /** The reviewed requirements to match (first 15, with the person's priorities). */
    requirements: z.array(givenRequirementSchema).max(15).optional(),
    applicationId: z.string().max(100).optional(),
    resumeId: z.string().max(100).optional(),
    /** "tailor" opens the same tool for a tailored copy linked to the application. */
    mode: z.enum(["match", "tailor"]).optional(),
  }),
]);
export type Handoff = z.infer<typeof handoffSchema>;
export function stashHandoff(handoff: Handoff) {
  try {
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify(handoffSchema.parse(handoff)),
    );
  } catch {
    // Storage blocked: the destination opens without pre-filled fields.
  }
}
/** Reads and removes a handoff of the wanted kinds; anything else is left in place. */
export function takeHandoff<K extends Handoff["kind"]>(
  ...kinds: K[]
): Extract<Handoff, { kind: K }> | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = handoffSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    if (!kinds.includes(parsed.data.kind as K)) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    return parsed.data as Extract<Handoff, { kind: K }>;
  } catch {
    return null;
  }
}
