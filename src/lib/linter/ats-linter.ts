import {
  isAchievementSection,
  type ResumeDocument,
  type SectionType,
} from "../document";

export interface AtsLintIssue {
  id: string;
  ruleId:
    | "weak_verb"
    | "missing_metric"
    | "bullet_length"
    | "contact_missing"
    | "date_format"
    | "empty_section";
  severity: "critical" | "warning" | "suggestion";
  message: string;
  sectionId?: string;
  entryId?: string;
  bulletId?: string;
  suggestion?: string;
}

export interface AtsReadinessReport {
  extractionStatus: "not_checked";
  totalBulletsCount: number;
  weakOpeningCount: number;
  metricsCount: number;
  contactFieldsPresent: number;
  validDateCount: number;
  totalDateCount: number;
  issues: AtsLintIssue[];
}

export const WEAK_OPENING_PATTERNS = [
  /^responsible for\b/i,
  /^duties included\b/i,
  /^worked on\b/i,
  /^assisted (with|in|to)?\b/i,
  /^helped (with|to|in|team)?\b/i,
  /^served as\b/i,
  /^participated in\b/i,
  /^handled\b/i,
  /^tasked with\b/i,
  /^involved in\b/i,
  /^part of a team that\b/i,
];

export const METRIC_PATTERNS = [
  // Percentages: 25%, 3.5%
  /\b\d+(\.\d+)?%(?!\w)/,
  // Currency values: $500, $1.2M, €40k, £100B
  /[$€£¥]\s*\d+(\.\d+)?[kmb]?(?!\w)/i,
  /\b\d+(\.\d+)?\s*[kmb]?\s*(dollars|usd|eur|gbp)\b/i,
  // Multipliers: 3x, 10x, 2.5x
  /\b\d+(\.\d+)?x(?!\w)/i,
  // Latency & time: 45ms, 2.5s, 30 minutes, 4 hours, 3 weeks
  /\b\d+(\.\d+)?\s*(ms|milliseconds|seconds|mins|minutes|hours|days|weeks|months)\b/i,
  // Scale & volume: 500k users, 10M daily active users, 40 microservices
  /\b\d+(\.\d+)?\s*(k|m|b|million|billion|thousand)?\s*(?:[\w-]+\s+){0,3}(users|customers|clients|requests|queries|nodes|clusters|endpoints|microservices|pipelines|engineers|developers|leads|sales)\b/i,
];

export function hasQuantifiableMetric(bulletText: string): boolean {
  return METRIC_PATTERNS.some((pattern) => pattern.test(bulletText));
}

export function isWeakOpening(bulletText: string): boolean {
  return WEAK_OPENING_PATTERNS.some((pattern) =>
    pattern.test(bulletText.trim()),
  );
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Checks one bullet. The editor uses this for inline hints and the full
 * document report uses it for every visible bullet, so both always agree.
 */
export function lintBullet(
  rawText: string,
  sectionType: SectionType,
  ref: { sectionId?: string; entryId?: string; bulletId: string },
): {
  counted: boolean;
  weakOpening: boolean;
  hasMetric: boolean;
  issues: AtsLintIssue[];
} {
  const text = rawText.trim();
  const issues: AtsLintIssue[] = [];
  if (!text)
    return { counted: false, weakOpening: false, hasMetric: false, issues };
  const words = wordCount(text);
  // List items such as a skill or a language may be one word; only
  // achievement sentences get the verb and length checks.
  const sentence = isAchievementSection(sectionType);
  const weakOpening = sentence && isWeakOpening(text);
  if (weakOpening) {
    issues.push({
      id: `weak-verb-${ref.bulletId}`,
      ruleId: "weak_verb",
      severity: "warning",
      message: `Bullet starts with a vague opening: “${text.slice(0, 30)}…”.`,
      ...ref,
      suggestion:
        "Replace with an active verb (e.g. Engineered, Spearheaded, Optimized).",
    });
  }
  const hasMetric = hasQuantifiableMetric(text);
  if (!hasMetric && sectionType === "experience") {
    issues.push({
      id: `no-metric-${ref.bulletId}`,
      ruleId: "missing_metric",
      severity: "suggestion",
      message: `No numeric pattern found in: “${text.slice(0, 35)}…”.`,
      ...ref,
      suggestion:
        "Describe a real outcome. Include a number only if you can support it; qualitative outcomes can also be useful.",
    });
  }
  if (!sentence) {
    // No length checks for list items.
  } else if (words < 5) {
    issues.push({
      id: `short-${ref.bulletId}`,
      ruleId: "bullet_length",
      severity: "warning",
      message: `Bullet is very short (${words} words): “${text}”.`,
      ...ref,
      suggestion: "Expand accomplishment to detail the task and the outcome.",
    });
  } else if (words > 40) {
    issues.push({
      id: `long-${ref.bulletId}`,
      ruleId: "bullet_length",
      severity: "suggestion",
      message: `Bullet is lengthy (${words} words). Consider breaking it into two focused bullets.`,
      ...ref,
    });
  }
  // Only achievement sentences count toward the bullet and result totals.
  return { counted: sentence, weakOpening, hasMetric, issues };
}

/**
 * Runs deterministic ATS quality heuristics across a ResumeDocument.
 */
export function lintResumeDocument(doc: ResumeDocument): AtsReadinessReport {
  const issues: AtsLintIssue[] = [];

  let totalBullets = 0;
  let weakOpeningCount = 0;
  let metricsCount = 0;

  // 1. Contact Info Completeness
  let contactFieldsPopulated = 0;
  if (!doc.contact.name.trim()) {
    issues.push({
      id: "contact-name",
      ruleId: "contact_missing",
      severity: "critical",
      message: "Full name is missing from the header.",
      sectionId: "contact",
    });
  } else {
    contactFieldsPopulated++;
  }

  if (!doc.contact.email.trim()) {
    issues.push({
      id: "contact-email",
      ruleId: "contact_missing",
      severity: "critical",
      message: "Email address is missing from the header.",
      sectionId: "contact",
    });
  } else {
    contactFieldsPopulated++;
  }

  if (!doc.contact.location.trim()) {
    issues.push({
      id: "contact-location",
      ruleId: "contact_missing",
      // Optional advice, so it is a suggestion rather than a warning.
      severity: "suggestion",
      message:
        "Location is missing. Consider including it if relevant to your application.",
      sectionId: "contact",
    });
  } else {
    contactFieldsPopulated++;
  }

  // 2. Sections and Entries Audit
  let validDateCount = 0;
  let totalDateCount = 0;

  for (const section of doc.sections) {
    if (!section.visible) continue;

    if (section.entries.length === 0 && section.type !== "summary") {
      issues.push({
        id: `empty-sec-${section.id}`,
        ruleId: "empty_section",
        severity: "suggestion",
        message: `Section “${section.label}” has no entries. Add an entry or hide the section.`,
        sectionId: section.id,
      });
    }

    for (const entry of section.entries) {
      // Date consistency checks
      if (entry.start) {
        totalDateCount++;
        if (/^(\d{4}|\d{4}-(0[1-9]|1[0-2]))$/.test(entry.start)) {
          validDateCount++;
        } else {
          issues.push({
            id: `date-start-${entry.id}`,
            ruleId: "date_format",
            severity: "warning",
            message: `Start date “${entry.start}” in ${entry.title || "entry"} is not YYYY or YYYY-MM.`,
            sectionId: section.id,
            entryId: entry.id,
          });
        }
      }
      if (entry.end && !entry.current) {
        totalDateCount++;
        if (/^(\d{4}|\d{4}-(0[1-9]|1[0-2]))$/.test(entry.end)) {
          validDateCount++;
        } else {
          issues.push({
            id: `date-end-${entry.id}`,
            ruleId: "date_format",
            severity: "warning",
            message: `End date “${entry.end}” in ${entry.title || "entry"} is not YYYY or YYYY-MM.`,
            sectionId: section.id,
            entryId: entry.id,
          });
        }
      }

      // Skills and languages store list items as bullets; accomplishment rules
      // (verbs, numbers, length) do not apply to them.
      if (section.type === "skills" || section.type === "languages") continue;

      // Bullets check
      for (const bullet of entry.bullets) {
        const result = lintBullet(bullet.text, section.type, {
          sectionId: section.id,
          entryId: entry.id,
          bulletId: bullet.id,
        });
        if (!result.counted) continue;
        totalBullets++;
        if (result.weakOpening) weakOpeningCount++;
        if (result.hasMetric) metricsCount++;
        issues.push(...result.issues);
      }
    }
  }

  // Observations about the document model, not an ATS acceptance prediction.
  return {
    extractionStatus: "not_checked",
    totalBulletsCount: totalBullets,
    weakOpeningCount,
    metricsCount,
    contactFieldsPresent: contactFieldsPopulated,
    validDateCount,
    totalDateCount,
    issues,
  };
}
