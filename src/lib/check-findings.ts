import { labels, type ResumeDocument } from "./document";
import type { AtsLintIssue } from "./linter/ats-linter";

/** How a finding is shown in the Check panel and next to a field. */
export interface FindingCopy {
  /** One short line, written as the thing to do. */
  title: string;
  /** Muted explanation under the title. */
  detail?: string;
  /** The start of the text the finding refers to, if any. */
  quote?: string;
  tone: "attention" | "suggestion";
}

const CONTACT_TITLES: Record<string, string> = {
  "contact-name": "Add your full name",
  "contact-email": "Add your email address",
  "contact-location": "Add your city or region",
};

/** The start of a text, cut at a word boundary. */
export function excerpt(text: string, max = 60) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,;:.]$/, "")}…`;
}

/**
 * Plain-language copy for a finding. Pass the full text the finding refers to
 * (such as the bullet) to quote it cleanly; otherwise the message is used.
 */
export function describeFinding(
  issue: AtsLintIssue,
  sourceText?: string,
): FindingCopy {
  const tone = issue.severity === "suggestion" ? "suggestion" : "attention";
  const quoted = (message: string) => {
    if (sourceText?.trim()) return excerpt(sourceText);
    const match = message.match(/“([^”]*)”/);
    return match ? match[1].replace(/…$/, "").trim() : undefined;
  };
  switch (issue.ruleId) {
    case "contact_missing":
      return {
        title: CONTACT_TITLES[issue.id] ?? "Complete your contact details",
        detail:
          issue.id === "contact-location"
            ? "A city and country are usually enough."
            : "Recruiters need a way to reach you.",
        tone,
      };
    case "weak_verb":
      return {
        title: "Start with a stronger verb",
        detail: "Say what you did, for example Led, Built, Reduced or Organized.",
        quote: quoted(issue.message),
        tone,
      };
    case "missing_metric":
      return {
        title: "Add a result",
        detail:
          "Show the outcome. Use a number only if you can support it; a clear qualitative result also works.",
        quote: quoted(issue.message),
        tone,
      };
    case "bullet_length":
      return issue.id.startsWith("short-")
        ? {
            title: "Bullet is very short",
            detail: "Add what you did and what changed because of it.",
            quote: quoted(issue.message),
            tone,
          }
        : {
            title: "Bullet is long",
            detail: "Split it into two focused bullets.",
            tone,
          };
    case "date_format":
      return {
        title: "Use YYYY or YYYY-MM dates",
        detail: issue.message,
        tone,
      };
    case "empty_section":
      return {
        title: "Section has no entries",
        detail: "Add an entry, or hide the section if it does not apply.",
        tone,
      };
  }
}

export interface FindingGroup {
  stepId: string;
  label: string;
  issues: AtsLintIssue[];
}

const SEVERITY_ORDER = { critical: 0, warning: 1, suggestion: 2 } as const;

/** Findings grouped by editor step, in the order the steps appear. */
export function groupFindings(
  doc: ResumeDocument,
  issues: AtsLintIssue[],
): FindingGroup[] {
  const steps = [
    { id: "contact", label: "Personal details" },
    ...doc.sections.map((s) => ({ id: s.id, label: s.label || labels[s.type] })),
  ];
  return steps
    .map((step) => ({
      stepId: step.id,
      label: step.label,
      issues: issues
        .filter((i) => (i.sectionId ?? "contact") === step.id)
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    }))
    .filter((group) => group.issues.length > 0);
}
