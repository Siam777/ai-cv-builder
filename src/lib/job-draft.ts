import type { CreateApplication, Requirement } from "./applications";
import type { GivenRequirement } from "./ai-contract";
import {
  EMPLOYMENT_TYPES,
  JOB_POST_MAX,
  MATCH_REQUIREMENT_MAX,
  WORK_TYPE_LABELS,
  charCount,
  type JobField,
  type JobReadResult,
  type RequirementKind,
} from "./job-read";

/**
 * The "Add a job" form's state (job capture §4.1): the pasted post, the
 * fields the person reviews (each remembering the words it was read from)
 * and the requirement lists. Pure, so it is shared by the page and tests.
 */
export interface DraftRequirement {
  id: string;
  text: string;
  kind: RequirementKind;
  quote: string;
  paraphrased: boolean;
}
export type DraftFields = Record<JobField, string>;
export interface JobDraft {
  post: string;
  url: string;
  fields: DraftFields;
  /** The value and quote each field had when it was read; a quote is shown only while the value is unchanged. */
  read: Partial<Record<JobField, { value: string; quote: string }>>;
  requirements: DraftRequirement[];
  source: "local" | "ai" | null;
  withheld: number;
}
export const emptyDraftFields = (): DraftFields => ({
  role: "",
  company: "",
  location: "",
  workType: "",
  employmentType: "",
  salary: "",
  deadline: "",
  applyLink: "",
});
export const emptyDraft = (
  seed: Partial<Pick<JobDraft, "post" | "url">> & {
    fields?: Partial<DraftFields>;
  } = {},
): JobDraft => ({
  post: seed.post ?? "",
  url: seed.url ?? "",
  fields: { ...emptyDraftFields(), ...seed.fields },
  read: {},
  requirements: [],
  source: null,
  withheld: 0,
});

/**
 * Applies a read to the draft. A field the person typed themselves is kept;
 * an empty field, or one still holding an earlier read value, takes the new
 * value. A field the read did not support is left as it was (never guessed).
 */
export function applyRead(draft: JobDraft, result: JobReadResult): JobDraft {
  const fields = { ...draft.fields };
  const read: JobDraft["read"] = {};
  for (const [key, value] of Object.entries(result.fields) as [
    JobField,
    { value: string; quote: string },
  ][]) {
    const untouched =
      !fields[key].trim() || fields[key] === draft.read[key]?.value;
    if (!untouched) continue;
    fields[key] = value.value;
    read[key] = value;
  }
  for (const [key, value] of Object.entries(draft.read) as [
    JobField,
    { value: string; quote: string },
  ][])
    if (!read[key] && fields[key] === value.value && !result.fields[key]) {
      // An earlier read value the new read did not confirm is cleared, not kept as if it were confirmed.
      fields[key] = "";
    }
  return {
    ...draft,
    fields,
    read,
    requirements: result.requirements.map((r) => ({ ...r })),
    source: result.source,
    withheld: result.withheld,
  };
}

/** Must haves, then nice to haves, then not stated: the order the lists are shown and stored. */
export function ordered<T extends { kind: string }>(rows: T[]) {
  return [
    ...rows.filter((row) => row.kind === "must"),
    ...rows.filter((row) => row.kind === "nice"),
    ...rows.filter((row) => row.kind !== "must" && row.kind !== "nice"),
  ];
}
/** IDs of the first 15 must haves, then nice to haves: what Match a job receives. */
export function usedForMatching(rows: { id: string; kind: string }[]) {
  return new Set(
    ordered(rows)
      .filter((row) => row.kind === "must" || row.kind === "nice")
      .slice(0, MATCH_REQUIREMENT_MAX)
      .map((row) => row.id),
  );
}
/** The reviewed requirements Match a job receives, with the person's priorities; deleted ones are simply absent. */
export function matchRequirements(rows: Requirement[]): GivenRequirement[] {
  const used = usedForMatching(rows);
  return ordered(rows)
    .filter((row) => used.has(row.id))
    .map((row) => ({
      id: row.id,
      text: row.text,
      priority: row.kind === "must" ? "required" : "preferred",
    }));
}

/** Moves an item up or down inside its own list. */
export function moveWithinKind<T extends { id: string; kind: string }>(
  rows: T[],
  id: string,
  delta: -1 | 1,
): T[] {
  const list = ordered(rows);
  const item = list.find((row) => row.id === id);
  if (!item) return list;
  const same = list.filter((row) => row.kind === item.kind);
  const index = same.indexOf(item);
  const target = index + delta;
  if (target < 0 || target >= same.length) return list;
  [same[index], same[target]] = [same[target], same[index]];
  const others = list.filter((row) => row.kind !== item.kind);
  return ordered([...others, ...same]);
}
/** Moves an item to the end of another list. */
export function moveToKind<T extends { id: string; kind: string }>(
  rows: T[],
  id: string,
  kind: T["kind"],
): T[] {
  const list = ordered(rows);
  const item = list.find((row) => row.id === id);
  if (!item) return list;
  return ordered([...list.filter((row) => row.id !== id), { ...item, kind }]);
}

export const postTooLong = (post: string) => charCount(post) > JOB_POST_MAX;

/** What is missing before the draft can be saved, as messages for the person. */
export function draftProblems(draft: JobDraft) {
  const problems: string[] = [];
  if (!draft.fields.role.trim()) problems.push("Add the role.");
  if (!draft.fields.company.trim()) problems.push("Add the company.");
  if (postTooLong(draft.post))
    problems.push("The job post can be at most 30,000 characters.");
  const unstated = draft.requirements.filter(
    (r) => r.kind === "unstated",
  ).length;
  if (unstated)
    problems.push(
      `Choose Must have or Nice to have for ${unstated} requirement${unstated === 1 ? "" : "s"} under Not stated, or remove ${unstated === 1 ? "it" : "them"}.`,
    );
  if (
    draft.fields.applyLink.trim() &&
    !/^https?:\/\/\S+$/i.test(draft.fields.applyLink.trim())
  )
    problems.push("Use an apply link that starts with http:// or https://.");
  return problems;
}

/**
 * The application to create from a reviewed draft: a Saved application with
 * the post, the requirements (must and nice only) and captured_via "paste"
 * when a post was pasted. Work type has no column of its own, so it is kept
 * with the location ("Berlin · Hybrid").
 */
export function draftToApplication(
  draft: JobDraft,
  requestId: string,
): CreateApplication {
  const f = draft.fields;
  const optional = (value: string) => (value.trim() ? value.trim() : null);
  const work = f.workType ? (WORK_TYPE_LABELS[f.workType] ?? f.workType) : "";
  const location = [f.location.trim(), work].filter(Boolean).join(" · ");
  const employment =
    f.employmentType && f.employmentType in EMPLOYMENT_TYPES
      ? f.employmentType
      : null;
  return {
    requestId,
    company: f.company.trim(),
    role: f.role.trim(),
    stage: "saved",
    jobUrl: optional(f.applyLink) ?? optional(draft.url),
    location: location ? location.slice(0, 200) : null,
    source: null,
    notes: "",
    jobPost: draft.post.trim() ? draft.post : null,
    contacts: [],
    employmentType: employment as CreateApplication["employmentType"],
    salaryText: optional(f.salary),
    deadlineAt: /^\d{4}-\d{2}-\d{2}$/.test(f.deadline) ? f.deadline : null,
    requirements: ordered(draft.requirements)
      .filter(
        (r): r is DraftRequirement & { kind: "must" | "nice" } =>
          r.kind === "must" || r.kind === "nice",
      )
      .map((r, index) => ({
        id: `req-${index + 1}`,
        text: r.text.slice(0, 300),
        kind: r.kind,
        quote: r.quote.slice(0, 300),
      })),
    capturedVia: draft.post.trim() ? "paste" : "manual",
  };
}
