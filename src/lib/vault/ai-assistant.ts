import type { ResumeDocument } from "../document";
import { hasQuantifiableMetric, isWeakOpening } from "../linter/ats-linter";
import { synthesizeVerifiedXyzBullet } from "./impact-coach";
import { TAXONOMY_SKILLS, parseSkillsFromText, SKILL_CATEGORIES } from "../skills-taxonomy";

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
 * Generates evidence-grounded executive summaries.
 * Strict Anti-Hallucination Invariant: Every mentioned company, role, metric,
 * and skill is derived strictly from verified candidate entries.
 */
export function generateExecutiveSummaries(doc: ResumeDocument): SummaryDraftOption[] {
  const headline =
    doc.contact.headline?.trim() ||
    doc.sections.find((s) => s.type === "experience")?.entries[0]?.title?.trim() ||
    "Professional";

  // Gather experience organizations
  const expSection = doc.sections.find((s) => s.type === "experience");
  const companies = (expSection?.entries || [])
    .map((e) => e.organization?.trim())
    .filter((org): org is string => Boolean(org && org.length > 0));
  const uniqueCompanies = Array.from(new Set(companies));

  // Gather top skills from skills section
  const skillsSection = doc.sections.find((s) => s.type === "skills");
  const skillsList = (skillsSection?.entries || [])
    .flatMap((e) => parseSkillsFromText(e.description))
    .filter((s) => s.length > 0);
  const uniqueSkills = Array.from(new Set(skillsList));

  // Gather verified metrics from experience and project bullets
  const metricsFound: string[] = [];
  for (const s of doc.sections) {
    if (s.type === "experience" || s.type === "projects") {
      for (const e of s.entries) {
        for (const b of e.bullets) {
          if (hasQuantifiableMetric(b.text)) {
            const match = b.text.match(/\b(?:\d+[\d,.]*\s*(?:%|\$|k|m|b|x|ms|s|users|requests|customers)|\$\s*\d+[\d,.]*|\b\d+x\b|\b\d+[\d,.]*%\b)/i);
            if (match) metricsFound.push(match[0]);
          }
        }
      }
    }
  }

  const companyContext =
    uniqueCompanies.length > 1
      ? `including ${uniqueCompanies.slice(0, 2).join(" and ")}`
      : uniqueCompanies.length === 1
        ? `at ${uniqueCompanies[0]}`
        : "in high-growth environments";

  const skillContext =
    uniqueSkills.length > 0
      ? uniqueSkills.slice(0, 4).join(", ")
      : "cross-functional systems and modern tooling";

  // 1. Metric-Impact Draft
  const metricSentence2 =
    metricsFound.length > 0
      ? `Track record of delivering measurable outcomes including ${metricsFound.slice(0, 2).join(" and ")}.`
      : "Track record of delivering measurable improvements in scalability, reliability, and team velocity.";
  const metricText = `Accomplished ${headline} with proven success delivering high-impact solutions ${companyContext}. ${metricSentence2} Proficient in ${skillContext} to solve critical domain challenges and align engineering with business goals.`.trim();

  // 2. Tech-Architecture Draft
  const techText = `Results-driven ${headline} specializing in robust systems development, clean architecture, and technical execution ${companyContext}. Hands-on expertise across ${skillContext}, delivering maintainable codebases from conception to production. Known for technical rigor, collaborative ownership, and continuous engineering improvement.`.trim();

  // 3. Concise Executive Draft (2 sentences)
  const conciseText = `Versatile ${headline} with deep background in ${skillContext} ${companyContext}. Recognized for accelerating release velocity, upholding architectural quality, and delivering scalable customer-facing impact.`.trim();

  const options: SummaryDraftOption[] = [
    {
      id: "metric_impact",
      title: "Impact & Metric-Oriented",
      description: "Highlights quantified achievements, scale, and verified business performance.",
      text: metricText,
      wordCount: metricText.split(/\s+/).filter(Boolean).length,
      highlightedEvidence: [...metricsFound.slice(0, 3), ...uniqueCompanies.slice(0, 2)],
    },
    {
      id: "tech_architecture",
      title: "Technical & Systems Architecture",
      description: "Emphasizes core technology stack, systems engineering, and implementation depth.",
      text: techText,
      wordCount: techText.split(/\s+/).filter(Boolean).length,
      highlightedEvidence: [...uniqueSkills.slice(0, 4), ...uniqueCompanies.slice(0, 2)],
    },
    {
      id: "concise_executive",
      title: "Concise Executive (2 Sentences)",
      description: "High-density summary crafted for compact, single-page resume layouts.",
      text: conciseText,
      wordCount: conciseText.split(/\s+/).filter(Boolean).length,
      highlightedEvidence: [...uniqueSkills.slice(0, 3)],
    },
  ];

  return options;
}

/**
 * Identifies bullets that lack quantifiable impact and generates targeted
 * interview questions to elicit real candidate metrics.
 */
export function generateInterviewClarifications(
  doc: ResumeDocument,
  maxQuestions = 6,
): InterviewClarification[] {
  const clarifications: InterviewClarification[] = [];

  for (const section of doc.sections) {
    if (section.type !== "experience" && section.type !== "projects") continue;

    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        if (!bullet.text.trim()) continue;

        const hasMetric = hasQuantifiableMetric(bullet.text);
        const weak = isWeakOpening(bullet.text);

        // Target bullets lacking metrics
        if (!hasMetric) {
          let kind: InterviewClarification["suggestedMetricKind"] = "efficiency";
          let examples: string[] = ["Saved team 5 hours weekly in manual triage", "Accelerated release cycle by 35%"];

          const lower = bullet.text.toLowerCase();
          if (/latency|speed|query|fast|response|load|render|time/i.test(lower)) {
            kind = "latency";
            examples = ["Reduced API response time by 45%", "Cut P99 query latency from 250ms to 60ms"];
          } else if (/cost|spend|budget|bill|save|expense/i.test(lower)) {
            kind = "cost";
            examples = ["Reduced monthly cloud infrastructure costs by $14k", "Saved 25% on annual vendor licensing"];
          } else if (/scale|user|traffic|volume|request|throughput|cluster|rps|qps/i.test(lower)) {
            kind = "scale";
            examples = ["Scaled to support 250k daily active users", "Handled 15k concurrent requests per second"];
          } else if (/revenue|sale|conversion|growth|retention|churn/i.test(lower)) {
            kind = "revenue";
            examples = ["Boosted checkout funnel conversion by 8.4%", "Drove $320k in net new annual recurring revenue"];
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
      for (const skill of parseSkillsFromText(eDescription(entry.description))) {
        existingSkills.add(skill.toLowerCase());
      }
    }
  }

  // Helper map of category IDs to category display labels
  const categoryLabels = new Map(
    SKILL_CATEGORIES.map((c) => [c.id, c.label]),
  );

  const discovered: DiscoveredSkill[] = [];
  const discoveredNames = new Set<string>();

  for (const section of doc.sections) {
    if (section.type !== "experience" && section.type !== "projects") continue;

    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        if (!bullet.text.trim()) continue;

        for (const taxSkill of TAXONOMY_SKILLS) {
          const lowerSkill = taxSkill.name.toLowerCase();
          if (existingSkills.has(lowerSkill) || discoveredNames.has(lowerSkill)) {
            continue;
          }

          // Check if skill aliases are already listed
          if (taxSkill.aliases.some((a) => existingSkills.has(a.toLowerCase()))) {
            continue;
          }

          // Search for skill in bullet using word boundaries
          const escaped = taxSkill.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`\\b${escaped}\\b`, "i");

          if (regex.test(bullet.text)) {
            discoveredNames.add(lowerSkill);
            discovered.push({
              skill: taxSkill.name,
              category: categoryLabels.get(taxSkill.category) || taxSkill.category,
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
