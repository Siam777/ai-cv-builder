import { createDocument, type ResumeDocument } from "./document";
import { templates, type Presentation } from "./presentation";
import { DEMO_PROFILES } from "./demo-resumes";

export const publicDesigns = templates.map((template) => ({
  id: template.id,
  name: template.name,
  formats: ["PDF", "Word", "HTML", "Text", "Markdown", "JSON"],
  columns: template.id === "creative" ? "Sidebar" : "Single column",
  stages: ["compact", "academic", "tech"].includes(template.id)
    ? ["Early career", "Experienced"]
    : ["executive", "elegant"].includes(template.id)
      ? ["Experienced", "Leadership"]
      : ["Early career", "Experienced", "Leadership"],
  family: (
    ["classic", "compact", "executive", "minimalist"] as string[]
  ).includes(template.id)
    ? "Quiet & classic"
    : "Accent & structure",
  description:
    template.id === "minimalist"
      ? "Generous white space and understated typography."
      : template.description,
}));

export function designSample(
  template: Presentation["template"],
  length: "short" | "long" = "short",
): ResumeDocument {
  const doc = createDocument(true);
  doc.presentation = {
    ...doc.presentation,
    template,
    accent: "navy",
    font: template === "classic" || template === "executive" ? "serif" : "sans",
    showPhoto: false,
  };
  if (length === "long") {
    const experience = doc.sections.find(
      (section) => section.type === "experience",
    );
    if (experience?.entries[0]) {
      experience.entries[0].description = Array.from(
        { length: 36 },
        (_, index) =>
          `Project note ${index + 1}: Reviewed a fictional product workflow with colleagues, recorded decisions and shared the findings with the team.`,
      ).join("\n");
    }
  }
  return doc;
}

export interface StartingDesign {
  label: string;
  presentation: Presentation;
  exampleId?: string;
}

/** A public URL selects presentation only. It never creates or imports a CV. */
export function resolveStartingDesign(
  template?: string,
  exampleId?: string,
): StartingDesign | null {
  const example = DEMO_PROFILES.find((item) => item.id === exampleId);
  if (example)
    return {
      label: `${example.name}'s design`,
      presentation: example.create().presentation,
      exampleId: example.id,
    };
  const design = publicDesigns.find((item) => item.id === template);
  return design
    ? { label: design.name, presentation: designSample(design.id).presentation }
    : null;
}
