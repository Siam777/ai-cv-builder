import type { ResumeDocument } from "../document";
import { hasQuantifiableMetric, isWeakOpening } from "../linter/ats-linter";
import { synthesizeVerifiedXyzBullet } from "./impact-coach";
import {
  TAXONOMY_SKILLS,
  parseSkillsFromText,
  SKILL_CATEGORIES,
} from "../skills-taxonomy";

export interface SummaryDraftOption {
  id: "metric_impact" | "tech_architecture" | "concise_executive";
  title: string;
  description: string;
  text: string;
  wordCount: number;
  highlightedEvidence: string[];
}

export interface InterviewClarification {
  id: string;
  sectionId: string;
  entryId: string;
  bulletId: string;
  entryTitle: string;
  organization: string;
  originalBullet: string;
  questionPrompt: string;
  suggestedMetricKind: "latency" | "scale" | "cost" | "revenue" | "efficiency";
  exampleAnswers: string[];
}

export interface DiscoveredSkill {
  skill: string;
  category: string;
  evidenceBullet: string;
  entryTitle: string;
}

/**
 * Arranges visible candidate details into local summary drafts.
 * Preserve complete outcome bullets; do not infer proficiency or detach metrics.
 */
export function generateExecutiveSummaries(
  doc: ResumeDocument,
): SummaryDraftOption[] {
  const headline = doc.contact.headline.trim();
  const entries = doc.sections
    .filter((s) => s.visible && ["experience", "projects"].includes(s.type))
    .flatMap((s) => s.entries);
  const facts = entries
    .flatMap((e) => e.bullets.map((b) => b.text.trim()).filter(Boolean))
    .filter((text) => text.length <= 2000);
  const roles = entries
    .map((e) =>
      [e.title.trim(), e.organization.trim()].filter(Boolean).join(" at "),
    )
    .filter(Boolean);
  const skills = doc.sections
    .filter((s) => s.visible && s.type === "skills")
    .flatMap((s) =>
      s.entries.flatMap((e) => parseSkillsFromText(e.description)),
    );
  if (!headline && !facts.length && !roles.length && !skills.length) return [];
  const introduction = [
    headline ? headline + "." : "",
    roles[0] ? "Experience: " + roles[0] + "." : "",
  ]
    .filter(Boolean)
    .join(" ");
  const texts = [
    [introduction, ...facts.filter(hasQuantifiableMetric).slice(0, 2)]
      .filter(Boolean)
      .join(" ") ||
      introduction ||
      facts[0] ||
      "Skills: " + skills.join(", "),
    [
      introduction,
      skills.length
        ? "Skills: " + [...new Set(skills)].slice(0, 6).join(", ") + "."
        : facts[0] || "",
    ]
      .filter(Boolean)
      .join(" ") || "Skills: " + skills.join(", "),
    [introduction, facts[0] || ""].filter(Boolean).join(" ") ||
      "Skills: " + skills.join(", "),
  ];
  const metadata = [
    [
      "metric_impact",
      "Results from your CV",
      "Keeps complete outcome bullets, including their context.",
    ],
    [
      "tech_architecture",
      "Role and skills",
      "Arranges your stated role and listed skills.",
    ],
    [
      "concise_executive",
      "Short introduction",
      "Pairs your stated role with one original bullet.",
    ],
  ] as const;
  return metadata.map(([id, title, description], i) => ({
    id,
    title,
    description,
    text: texts[i],
    wordCount: texts[i].split(/\s+/).filter(Boolean).length,
    highlightedEvidence: ["Original CV details; review before using"],
  }));
}

/**
 * Identifies bullets that lack quantifiable impact and generates targeted
 * interview questions to elicit real candidate metrics.
 */
export function generateInterviewClarifications(
  doc: ResumeDocument,
  maxQuestions = 6,
  selectedBulletId?: string,
): InterviewClarification[] {
  const clarifications: InterviewClarification[] = [];

  for (const section of doc.sections) {
    if (section.type !== "experience" && section.type !== "projects") continue;

    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        if (selectedBulletId && bullet.id !== selectedBulletId) continue;
        if (!bullet.text.trim()) continue;

        const hasMetric = hasQuantifiableMetric(bullet.text);
        const weak = isWeakOpening(bullet.text);

        // Target bullets lacking metrics
        if (!hasMetric) {
          let kind: InterviewClarification["suggestedMetricKind"] =
            "efficiency";
          let examples: string[] = [
            "Saved team 5 hours weekly in manual triage",
            "Accelerated release cycle by 35%",
          ];

          const lower = bullet.text.toLowerCase();
          if (
            /latency|speed|query|fast|response|load|render|time/i.test(lower)
          ) {
            kind = "latency";
            examples = [
              "Reduced API response time by 45%",
              "Cut P99 query latency from 250ms to 60ms",
            ];
          } else if (/cost|spend|budget|bill|save|expense/i.test(lower)) {
            kind = "cost";
            examples = [
              "Reduced monthly cloud infrastructure costs by $14k",
              "Saved 25% on annual vendor licensing",
            ];
          } else if (
            /scale|user|traffic|volume|request|throughput|cluster|rps|qps/i.test(
              lower,
            )
          ) {
            kind = "scale";
            examples = [
              "Scaled to support 250k daily active users",
              "Handled 15k concurrent requests per second",
            ];
          } else if (
            /revenue|sale|conversion|growth|retention|churn/i.test(lower)
          ) {
            kind = "revenue";
            examples = [
              "Boosted checkout funnel conversion by 8.4%",
              "Drove $320k in net new annual recurring revenue",
            ];
          }

          const orgPart = entry.organization ? ` at ${entry.organization}` : "";
          const titlePart = entry.title ? `as ${entry.title}` : "in this role";
          const prompt = `In your work ${titlePart}${orgPart}, you noted: "${bullet.text.trim()}". What was the approximate measurable outcome, scale, or time saved?`;

          clarifications.push({
            id: `q-${bullet.id}`,
            sectionId: section.id,
            entryId: entry.id,
            bulletId: bullet.id,
            entryTitle: entry.title || "Role/Project",
            organization: entry.organization || "",
            originalBullet: bullet.text,
            questionPrompt: prompt,
            suggestedMetricKind: kind,
            exampleAnswers: examples,
          });

          if (clarifications.length >= maxQuestions) return clarifications;
        }
      }
    }
  }

  return clarifications;
}

/**
 * Synthesizes a Google XYZ bullet from candidate's answer to an interview question.
 */
export function applyInterviewAnswer(
  originalText: string,
  metricAnswer: string,
): string {
  return synthesizeVerifiedXyzBullet(originalText, metricAnswer);
}

/**
 * Scans candidate experience and project bullets for demonstrated skills
 * present in our standard taxonomy that are not yet listed in the Skills section.
 */
export function discoverDemonstratedSkills(
  doc: ResumeDocument,
  maxSkills = 10,
): DiscoveredSkill[] {
  // 1. Gather all existing skills in skills section
  const existingSkills = new Set<string>();
  const skillsSection = doc.sections.find((s) => s.type === "skills");
  if (skillsSection) {
    for (const entry of skillsSection.entries) {
      for (const skill of parseSkillsFromText(
        eDescription(entry.description),
      )) {
        existingSkills.add(skill.toLowerCase());
      }
    }
  }

  // Helper map of category IDs to category display labels
  const categoryLabels = new Map(SKILL_CATEGORIES.map((c) => [c.id, c.label]));

  const discovered: DiscoveredSkill[] = [];
  const discoveredNames = new Set<string>();

  for (const section of doc.sections) {
    if (section.type !== "experience" && section.type !== "projects") continue;

    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        if (!bullet.text.trim()) continue;

        for (const taxSkill of TAXONOMY_SKILLS) {
          const lowerSkill = taxSkill.name.toLowerCase();
          if (
            existingSkills.has(lowerSkill) ||
            discoveredNames.has(lowerSkill)
          ) {
            continue;
          }

          // Check if skill aliases are already listed
          if (
            taxSkill.aliases.some((a) => existingSkills.has(a.toLowerCase()))
          ) {
            continue;
          }

          // Search for skill in bullet using word boundaries
          const escaped = taxSkill.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`\\b${escaped}\\b`, "i");

          if (regex.test(bullet.text)) {
            discoveredNames.add(lowerSkill);
            discovered.push({
              skill: taxSkill.name,
              category:
                categoryLabels.get(taxSkill.category) || taxSkill.category,
              evidenceBullet: bullet.text.trim(),
              entryTitle: entry.title || entry.organization || "Experience",
            });

            if (discovered.length >= maxSkills) {
              return discovered;
            }
          }
        }
      }
    }
  }

  return discovered;
}

function eDescription(d: string | undefined): string {
  return d || "";
}
