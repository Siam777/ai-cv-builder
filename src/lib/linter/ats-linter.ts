import type { ResumeDocument, Entry, Bullet } from "../document";

export interface AtsLintIssue {
  id: string;
  ruleId: "weak_verb" | "missing_metric" | "bullet_length" | "contact_missing" | "date_format" | "empty_section";
  severity: "critical" | "warning" | "suggestion";
  message: string;
  sectionId?: string;
  entryId?: string;
  bulletId?: string;
  suggestion?: string;
}

export interface AtsReadinessReport {
  score: number; // 0 to 100
  verbsScore: number; // 0 to 100
  metricsScore: number; // 0 to 100
  hygieneScore: number; // 0 to 100
  extractionScore: number; // 0 to 100
  totalBulletsCount: number;
  strongVerbsCount: number;
  metricsCount: number;
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
  return WEAK_OPENING_PATTERNS.some((pattern) => pattern.test(bulletText.trim()));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Runs deterministic ATS quality heuristics across a ResumeDocument.
 */
export function lintResumeDocument(doc: ResumeDocument): AtsReadinessReport {
  const issues: AtsLintIssue[] = [];

  let totalBullets = 0;
  let strongVerbsCount = 0;
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
      message: "Email address is missing. ATS requires direct candidate contact.",
      sectionId: "contact",
    });
  } else {
    contactFieldsPopulated++;
  }

  if (!doc.contact.location.trim()) {
    issues.push({
      id: "contact-location",
      ruleId: "contact_missing",
      severity: "warning",
      message: "Location (City, Country) is missing. Location filters are common in ATS screening.",
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

      // Bullets check
      for (const bullet of entry.bullets) {
        const text = bullet.text.trim();
        if (!text) continue;

        totalBullets++;
        const words = wordCount(text);

        // Check weak verb
        const isPassive = isWeakOpening(text);
        if (isPassive) {
          issues.push({
            id: `weak-verb-${bullet.id}`,
            ruleId: "weak_verb",
            severity: "warning",
            message: `Bullet starts with passive phrasing: “${text.slice(0, 30)}…”.`,
            sectionId: section.id,
            entryId: entry.id,
            bulletId: bullet.id,
            suggestion: "Replace with an active verb (e.g. Engineered, Spearheaded, Optimized).",
          });
        } else {
          strongVerbsCount++;
        }

        // Check quantifiable metric
        const hasMetric = hasQuantifiableMetric(text);
        if (hasMetric) {
          metricsCount++;
        } else if (section.type === "experience") {
          issues.push({
            id: `no-metric-${bullet.id}`,
            ruleId: "missing_metric",
            severity: "suggestion",
            message: `Missing measurable outcome in: “${text.slice(0, 35)}…”.`,
            sectionId: section.id,
            entryId: entry.id,
            bulletId: bullet.id,
            suggestion: "Add a quantitative outcome (e.g., % latency drop, $ saved, or user scale).",
          });
        }

        // Check word length
        if (words < 5) {
          issues.push({
            id: `short-${bullet.id}`,
            ruleId: "bullet_length",
            severity: "warning",
            message: `Bullet is very short (${words} words): “${text}”.`,
            sectionId: section.id,
            entryId: entry.id,
            bulletId: bullet.id,
            suggestion: "Expand accomplishment to detail the task and the outcome.",
          });
        } else if (words > 40) {
          issues.push({
            id: `long-${bullet.id}`,
            ruleId: "bullet_length",
            severity: "suggestion",
            message: `Bullet is lengthy (${words} words). Consider breaking it into two focused bullets.`,
            sectionId: section.id,
            entryId: entry.id,
            bulletId: bullet.id,
          });
        }
      }
    }
  }

  // Calculate scores
  const verbsScore =
    totalBullets > 0 ? Math.round((strongVerbsCount / totalBullets) * 100) : 100;
  const metricsScore =
    totalBullets > 0 ? Math.round((metricsCount / totalBullets) * 100) : 100;
  const dateScore =
    totalDateCount > 0 ? (validDateCount / totalDateCount) * 50 : 50;
  const contactScore = (contactFieldsPopulated / 3) * 50;
  const hygieneScore = Math.round(dateScore + contactScore);
  const extractionScore = 100; // Layout uses valid linear DOM structure

  // Composite Formula:
  // 0.25 * verbs + 0.30 * metrics + 0.25 * extraction + 0.20 * hygiene
  const score = Math.round(
    0.25 * verbsScore +
      0.30 * metricsScore +
      0.25 * extractionScore +
      0.20 * hygieneScore,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    verbsScore,
    metricsScore,
    hygieneScore,
    extractionScore,
    totalBulletsCount: totalBullets,
    strongVerbsCount,
    metricsCount,
    issues,
  };
}
