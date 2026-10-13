import type { ResumeDocument, Section, SectionType } from "./document";
import type { AtsLintIssue } from "./linter/ats-linter";

/**
 * Content completeness for the editor: how much of a typical CV is filled in.
 * It is a writing aid, not a hiring or ATS score.
 */
export type StepStatus = "empty" | "progress" | "done" | "issues";

export interface StrengthItem {
  id: string;
  label: string;
  /** Short call to action shown as the next best step. */
  action: string;
  weight: number;
  done: boolean;
  /** Editor step that fixes this item ("contact" or a section id). */
  stepId: string;
}

export interface CvStrength {
  percent: number;
  items: StrengthItem[];
  next: StrengthItem | null;
  steps: Record<string, StepStatus>;
}

const hasText = (value: string | undefined) => Boolean(value?.trim());

function entryHasContent(entry: Section["entries"][number]) {
  return (
    hasText(entry.title) ||
    hasText(entry.organization) ||
    hasText(entry.description) ||
    entry.bullets.some((b) => hasText(b.text))
  );
}

function filled(section: Section | undefined) {
  return Boolean(section?.entries.some(entryHasContent));
}

function sectionText(section: Section | undefined) {
  return (section?.entries ?? [])
    .flatMap((e) => [e.title, e.description, ...e.bullets.map((b) => b.text)])
    .join(" ")
    .trim();
}

const EXTRA_TYPES: SectionType[] = [
  "projects",
  "certifications",
  "languages",
  "custom",
];

export function cvStrength(
  doc: ResumeDocument,
  issues: AtsLintIssue[] = [],
): CvStrength {
  const visible = doc.sections.filter((s) => s.visible);
  const first = (type: SectionType) => visible.find((s) => s.type === type);
  const summary = first("summary");
  const experience = visible.filter((s) => s.type === "experience");
  const education = first("education");
  const skills = first("skills");
  const extras = visible.filter((s) => EXTRA_TYPES.includes(s.type));
  const bullets = experience.flatMap((s) =>
    s.entries.flatMap((e) => e.bullets.filter((b) => hasText(b.text))),
  );
  const withNumbers = bullets.filter((b) => /\d/.test(b.text)).length;
  const c = doc.contact;

  const candidates: (StrengthItem | null)[] = [
    {
      id: "name",
      label: "Name",
      action: "Add your name",
      weight: 10,
      done: hasText(c.name),
      stepId: "contact",
    },
    {
      id: "reach",
      label: "Contact details",
      action: "Add an email and a phone or location",
      weight: 10,
      done: hasText(c.email) && (hasText(c.phone) || hasText(c.location)),
      stepId: "contact",
    },
    {
      id: "headline",
      label: "Headline",
      action: "Add a professional headline",
      weight: 5,
      done: hasText(c.headline),
      stepId: "contact",
    },
    summary
      ? {
          id: "summary",
          label: "Summary",
          action: "Add a short summary",
          weight: 15,
          done: sectionText(summary).length >= 40,
          stepId: summary.id,
        }
      : null,
    experience.length
      ? {
          id: "experience",
          label: "Work experience",
          action: "Add a job, internship or volunteer role",
          weight: 20,
          done: experience.some(filled),
          stepId: experience[0].id,
        }
      : null,
    experience.length
      ? {
          id: "results",
          label: "Results in bullets",
          action: "Add a number or result to your bullets",
          weight: 15,
          done: bullets.length >= 2 && withNumbers * 2 >= bullets.length,
          stepId: experience[0].id,
        }
      : null,
    education
      ? {
          id: "education",
          label: "Education",
          action: "Add your education",
          weight: 10,
          done: filled(education),
          stepId: education.id,
        }
      : null,
    skills
      ? {
          id: "skills",
          label: "Skills",
          action: "Add your key skills",
          weight: 10,
          done: filled(skills),
          stepId: skills.id,
        }
      : null,
    extras.length
      ? {
          id: "extras",
          label: "Projects, certificates or languages",
          action: "Add a project, certificate or language",
          weight: 5,
          done: extras.some(filled),
          stepId: extras[0].id,
        }
      : null,
  ];
  const items = candidates.filter((i): i is StrengthItem => i !== null);
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  const earned = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);

  // Findings that need attention; empty sections are shown as "empty" instead.
  const flagged = new Set(
    issues
      .filter((i) => i.severity !== "suggestion" && i.sectionId)
      .map((i) => i.sectionId!),
  );
  const steps: Record<string, StepStatus> = {};
  const contactFields = [c.name, c.email, c.phone, c.location, c.headline];
  const contactItems = items.filter((i) => i.stepId === "contact");
  steps.contact = flagged.has("contact")
    ? contactFields.some(hasText)
      ? "issues"
      : "empty"
    : contactItems.every((i) => i.done)
      ? "done"
      : contactFields.some(hasText)
        ? "progress"
        : "empty";
  for (const section of doc.sections) {
    const own = items.filter((i) => i.stepId === section.id);
    const status: StepStatus = !filled(section)
      ? "empty"
      : flagged.has(section.id)
        ? "issues"
        : own.length && !own.every((i) => i.done)
          ? "progress"
          : "done";
    steps[section.id] = status;
  }

  return {
    percent: total ? Math.round((earned / total) * 100) : 0,
    items,
    next: items.find((i) => !i.done) ?? null,
    steps,
  };
}
