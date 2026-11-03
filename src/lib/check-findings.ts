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
    // Whole-CV consistency findings. The wording never implies dishonesty.
    case "date_order":
      return { title: "End date is before the start date", detail: issue.message, tone };
    case "date_future":
      return { title: "End date is in the future", detail: issue.message, tone };
    case "date_missing":
      return {
        title: "Add a start date",
        detail: `${issue.message} Dates help a reader follow your career.`,
        tone,
      };
    case "date_overlap":
      return {
        title: "Check these dates",
        detail: `${issue.message} That is fine for part-time or freelance work; confirm it if it is right.`,
        tone,
      };
    case "org_spelling":
      return { title: "Write the employer the same way", detail: issue.message, tone };
    case "title_variant":
      return { title: "Write the job title the same way", detail: issue.message, tone };
    case "duplicate_bullet":
      return {
        title: "Two bullets say the same thing",
        detail: issue.message,
        quote: sourceText?.trim() ? excerpt(sourceText) : undefined,
        tone,
      };
    case "repeated_number":
      return {
        title: "The same number appears twice",
        detail: issue.message,
        quote: sourceText?.trim() ? excerpt(sourceText) : undefined,
        tone,
      };
    case "years_claim":
      return {
        title: "Check the years you mention",
        detail: `${issue.message} If your CV shows only your recent roles, confirm this; otherwise check the number.`,
        tone,
      };
    case "skill_without_evidence":
      return {
        title: "Show where you used these skills",
        detail: `Not mentioned anywhere else in your CV: ${issue.message} Add them to a bullet, or confirm they belong.`,
        tone,
      };
    case "number_to_confirm":
      return {
        title: "Can you back up these numbers?",
        detail: `${issue.message} Be ready to explain each one in an interview, then confirm.`,
        tone,
      };
  }
}

/** A whole-CV consistency finding, shown under its own heading. */
export function isConsistency(issue: AtsLintIssue) {
  return issue.category === "consistency";
}

/**
 * Open consistency findings that need attention before an export: not
 * dismissed, not confirmed and not just suggestions.
 */
export function exportReminders(issues: AtsLintIssue[], hidden: Set<string>) {
  return issues.filter(
    (issue) => isConsistency(issue) && issue.severity !== "suggestion" && !hidden.has(issue.id),
  );
}

/**
 * A section the person has not started yet. It is a to-do, not a problem, so
 * it is listed apart from findings and not counted as one.
 */
export function isNotStarted(issue: AtsLintIssue) {
  return issue.ruleId === "empty_section";
}

/** Findings worth fixing: open (not dismissed) and not just "not started". */
export function issuesToFix(issues: AtsLintIssue[], dismissed: Set<string>) {
  return issues.filter((issue) => !dismissed.has(issue.id) && !isNotStarted(issue));
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
