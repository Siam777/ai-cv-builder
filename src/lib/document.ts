import { z } from "zod";
import { presentationSchema } from "./presentation";

const text = z.string().max(20000);
const id = z.string().min(1).max(100);
export const standardSectionTypes = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
] as const;
export const sectionTypes = [
  ...standardSectionTypes,
  "custom",
] as const;
export type SectionType = (typeof sectionTypes)[number];
export const labels: Record<SectionType, string> = {
  summary: "Profile",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  custom: "Custom Section",
};
const date = z.string().regex(/^(|\d{4}|\d{4}-(0[1-9]|1[0-2]))$/);
const entrySchema = z.strictObject({
  id,
  title: text,
  organization: text,
  location: text,
  start: date,
  end: date,
  current: z.boolean(),
  description: text,
  bullets: z.array(z.strictObject({ id, text })).max(100),
});
export const documentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id,
    name: z.string().min(1).max(200),
    revision: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
    contact: z.strictObject({
      name: text,
      headline: text,
      email: text,
      phone: text,
      location: text,
      website: text,
      photoUrl: z.string().max(2500000).optional(),
    }),
    sections: z
      .array(
        z.strictObject({
          id,
          type: z.enum(sectionTypes),
          label: text,
          visible: z.boolean(),
          entries: z.array(entrySchema).max(100),
        }),
      )
      .max(30),
    presentation: presentationSchema,
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const value of doc.sections.flatMap((s) => [
      s.id,
      ...s.entries.flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]),
    ])) {
      if (ids.has(value))
        ctx.addIssue({ code: "custom", message: "Duplicate item identifier" });
      ids.add(value);
    }
  });
export type ResumeDocument = z.infer<typeof documentSchema>;
export type Section = ResumeDocument["sections"][number];
export type Entry = z.infer<typeof entrySchema>;
export type Bullet = Entry["bullets"][number];
export function uid() {

  return crypto.randomUUID();
}
export function newEntry(): Entry {
  return {
    id: uid(),
    title: "",
    organization: "",
    location: "",
    start: "",
    end: "",
    current: false,
    description: "",
    bullets: [],
  };
}
export function createCustomSection(
  label = "Custom Section",
  entries: Entry[] = [],
): Section {
  return {
    id: uid(),
    type: "custom",
    label: label.trim() || "Custom Section",
    visible: true,
    entries,
  };
}
export function createDocument(sample = false): ResumeDocument {
  const doc: ResumeDocument = {
    schemaVersion: 1,
    id: uid(),
    name: sample ? "Alex Morgan · Product designer" : "Untitled resume",
    revision: 0,
    updatedAt: new Date().toISOString(),
    contact: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
    },
    sections: standardSectionTypes.map((type) => ({
      id: uid(),
      type,
      label: labels[type],
      visible: true,
      entries: [],
    })),
    presentation: presentationSchema.parse({
      template: "classic",
      pageSize: "A4",
    }),
  };
  if (sample) {
    doc.contact = {
      name: "Alex Morgan",
      headline: "Product designer",
      email: "alex@example.com",
      phone: "+1 (555) 010-2040",
      location: "Brooklyn, New York",
      website: "example.com/alex",
    };
    const add = (type: SectionType, fields: Partial<Entry>) =>
      doc.sections
        .find((s) => s.type === type)!
        .entries.push({ ...newEntry(), ...fields });
    add("summary", {
      description:
        "Product designer who brings clarity to complex workflows. Experienced in research, interaction design, and building thoughtful digital experiences in close partnership with engineering teams.",
    });
    add("experience", {
      title: "Senior Product Designer",
      organization: "Northstar Studio",
      location: "New York, NY",
      start: "2022-03",
      current: true,
      bullets: [
        {
          id: uid(),
          text: "Led the design of a collaborative workspace, from early discovery through launch.",
        },
        {
          id: uid(),
          text: "Built a shared component library with engineering to create a consistent product experience.",
        },
        {
          id: uid(),
          text: "Facilitated customer interviews and translated findings into clear design priorities.",
        },
      ],
    });
    add("experience", {
      title: "Product Designer",
      organization: "Fieldwork",
      location: "Boston, MA",
      start: "2019-06",
      end: "2022-02",
      bullets: [
        {
          id: uid(),
          text: "Designed onboarding and account management flows for a small business platform.",
        },
        {
          id: uid(),
          text: "Partnered with product managers to test prototypes and refine interaction patterns.",
        },
      ],
    });
    add("education", {
      title: "BFA, Communication Design",
      organization: "Example School of Design",
      start: "2015",
      end: "2019",
    });
    add("skills", {
      title: "Design & research",
      description:
        "Product strategy · User research · Interaction design · Prototyping · Design systems · Figma",
    });
    add("projects", {
      title: "Open Design Notes",
      description:
        "A personal collection of accessible interface patterns and practical design resources.",
    });
  }
  return doc;
}
export function duplicateDocument(
  doc: ResumeDocument,
  name = `${doc.name} — copy`,
): ResumeDocument {
  return {
    ...structuredClone(doc),
    id: uid(),
    name: name.slice(0, 200),
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}
export function parseBackup(raw: string): ResumeDocument {
  if (new TextEncoder().encode(raw).length > 2_000_000)
    throw new Error("Backup exceeds the 2 MB limit.");
  const result = documentSchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "This is not a supported version 1 resume backup. No saved resume was changed.",
    );
  return result.data;
}
export function formatDate(value: string) {
  if (!value || value.length === 4) return value;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const [year, month] = value.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${year}`;
}
export function dateRange(entry: Entry) {
  return [
    formatDate(entry.start),
    entry.current ? "Present" : formatDate(entry.end),
  ]
    .filter(Boolean)
    .join(" – ");
}
export function toPlainText(doc: ResumeDocument) {
  return [
    doc.contact.name,
    doc.contact.headline,
    [
      doc.contact.email,
      doc.contact.phone,
      doc.contact.location,
      doc.contact.website,
    ]
      .filter(Boolean)
      .join(" | "),
    ...doc.sections
      .filter((s) => s.visible && s.entries.length)
      .flatMap((s) => [
        "",
        s.label.toUpperCase(),
        ...s.entries.flatMap((e) =>
          [
            [e.title, e.organization].filter(Boolean).join(" | "),
            [e.location, dateRange(e)].filter(Boolean).join(" | "),
            e.description,
            ...e.bullets.map((b) => `• ${b.text}`),
          ].filter(Boolean),
        ),
      ]),
  ].join("\n");
}
