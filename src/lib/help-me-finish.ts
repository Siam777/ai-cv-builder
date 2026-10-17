import type { ResumeDocument } from "./document";
import type { FieldActionId, FieldKind } from "./field-ai";
import {
  discoverDemonstratedSkills,
  generateExecutiveSummaries,
  generateInterviewClarifications,
} from "./vault/ai-assistant";

/** One thing the AI Assistant suggests finishing, and where to do it. */
export interface HelpItem {
  id: string;
  kind: FieldKind;
  action: FieldActionId;
  title: string;
  detail: string;
  buttonLabel: string;
  /** Section the field lives in; null when the section must be added first. */
  sectionId: string | null;
  sectionType: "summary" | "skills" | "experience" | "projects";
  entryId?: string;
  bulletId?: string;
}

const MAX_ITEMS = 8;

function clip(text: string, length: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

/** Plain-language to-do list built from what is missing in the CV. */
export function helpMeFinish(doc: ResumeDocument): HelpItem[] {
  const items: HelpItem[] = [];

  const summary = doc.sections.find((s) => s.type === "summary");
  const summaryText = summary?.entries
    .map((e) => e.description)
    .join("")
    .trim();
  if (!summaryText && generateExecutiveSummaries(doc).length) {
    items.push({
      id: "summary",
      kind: "summary",
      action: "draft",
      title: "Write a summary",
      detail:
        "Recruiters read the top first. Draft one from the details already in your CV, then edit it.",
      buttonLabel: "Draft a summary",
      sectionId: summary?.id ?? null,
      sectionType: "summary",
    });
  }

  for (const question of generateInterviewClarifications(doc, 5)) {
    const section = doc.sections.find((s) => s.id === question.sectionId);
    items.push({
      id: `result-${question.bulletId}`,
      kind: "bullet",
      action: "result",
      title: `Add a result to “${clip(question.originalBullet, 70)}”`,
      detail: `${question.entryTitle}${
        question.organization ? ` at ${question.organization}` : ""
      }. A number or outcome you can back up makes this bullet stronger.`,
      buttonLabel: "Add a result",
      sectionId: question.sectionId,
      sectionType: section?.type === "projects" ? "projects" : "experience",
      entryId: question.entryId,
      bulletId: question.bulletId,
    });
  }

  const skills = discoverDemonstratedSkills(doc);
  if (skills.length) {
    const skillsSection = doc.sections.find((s) => s.type === "skills");
    items.push({
      id: "skills",
      kind: "skills",
      action: "skills",
      title: `Add ${skills.length} skill${skills.length === 1 ? "" : "s"} your bullets already show`,
      detail: `${skills
        .slice(0, 4)
        .map((s) => s.skill)
        .join(", ")}${
        skills.length > 4 ? " and more" : ""
      } appear in your experience but not in Skills.`,
      buttonLabel: "Review skills",
      sectionId: skillsSection?.id ?? null,
      sectionType: "skills",
    });
  }

  return items.slice(0, MAX_ITEMS);
}
