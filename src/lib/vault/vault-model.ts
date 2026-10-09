import { z } from "zod";
import {
  type ResumeDocument,
  type Section,
  type Entry,
  type Bullet,
  uid,
} from "../document";

export const vaultBulletSchema = z.strictObject({
  id: z.string().min(1),
  text: z.string().max(2000),
  actionVerb: z.string().max(100).optional(),
  metricX: z.string().max(200).optional(), // Accomplished [X]
  metricY: z.string().max(200).optional(), // Measured by [Y]
  metricZ: z.string().max(200).optional(), // Doing [Z]
  tags: z.array(z.string().max(100)).default([]),
});

export const vaultItemSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum([
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "summary",
    "custom",
  ]),
  title: z.string().max(200),
  organization: z.string().max(200).default(""),
  location: z.string().max(200).default(""),
  startDate: z.string().max(20).default(""),
  endDate: z.string().max(20).default(""),
  current: z.boolean().default(false),
  description: z.string().max(5000).default(""),
  bullets: z.array(vaultBulletSchema).default([]),
});

export const skillInventoryItemSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  category: z.enum([
    "frontend",
    "backend",
    "cloud",
    "data",
    "ai",
    "product",
    "general",
  ]),
  proficiency: z.enum(["expert", "proficient", "familiar"]).default("proficient"),
  evidenceBulletIds: z.array(z.string()).default([]),
});

export const careerVaultSchema = z.strictObject({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  items: z.array(vaultItemSchema),
  skills: z.array(skillInventoryItemSchema),
});

export type VaultBullet = z.infer<typeof vaultBulletSchema>;
export type VaultItem = z.infer<typeof vaultItemSchema>;
export type SkillInventoryItem = z.infer<typeof skillInventoryItemSchema>;
export type CareerVault = z.infer<typeof careerVaultSchema>;

/**
 * Creates an empty Master Career Vault.
 */
export function createEmptyVault(): CareerVault {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: [],
    skills: [],
  };
}

/**
 * Ingests an existing ResumeDocument into a CareerVault,
 * deduplicating entries and indexing skills.
 */
export function documentToVault(doc: ResumeDocument): CareerVault {
  const items: VaultItem[] = [];
  const skills: SkillInventoryItem[] = [];
  const seenSkillNames = new Set<string>();

  for (const section of doc.sections) {
    if (section.type === "skills") {
      // Parse skills from title / description / bullets
      for (const entry of section.entries) {
        const textToSplit = [entry.title, entry.description, ...entry.bullets.map((b) => b.text)]
          .filter(Boolean)
          .join(" · ");
        const tokens = textToSplit
          .split(/[,·|•\n]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 1 && t.length < 50);

        for (const token of tokens) {
          const lower = token.toLowerCase();
          if (!seenSkillNames.has(lower)) {
            seenSkillNames.add(lower);
            skills.push({
              id: uid(),
              name: token,
              category: inferSkillCategory(token),
              proficiency: "proficient",
              evidenceBulletIds: [],
            });
          }
        }
      }
    }

    for (const entry of section.entries) {
      items.push({
        id: entry.id || uid(),
        type: section.type,
        title: entry.title,
        organization: entry.organization,
        location: entry.location,
        startDate: entry.start,
        endDate: entry.end,
        current: entry.current,
        description: entry.description,
        bullets: entry.bullets.map((b) => ({
          id: b.id || uid(),
          text: b.text,
          tags: extractTagsFromText(b.text),
        })),
      });
    }
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items,
    skills,
  };
}

function inferSkillCategory(skill: string): SkillInventoryItem["category"] {
  const s = skill.toLowerCase();
  if (/react|vue|angular|svelte|next|tailwind|css|html|ui|ux|frontend/.test(s)) return "frontend";
  if (/node|python|go|golang|rust|java|c\+\+|sql|postgres|mysql|redis|backend|graphql|rest|api/.test(s)) return "backend";
  if (/aws|azure|gcp|cloud|kubernetes|k8s|docker|terraform|ci\/cd|devops/.test(s)) return "cloud";
  if (/data|kafka|spark|pandas|hadoop|warehouse|snowflake|dbt/.test(s)) return "data";
  if (/ai|llm|ml|machine learning|openai|deep learning|nlp|pytorch|tensorflow/.test(s)) return "ai";
  if (/product|agile|scrum|strategy|roadmap|analytics|design/.test(s)) return "product";
  return "general";
}

function extractTagsFromText(text: string): string[] {
  const knownTech = [
    "react", "typescript", "javascript", "python", "node", "next.js", "docker",
    "kubernetes", "aws", "gcp", "azure", "postgresql", "mysql", "redis", "graphql",
    "rest", "ci/cd", "terraform", "kafka", "go", "golang", "rust", "figma"
  ];
  const lower = text.toLowerCase();
  return knownTech.filter((tech) => lower.includes(tech));
}
