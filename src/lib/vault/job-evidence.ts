import { z } from "zod";
import { duplicateDocument, type ResumeDocument } from "../document";

export const JOB_EVIDENCE_VERSION = "2026-10-11.q4.2";
export const JOB_TERMS_VERSION = "2026-10-11.1";
export const prioritySchema = z.enum(["required", "preferred", "uncertain"]);
export type Priority = z.infer<typeof prioritySchema>;
const sourceSchema = z.strictObject({
  quote: z.string().min(1).max(2000),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});
export const criterionSchema = z.strictObject({
  id: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  sources: z.array(sourceSchema).min(1).max(60),
  category: z.enum([
    "skill",
    "credential",
    "experience",
    "responsibility",
    "other",
  ]),
  priority: prioritySchema,
  priorityOrigin: z.enum(["posting", "candidate_review"]),
  alternatives: z
    .array(z.array(z.string().min(1).max(100)).min(1).max(30))
    .max(10),
  minimumYears: z.number().min(0).max(100).nullable(),
  reviewReasons: z.array(z.string().max(300)).max(10),
});
export type JobCriterion = z.infer<typeof criterionSchema>;
export type EvidenceRef = {
  id: string;
  sectionId: string;
  entryId: string;
  bulletId?: string;
  quote: string;
  label: string;
  kind: string;
  field: "title" | "description" | "bullet";
  start: number;
  end: number;
};
export type EvidenceMatch = {
  criterion: JobCriterion;
  status: "direct" | "partial" | "unknown" | "absent";
  reason: string;
  evidence: EvidenceRef[];
};
export type CoverageGroup = {
  total: number;
  direct: number;
  partial: number;
  unknown: number;
  absent: number;
  scorable: number;
  supportUnits: number;
  weight: number;
};
export type JobEvidenceReview = {
  version: string;
  termsVersion: string;
  analyzedAt: string;
  target: {
    role: string;
    seniority: string;
    language: "english" | "other";
    company: string;
  };
  jobText: string;
  jobHash: string;
  sourceHash: string;
  sourceSnapshot: string;
  sourceId: string;
  sourceRevision: number;
  matches: EvidenceMatch[];
  groups: Record<Priority, CoverageGroup>;
  warnings: string[];
};
// Explicit equivalences only. Related technologies are kept in a separate map.
const TERMS: Record<string, string[]> = {
  python: ["python"],
  java: ["java"],
  javascript: ["javascript"],
  typescript: ["typescript"],
  react: ["react", "react.js", "reactjs"],
  node: ["node.js", "nodejs"],
  kubernetes: ["kubernetes", "k8s"],
  docker: ["docker"],
  aws: ["aws", "amazon web services"],
  azure: ["azure", "microsoft azure"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  postgresql: ["postgresql", "postgres"],
  mysql: ["mysql"],
  sql: ["sql"],
  mongodb: ["mongodb", "mongo"],
  redis: ["redis"],
  terraform: ["terraform"],
  graphql: ["graphql"],
  "rest api": ["rest api", "restful api", "restful apis"],
  "c++": ["c++"],
  "c#": ["c#"],
  golang: ["golang"],
  rust: ["rust"],
  figma: ["figma"],
  prototyping: ["prototyping", "prototypes", "prototype"],
  "interaction design": ["interaction design", "interaction patterns"],
  "design systems": ["design systems", "design system"],
  "user research": [
    "user research",
    "customer interviews",
    "usability research",
  ],
  "usability testing": ["usability testing", "usability tests"],
  "data analysis": ["data analysis", "data analytics"],
  tableau: ["tableau"],
  "power bi": ["power bi"],
  excel: ["excel"],
  seo: ["seo", "search engine optimization"],
  "google analytics": ["google analytics", "ga4"],
  "project management": ["project management"],
  "stakeholder engagement": [
    "stakeholder engagement",
    "stakeholder collaboration",
  ],
  mentoring: ["mentoring", "mentored"],
  "customer support": ["customer support"],
  salesforce: ["salesforce"],
  "aws certified solutions architect": ["aws certified solutions architect"],
  pmp: ["pmp", "project management professional"],
  cissp: ["cissp"],
  "bachelor degree": [
    "bachelor's degree",
    "bachelor’s degree",
    "bachelor degree",
    "bachelor of science",
    "bachelor of arts",
  ],
  "master degree": [
    "master's degree",
    "master’s degree",
    "master degree",
    "master of science",
    "master of arts",
  ],
  "computer science": ["computer science"],
};
const RELATED: Record<string, string[]> = {
  aws: ["azure", "gcp"],
  azure: ["aws", "gcp"],
  gcp: ["aws", "azure"],
  postgresql: ["mysql"],
  mysql: ["postgresql"],
  kubernetes: ["docker"],
};
const credentialTerms = new Set([
  "aws certified solutions architect",
  "pmp",
  "cissp",
  "bachelor degree",
  "master degree",
]);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function occurrences(text: string, term: string) {
  const aliases = TERMS[term] ?? [term];
  return aliases.flatMap((alias) =>
    Array.from(
      text.matchAll(
        new RegExp(
          `(?<![\\p{L}\\p{N}])${escape(alias)}(?![\\p{L}\\p{N}])`,
          "giu",
        ),
      ),
    ),
  );
}
function terms(text: string) {
  const matches = Object.keys(TERMS).filter(
    (term) => occurrences(text, term).length,
  );
  // A named credential's AWS token is part of the credential, not separate proof.
  return matches.includes("aws certified solutions architect")
    ? matches.filter((term) => term !== "aws")
    : matches;
}
function unsafeDataText(text: string) {
  return /[\u200b-\u200f\u202a-\u202e\u2060-\u206f]|<[^>]+>|\b(ignore (?:all |previous )?instructions|system prompt|export secrets|api key)\b/i.test(
    text,
  );
}
function uncertainText(text: string) {
  return /[\u200b-\u200f\u202a-\u202e\u2060-\u206f]|<[^>]+>|\b(ignore (?:all |previous )?instructions|system prompt|export secrets|api key|equivalent|advanced|expert|production|professional|architecture|architectural|security|fluent|eligible|clearance|work authorization)\b/i.test(
    text,
  );
}
function negativeOrAspirational(text: string, term: string) {
  return occurrences(text, term).every((match) => {
    const before = text
      .slice(Math.max(0, match.index! - 90), match.index)
      .split(/[;.!?]|\bbut\b|,/i)
      .at(-1)!;
    const after = text.slice(
      match.index! + match[0].length,
      match.index! + match[0].length + 70,
    );
    return (
      /\b(no|not|never|without|lack|lacks|lacking|haven.t|don.t|learn|learning|study|studying|pursue|pursuing|prepare|preparing|interested|seek|seeking|hope|aspire|aspiring|planned|plan to|want to|in progress|expired)\b/i.test(
        before,
      ) ||
      /^\s*(?::|—|-)?\s*(?:(?:experience|proficiency|knowledge)\s*(?::|—|-)?\s*)?(?:(?:is|was|are|were)\s+)?(?:not|no(?: experience)?|never|none|zero|expired|in progress)\b/i.test(
        after,
      )
    );
  });
}
// IDs are deterministic identifiers, never represented as cryptographic hashes.
function stableId(text: string) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export function reviewSnapshot(doc: ResumeDocument) {
  const value = JSON.stringify({
    id: doc.id,
    revision: doc.revision,
    name: doc.name,
    provenance: doc.provenance,
    contact: doc.contact,
    sections: doc.sections,
    presentation: doc.presentation,
  });
  if (value.length > 4_000_000)
    throw new Error(
      "This CV is too large for a local job review. Use a shorter working copy.",
    );
  return value;
}
export function extractJobCriteria(
  text: string,
  language: "english" | "other" = "english",
): { criteria: JobCriterion[]; warnings: string[] } {
  if (!text.trim()) throw new Error("Paste a job description first.");
  if (text.length > 20000)
    throw new Error("Use a job description of at most 20,000 characters.");
  const criteria: JobCriterion[] = [],
    warnings: string[] = [];
  const seenSignatures = new Map<string, JobCriterion>();
  let section: Priority | "responsibilities" | null = null;
  let offset = 0;
  for (const raw of text.split(/\n/)) {
    const base = offset;
    offset += raw.length + 1;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const heading = trimmed.replace(/[:：]$/, "");
    if (
      /^(?:required qualifications|requirements|minimum qualifications|must[- ]haves|qualifications)$/i.test(
        heading,
      )
    ) {
      section = "required";
      continue;
    }
    if (
      /^(?:preferred(?: qualifications)?|nice[- ]to[- ]haves?|bonus(?: qualifications)?|desired qualifications)$/i.test(
        heading,
      )
    ) {
      section = "preferred";
      continue;
    }
    if (
      /^(?:responsibilities|what you.ll do|your impact|duties)$/i.test(heading)
    ) {
      section = "responsibilities";
      continue;
    }
    if (
      /^(?:benefits|about us|about the company|compensation|how to apply|equal opportunity)$/i.test(
        heading,
      )
    ) {
      section = null;
      continue;
    }
    const content = trimmed.replace(/^(?:[•*–—-]|\d+[.)])\s*/, "");
    const explicitRequired =
      /\b(?:must|required|requirements?|minimum|must[- ]have)\b/i.test(content);
    const explicitPreferred =
      /\b(?:preferred|nice to have|bonus|optional|a plus|desirable)\b/i.test(
        content,
      );
    const bullet = content !== trimmed;
    if (
      !section &&
      !bullet &&
      !explicitRequired &&
      !explicitPreferred &&
      !/\b(?:experience with|proficient in|\d+\+?\s*years)\b/i.test(content)
    )
      continue;
    if (!content.length) continue;
    if (content.length > 2000)
      throw new Error(
        "Split job criteria into lines of at most 2,000 characters.",
      );
    const start = base + raw.indexOf(content),
      end = start + content.length;
    const priority: Priority =
      explicitPreferred && explicitRequired
        ? "uncertain"
        : explicitPreferred
          ? "preferred"
          : explicitRequired
            ? "required"
            : section === "required" || section === "preferred"
              ? section
              : "uncertain";
    const minimumYears = content.match(
      /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\b/i,
    );
    const detected = terms(content);
    const credential =
      /\b(degree|certified|certification|credential|license|licensed|bachelor|master|pmp|cissp)\b/i.test(
        content,
      );
    const category: JobCriterion["category"] = credential
      ? "credential"
      : minimumYears
        ? "experience"
        : section === "responsibilities"
          ? "responsibility"
          : detected.length
            ? "skill"
            : "other";
    const alternatives =
      /\bor\b/i.test(content) && !/\bequivalent\b/i.test(content)
        ? content
            .split(/\bor\b/i)
            .map((part) => terms(part))
            .filter((group) => group.length)
        : detected.length
          ? [detected]
          : [];
    const reviewReasons = [];
    if (
      language !== "english" ||
      /[\p{Script=Arabic}\p{Script=Bengali}\p{Script=Han}\p{Script=Cyrillic}]/u.test(
        content,
      )
    )
      reviewReasons.push(
        "Automatic matching is limited to English. Review this criterion manually.",
      );
    if (!detected.length)
      reviewReasons.push(
        "This criterion is outside the explicit term dictionary; its meaning needs manual review.",
      );
    if (minimumYears)
      reviewReasons.push(
        "Years of experience are not inferred or summed from dates. Verify the required duration manually.",
      );
    if (
      uncertainText(content) ||
      /\b(?:TS|JS|Go|R)\b/.test(content) ||
      (/(?<![\p{L}\p{N}])\d+(?:\.\d+)?(?![\p{L}\p{N}])/u.test(content) &&
        !minimumYears)
    )
      reviewReasons.push(
        "Qualifications, numbers or ambiguous wording need manual review.",
      );
    if (credential && !detected.some((term) => credentialTerms.has(term)))
      reviewReasons.push(
        "The exact credential is not recognized; related technology does not prove it.",
      );
    if (/\bor\b.*\b(?:and|plus)\b|\b(?:and|plus)\b.*\bor\b/i.test(content))
      reviewReasons.push(
        "Mixed AND/OR wording needs manual interpretation of the alternatives.",
      );
    if (
      /\b(?:and|or|plus)\b/i.test(content) &&
      content.split(/\b(?:and|or|plus)\b/i).some((part) => !terms(part).length)
    )
      reviewReasons.push(
        "An alternative or compound qualification is outside the recognized dictionary. Review the full criterion manually.",
      );
    if (/\b(?:not|no|never|without)\b/i.test(content))
      reviewReasons.push(
        "Negated requirement wording needs manual interpretation.",
      );
    if (explicitRequired && explicitPreferred)
      reviewReasons.push("The posting mixes required and preferred wording.");
    const signature = `${category}:${content
      .toLowerCase()
      .replace(/\b(?:required|must have|preferred|bonus|optional)\b/g, "")
      .replace(/[^\p{L}\p{N}+#]+/gu, " ")
      .trim()}`;
    const duplicate = seenSignatures.get(signature);
    if (duplicate) {
      if (duplicate.sources.length < 60)
        duplicate.sources.push({ quote: content, start, end });
      if (priority === "required") duplicate.priority = priority;
      continue;
    }
    if (criteria.length >= 60)
      throw new Error(
        "This posting contains more than 60 criteria. Review a shorter relevant excerpt.",
      );
    const baseId = `criterion-${stableId(signature)}`;
    const id = criteria.some((criterion) => criterion.id === baseId)
      ? `${baseId}-${criteria.length}`
      : baseId;
    const criterion = criterionSchema.parse({
      id,
      description: content,
      sources: [{ quote: content, start, end }],
      category,
      priority,
      priorityOrigin: "posting",
      alternatives,
      minimumYears: minimumYears ? Number(minimumYears[1]) : null,
      reviewReasons,
    });
    criteria.push(criterion);
    seenSignatures.set(signature, criterion);
  }
  if (!criteria.length)
    warnings.push(
      "Not enough information: no explicit criteria were recognized. Use labeled requirements or bullet lines; a generic paragraph is not treated as a qualification list.",
    );
  if (language !== "english")
    warnings.push(
      "Manual review: English term matching is disabled for this language.",
    );
  warnings.push(
    "This is a bounded local text rubric, not semantic AI analysis or a qualification verification. Confirm the posting's priorities and inspect every cited CV excerpt.",
  );
  return { criteria, warnings };
}
function candidateEvidence(doc: ResumeDocument) {
  const evidence: EvidenceRef[] = [];
  let characters = 0;
  for (const section of doc.sections.filter((section) => section.visible))
    for (const entry of section.entries) {
      for (const [field, value, bulletId] of [
        ["title", entry.title, undefined],
        ["description", entry.description, undefined],
        ...entry.bullets.map((bullet) => ["bullet", bullet.text, bullet.id]),
      ] as [string, string, string | undefined][]) {
        if (!value.trim()) continue;
        characters += value.length;
        if (characters > 200000 || evidence.length >= 1000)
          throw new Error(
            "Use a CV with at most 1,000 visible text fields and 200,000 visible characters for this review.",
          );
        for (const clause of value.matchAll(
          /[^\n;]+?(?:[.!?](?=\s|$)|(?=\n|;|$))/g,
        )) {
          const quote = clause[0].trim();
          if (!quote) continue;
          const start = clause.index! + clause[0].indexOf(quote);
          if (evidence.length >= 1000)
            throw new Error(
              "This CV has too many evidence excerpts. Use a shorter working copy.",
            );
          evidence.push({
            id: `${entry.id}:${bulletId || field}:${start}`,
            sectionId: section.id,
            entryId: entry.id,
            bulletId,
            quote,
            start,
            end: start + quote.length,
            label: `${section.label} · ${entry.title || "Untitled entry"}`,
            kind: section.type,
            field: field as EvidenceRef["field"],
          });
        }
      }
    }
  return evidence;
}
const appliedWork =
  /\b(built|led|maintained|managed|designed|developed|implemented|tested|test|created|researched|delivered|collaborated|partnered|conducted|launched|supported|analyzed|analysed|facilitated|optimized|optimised|deployed|used|using|migrated|automated|mentored|improved|reduced|increased)\b/i;
function matchCriterion(
  criterion: JobCriterion,
  evidence: EvidenceRef[],
  language: string,
): EvidenceMatch {
  if (language !== "english" || criterion.reviewReasons.length)
    return {
      criterion,
      status: "unknown",
      reason:
        criterion.reviewReasons.join(" ") ||
        "This language requires manual review.",
      evidence: evidence
        .filter((ref) =>
          criterion.alternatives
            .flat()
            .some(
              (term) =>
                occurrences(ref.quote, term).length &&
                !negativeOrAspirational(ref.quote, term),
            ),
        )
        .slice(0, 3),
    };
  const wanted = criterion.alternatives.flat();
  const direct: EvidenceRef[] = [],
    partial: EvidenceRef[] = [],
    unsupported: EvidenceRef[] = [];
  for (const ref of evidence) {
    if (
      unsafeDataText(ref.quote) ||
      /[\p{Script=Arabic}\p{Script=Bengali}\p{Script=Han}\p{Script=Cyrillic}]/u.test(
        ref.quote,
      )
    ) {
      if (wanted.some((term) => occurrences(ref.quote, term).length))
        unsupported.push(ref);
      continue;
    }
    const positive = (term: string) =>
      occurrences(ref.quote, term).length > 0 &&
      !negativeOrAspirational(ref.quote, term);
    const some = wanted.some(positive);
    const complete = criterion.alternatives.some((group) =>
      group.every(positive),
    );
    const applied =
      ["experience", "projects", "custom"].includes(ref.kind) &&
      appliedWork.test(ref.quote);
    const earned =
      ["education", "certifications"].includes(ref.kind) &&
      !/\b(preparing|studying|pursuing|course|training|in progress|expired|planned)\b/i.test(
        ref.quote,
      );
    if (complete && (criterion.category === "credential" ? earned : applied))
      direct.push(ref);
    else if (some && criterion.category !== "credential") partial.push(ref);
    else if (
      criterion.category !== "credential" &&
      wanted.some((term) => (RELATED[term] || []).some(positive))
    )
      partial.push(ref);
  }
  if (direct.length)
    return {
      criterion,
      status: "direct",
      reason:
        criterion.category === "credential"
          ? "A visible education/certification excerpt names the exact credential without an in-progress qualifier. Confirm its actual award and validity manually."
          : "A visible role/project excerpt contains every term in one allowed alternative and an application verb. This is textual support for review, not external verification.",
      evidence: direct.slice(0, 3),
    };
  if (partial.length)
    return {
      criterion,
      status: "partial",
      reason:
        "Only a skill-list/summary mention, related technology, or part of a compound criterion was found. It does not prove the full qualification.",
      evidence: partial.slice(0, 3),
    };
  if (unsupported.length)
    return {
      criterion,
      status: "unknown",
      reason:
        "A term appears in unsupported language or suspicious markup. Interpret this excerpt manually; it cannot supply automatic support.",
      evidence: unsupported.slice(0, 3),
    };
  return {
    criterion,
    status: "absent",
    reason:
      "No supporting visible CV excerpt was found. This describes this CV's text, not your ability; add real experience in the editor if it is missing.",
    evidence: [],
  };
}
export function calculateJobMatches(
  criteria: JobCriterion[],
  doc: ResumeDocument,
  language: "english" | "other",
) {
  const evidence = candidateEvidence(doc);
  return z
    .array(criterionSchema)
    .max(60)
    .parse(criteria)
    .map((criterion) => matchCriterion(criterion, evidence, language));
}
export function coverageGroups(
  matches: EvidenceMatch[],
): Record<Priority, CoverageGroup> {
  return Object.fromEntries(
    prioritySchema.options.map((priority) => {
      const rows = matches.filter(
        (match) => match.criterion.priority === priority,
      );
      const count = (status: EvidenceMatch["status"]) =>
        rows.filter((row) => row.status === status).length;
      return [
        priority,
        {
          total: rows.length,
          direct: count("direct"),
          partial: count("partial"),
          unknown: count("unknown"),
          absent: count("absent"),
          scorable: rows.length - count("unknown"),
          supportUnits: count("direct") + 0.5 * count("partial"),
          weight:
            priority === "required" ? 2 : priority === "preferred" ? 1 : 0,
        },
      ];
    }),
  ) as Record<Priority, CoverageGroup>;
}
export async function reviewJobEvidence(
  doc: ResumeDocument,
  jobText: string,
  target: JobEvidenceReview["target"],
): Promise<JobEvidenceReview> {
  target = z
    .strictObject({
      role: z.string().trim().min(1).max(200),
      company: z.string().trim().max(200),
      seniority: z.string().min(1).max(100),
      language: z.enum(["english", "other"]),
    })
    .parse(target);
  const parsed = extractJobCriteria(jobText, target.language);
  const matches = calculateJobMatches(parsed.criteria, doc, target.language),
    sourceSnapshot = reviewSnapshot(doc);
  return {
    version: JOB_EVIDENCE_VERSION,
    termsVersion: JOB_TERMS_VERSION,
    analyzedAt: new Date().toISOString(),
    target,
    jobText,
    jobHash: await sha256(jobText),
    sourceHash: await sha256(sourceSnapshot),
    sourceSnapshot,
    sourceId: doc.id,
    sourceRevision: doc.revision,
    matches,
    groups: coverageGroups(matches),
    warnings: parsed.warnings,
  };
}
export type OrderProposal = {
  id: string;
  sectionId: string;
  entryId: string;
  label: string;
  before: string[];
  after: string[];
  evidenceIds: string[];
  requirementIds: string[];
  reason: string;
};
export function proposeEvidenceOrder(
  doc: ResumeDocument,
  review: JobEvidenceReview,
): OrderProposal[] {
  if (
    reviewSnapshot(doc) !== review.sourceSnapshot ||
    review.target.language !== "english"
  )
    return [];
  const supported = review.matches.filter(
    (match) =>
      match.status === "direct" && match.criterion.priority !== "uncertain",
  );
  const proposals: OrderProposal[] = [];
  for (const section of doc.sections.filter(
    (section) =>
      section.visible &&
      ["experience", "projects", "custom"].includes(section.type),
  ))
    for (const entry of section.entries) {
      const relevance = (id: string) =>
        supported.reduce(
          (sum, match) =>
            sum +
            (match.evidence.some((ref) => ref.bulletId === id)
              ? match.criterion.priority === "required"
                ? 2
                : 1
              : 0),
          0,
        );
      const before = entry.bullets.map((bullet) => bullet.id),
        after = [...entry.bullets]
          .sort((a, b) => relevance(b.id) - relevance(a.id))
          .map((bullet) => bullet.id);
      if (before.join("|") === after.join("|")) continue;
      const refs = supported.flatMap((match) =>
        match.evidence.filter(
          (ref) => ref.entryId === entry.id && ref.bulletId,
        ),
      );
      proposals.push({
        id: `order-${entry.id}`,
        sectionId: section.id,
        entryId: entry.id,
        label: entry.title || section.label,
        before,
        after,
        evidenceIds: refs.map((ref) => ref.id),
        requirementIds: supported
          .filter((match) =>
            match.evidence.some(
              (ref) => ref.entryId === entry.id && ref.bulletId,
            ),
          )
          .map((match) => match.criterion.id),
        reason:
          "Bring bullets with direct text support for reviewed requirements forward. Every bullet and its wording is preserved.",
      });
      if (proposals.length === 3) return proposals;
    }
  return proposals;
}
export function createReviewedVariant(
  doc: ResumeDocument,
  review: JobEvidenceReview,
  acceptedIds: string[],
): ResumeDocument {
  if (reviewSnapshot(doc) !== review.sourceSnapshot)
    throw new Error(
      "The CV changed after this review. Analyze the current snapshot again.",
    );
  const available = proposeEvidenceOrder(doc, review);
  if (
    !acceptedIds.length ||
    new Set(acceptedIds).size !== acceptedIds.length ||
    acceptedIds.some((id) => !available.some((proposal) => proposal.id === id))
  )
    throw new Error("Select valid reviewed ordering proposals first.");
  // Recompute the operations from current text. No supplied replacement text or
  // arbitrary mutation path is accepted by this local operation boundary.
  const variant = duplicateDocument(
    doc,
    `${doc.contact.name || "Resume"} — ${review.target.role}${review.target.company ? ` at ${review.target.company}` : ""} (Tailored)`,
  );
  for (const proposal of available.filter((proposal) =>
    acceptedIds.includes(proposal.id),
  )) {
    const entry = variant.sections
      .find((section) => section.id === proposal.sectionId)!
      .entries.find((entry) => entry.id === proposal.entryId)!;
    entry.bullets = proposal.after.map((id) =>
      entry.bullets.find((bullet) => bullet.id === id)!,
    );
  }
  return variant;
}
