import { z } from "zod";
import { type ResumeDocument } from "./document";
import { bulletEvidence } from "./ai-proposals";
import { jobCoachInputSchema } from "./job-coach-contract";
import { parseSkillsFromText } from "./skills-taxonomy";

export const generateSchema = z.strictObject({
  requestId: z.uuid(),
  documentId: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  bulletId: z.string().min(1).max(100),
  instruction: z.string().trim().min(1).max(1000),
  consent: z.literal(true),
  job: jobCoachInputSchema.optional(),
});
export type GenerateRequest = z.infer<typeof generateSchema>;
export const draftSchema = z.strictObject({
  message: z.string().max(1500),
  questions: z.array(z.string().max(400)).max(3),
  text: z.string().max(3000),
  evidenceIds: z.array(z.string().max(100)).max(10),
});
export const supportSchema = z.strictObject({
  supported: z.boolean(),
  reason: z.string().max(1000),
});
export const decisionSchema = z.strictObject({
  decision: z.enum(["accept", "reject"]),
  confirmed: z.literal(true),
});

export function rewriteContext(doc: ResumeDocument, bulletId: string) {
  const all = bulletEvidence(doc);
  const selected = all.find((item) => item.id === bulletId);
  if (!selected)
    throw new Error("Choose a nonempty bullet from the active resume.");
  const sources = all.filter(
    (item) =>
      item.entryId === selected.entryId &&
      item.sectionId === selected.sectionId,
  );
  if (
    sources.length > 10 ||
    sources.reduce((size, source) => size + source.text.length, 0) > 12000
  )
    throw new Error(
      "This entry is too large for a rewrite. Use no more than 10 bullets and 12,000 characters.",
    );
  return { selected, sources };
}
// Defense in depth only. Semantic support is checked separately, then reviewed by the user.
export function hasNewNumbers(text: string, evidence: string[]) {
  const numbers = (value: string) =>
    value.normalize("NFKC").match(/\p{N}+(?:[.,]\p{N}+)*(?:\s*[%％])?/gu) ?? [];
  const existing = new Set(
    evidence.flatMap(numbers).map((n) => n.replace(/\s/g, "")),
  );
  return numbers(text).some((n) => !existing.has(n.replace(/\s/g, "")));
}

/** Ask the AI to draft a professional summary from the saved CV. */
export const summaryRequestSchema = z.strictObject({
  requestId: z.uuid(),
  documentId: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  consent: z.literal(true),
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;
export const summaryDraftSchema = z.strictObject({
  message: z.string().max(1000),
  text: z.string().max(1200),
  evidenceIds: z.array(z.string().max(100)).max(30),
});

export interface SummaryEvidence {
  id: string;
  kind: "headline" | "role" | "bullet" | "education" | "skills" | "project";
  text: string;
}

/**
 * What a summary may be built from: the headline, roles, bullets, education,
 * skills and projects. Contact details are never sent.
 */
export function summaryEvidence(doc: ResumeDocument): SummaryEvidence[] {
  const evidence: SummaryEvidence[] = [];
  if (doc.contact.headline.trim())
    evidence.push({ id: "headline", kind: "headline", text: doc.contact.headline.trim() });
  for (const section of doc.sections) {
    if (!section.visible || section.type === "summary") continue;
    for (const entry of section.entries) {
      const role = [entry.title, entry.organization].filter((v) => v.trim()).join(" at ");
      if (section.type === "skills") {
        const skills = [entry.title, entry.description, ...entry.bullets.map((b) => b.text)]
          .filter((v) => v.trim())
          .join(": ");
        if (skills) evidence.push({ id: `skills-${entry.id}`, kind: "skills", text: skills });
        continue;
      }
      if (role)
        evidence.push({
          id: `entry-${entry.id}`,
          kind:
            section.type === "education"
              ? "education"
              : section.type === "projects"
                ? "project"
                : "role",
          text: role,
        });
      for (const bullet of entry.bullets)
        if (bullet.text.trim())
          evidence.push({ id: bullet.id, kind: "bullet", text: bullet.text.trim() });
    }
  }
  return evidence;
}

/** Removes the CV's own contact details, emails and phone numbers from free text. */
export function redactContact(text: string, doc: ResumeDocument) {
  let out = text;
  for (const value of [doc.contact.email, doc.contact.phone, doc.contact.website])
    if (value.trim().length >= 4)
      out = out.split(value.trim()).join("[contact removed]");
  return out
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[contact removed]")
    .replace(/\+?\d[\d ().-]{7,}\d/g, (match) =>
      match.replace(/\D/g, "").length >= 9 ? "[contact removed]" : match,
    );
}

/** Write with AI on a job or project: rough notes become bullets for review. */
export const entryBulletsRequestSchema = z.strictObject({
  requestId: z.uuid(),
  documentId: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  sectionId: z.string().min(1).max(100),
  entryId: z.string().min(1).max(100).optional(),
  notes: z.string().trim().min(1).max(4000),
  /** Duties pasted from the old job ad (optional). */
  duties: z.string().trim().max(4000).optional(),
});
export type EntryBulletsRequest = z.infer<typeof entryBulletsRequestSchema>;
export const entryBulletsDraftSchema = z.strictObject({
  message: z.string().max(1000),
  /** A job or project title, only when the notes state one. */
  title: z.string().max(200),
  bullets: z
    .array(
      z.strictObject({
        text: z.string().max(400),
        evidenceIds: z.array(z.string().max(100)).max(10),
      }),
    )
    .max(5),
  questions: z.array(z.string().max(300)).max(5),
});
export const entryBulletsSupportSchema = z.strictObject({
  results: z
    .array(
      z.strictObject({
        index: z.number().int().min(0).max(9),
        supported: z.boolean(),
        reason: z.string().max(400),
      }),
    )
    .max(10),
});

export interface EntryEvidence {
  id: string;
  kind: "note" | "duty" | "title" | "organization" | "bullet";
  text: string;
}

export interface EntryBulletsResult {
  requestId: string;
  message: string;
  title: string;
  bullets: {
    id: string;
    text: string;
    evidenceIds: string[];
    /** The note lines or CV text each bullet came from, quoted. */
    evidence: string[];
  }[];
  /** Suggestions that failed a check: the reason only, never the wording. */
  withheld: { reason: string }[];
  questions: string[];
}

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);

/**
 * What Write with AI may use: the person's notes (and pasted duties), plus the
 * entry's title, organization and bullets. Contact details are removed.
 */
export function entryEvidence(
  doc: ResumeDocument,
  input: Pick<EntryBulletsRequest, "sectionId" | "entryId" | "notes" | "duties">,
) {
  const section = doc.sections.find((s) => s.id === input.sectionId);
  if (!section || (section.type !== "experience" && section.type !== "projects"))
    throw new Error("Choose a job or project in the open CV.");
  const entry = input.entryId
    ? section.entries.find((e) => e.id === input.entryId)
    : undefined;
  if (input.entryId && !entry) throw new Error("This entry is no longer in the CV.");
  const evidence: EntryEvidence[] = [];
  lines(redactContact(input.notes, doc))
    .slice(0, 40)
    .forEach((text, i) => evidence.push({ id: `note-${i + 1}`, kind: "note", text }));
  lines(redactContact(input.duties ?? "", doc))
    .slice(0, 30)
    .forEach((text, i) => evidence.push({ id: `duty-${i + 1}`, kind: "duty", text }));
  if (entry?.title.trim())
    evidence.push({ id: "entry-title", kind: "title", text: entry.title.trim() });
  if (entry?.organization.trim())
    evidence.push({ id: "entry-organization", kind: "organization", text: entry.organization.trim() });
  for (const bullet of entry?.bullets ?? [])
    if (bullet.text.trim())
      evidence.push({ id: bullet.id, kind: "bullet", text: redactContact(bullet.text.trim(), doc) });
  if (evidence.reduce((size, item) => size + item.text.length, 0) > 12000)
    throw new Error("These notes and this entry are too long. Use at most 12,000 characters.");
  return { section, entry, evidence };
}

/** Example content for a job title: blanks such as [number] mark the specifics. */
export const STARTER_SENIORITY = ["entry", "mid", "senior", "lead"] as const;
export const startersRequestSchema = z.strictObject({
  requestId: z.uuid(),
  jobTitle: z.string().trim().min(2).max(120),
  seniority: z.enum(STARTER_SENIORITY).optional(),
  section: z.enum(["experience", "projects", "summary", "skills"]),
});
export type StartersRequest = z.infer<typeof startersRequestSchema>;
export const startersDraftSchema = z.strictObject({
  bullets: z.array(z.string().max(300)).max(8),
  summary: z.string().max(800),
  skills: z.array(z.string().max(60)).max(15),
});
export interface StartersResult {
  requestId: string;
  jobTitle: string;
  seniority: (typeof STARTER_SENIORITY)[number] | null;
  cached: boolean;
  bullets: string[];
  summary: string;
  skills: string[];
}

const BLANK = /\[[^[\]\n]{1,40}\]/g;
/** The blanks still left in an example, such as "[number]" or "[tool]". */
export function findBlanks(text: string) {
  return text.match(BLANK) ?? [];
}
/** An example can be accepted only once every blank is filled or deleted. */
export function starterReady(text: string) {
  return Boolean(text.trim()) && findBlanks(text).length === 0 && !/[[\]]/.test(text);
}
/** True when an example states a number outside a blank, which would read as a fact. */
export function numbersOutsideBlanks(text: string) {
  return /\p{N}/u.test(text.replace(BLANK, ""));
}
/** One cache entry per job title and seniority, whatever the spelling. */
export function starterCacheKey(jobTitle: string, seniority?: string) {
  return `${jobTitle.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").trim()}|${seniority ?? ""}`;
}

/** The skills already listed in the CV's skills sections. */
export function listedSkills(doc: ResumeDocument) {
  const seen = new Map<string, string>();
  for (const section of doc.sections)
    if (section.type === "skills")
      for (const entry of section.entries)
        for (const skill of parseSkillsFromText(
          [entry.description, ...entry.bullets.map((b) => b.text)].join(" · "),
        ))
          if (!seen.has(skill.toLowerCase())) seen.set(skill.toLowerCase(), skill);
  return [...seen.values()];
}

/** Suggest skills with AI (Go and Pro). */
export const skillsRequestSchema = z.strictObject({
  requestId: z.uuid(),
  documentId: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  /** The role the common skills are for; defaults to the headline. */
  role: z.string().trim().max(120).optional(),
});
export type SkillsRequest = z.infer<typeof skillsRequestSchema>;
export const skillsDraftSchema = z.strictObject({
  message: z.string().max(1000),
  demonstrated: z
    .array(
      z.strictObject({
        skill: z.string().max(60),
        evidenceIds: z.array(z.string().max(100)).max(5),
      }),
    )
    .max(12),
  roleSuggestions: z.array(z.string().max(60)).max(12),
  groups: z
    .array(z.strictObject({ name: z.string().max(40), skills: z.array(z.string().max(60)).max(40) }))
    .max(6),
});
export const skillsSupportSchema = z.strictObject({
  results: z
    .array(
      z.strictObject({
        index: z.number().int().min(0).max(19),
        supported: z.boolean(),
        reason: z.string().max(400),
      }),
    )
    .max(20),
});
export interface SkillsResult {
  requestId: string;
  message: string;
  role: string;
  /** Skills the CV shows, each quoting the text that shows it. */
  demonstrated: { skill: string; evidenceIds: string[]; evidence: string[] }[];
  /** Common for the role: examples to add only if true. */
  roleSuggestions: string[];
  /** The listed skills arranged into groups (only listed skills). */
  groups: { name: string; skills: string[] }[];
  /** How many suggestions failed a check. */
  withheld: number;
}

/** AI interview start: Free gets one interview; Go and Pro unlimited. */
export const interviewStartSchema = z.strictObject({
  documentId: z.string().min(1).max(100),
});
export const INTERVIEW_STEPS = ["education", "extras"] as const;
export const interviewStepSchema = z.strictObject({
  requestId: z.uuid(),
  interviewId: z.uuid(),
  step: z.enum(INTERVIEW_STEPS),
  answer: z.string().trim().min(1).max(2000),
});
export type InterviewStepRequest = z.infer<typeof interviewStepSchema>;
export const educationDraftSchema = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        qualification: z.string().max(200),
        institution: z.string().max(200),
        year: z.string().max(20),
      }),
    )
    .max(6),
});
export const extrasDraftSchema = z.strictObject({
  skills: z.array(z.string().max(60)).max(30),
  languages: z
    .array(z.strictObject({ language: z.string().max(60), level: z.string().max(60) }))
    .max(10),
  certifications: z
    .array(
      z.strictObject({
        name: z.string().max(200),
        issuer: z.string().max(200),
        year: z.string().max(20),
      }),
    )
    .max(10),
});
export interface InterviewStepResult {
  requestId: string;
  step: (typeof INTERVIEW_STEPS)[number];
  education: { qualification: string; institution: string; year: string }[];
  skills: string[];
  languages: { language: string; level: string }[];
  certifications: { name: string; issuer: string; year: string }[];
  /** Items dropped because their words were not in the answer. */
  dropped: number;
}

const comparable = (value: string) =>
  ` ${value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim()} `;
/** True when every word of a value appears, in order, in the person's answer. */
export function statedIn(value: string, answer: string) {
  const needle = comparable(value);
  return needle.trim().length > 0 && comparable(answer).includes(needle);
}
