import {
  type ResumeDocument,
  type Entry,
  type Bullet,
  uid,
  duplicateDocument,
} from "../document";
import { type CareerVault, type VaultItem, type VaultBullet } from "./vault-model";

export interface JobRequirement {
  id: string;
  description: string;
  normalizedSkill?: string;
  weight: number; // 1.0 for hard requirements, 0.5 for preferred
}

export interface ExtractedJobRequirements {
  jobTitle: string;
  company: string;
  hardRequirements: JobRequirement[];
  preferredQualifications: JobRequirement[];
  keyResponsibilities: string[];
}

export interface MatchedEvidence {
  requirementId: string;
  description: string;
  weight: number;
  matchedBullets: Array<{
    bulletId: string;
    text: string;
    entryTitle: string;
  }>;
  matchedSkills: string[];
}

export interface SkillGap {
  requirementId: string;
  description: string;
  weight: number;
  normalizedSkill?: string;
}

export interface JobMatchResult {
  jobTitle: string;
  company: string;
  coverageScore: number; // 0 to 100
  totalRequirementsCount: number;
  matchedCount: number;
  matchedEvidence: MatchedEvidence[];
  skillGaps: SkillGap[];
}

/**
 * Standard technical synonym dictionary for skill normalization.
 */
export const TECH_SYNONYMS: Record<string, string> = {
  k8s: "kubernetes",
  postgres: "postgresql",
  postgresql: "postgresql",
  "react.js": "react",
  reactjs: "react",
  react: "react",
  "node.js": "node",
  nodejs: "node",
  node: "node",
  ts: "typescript",
  typescript: "typescript",
  js: "javascript",
  javascript: "javascript",
  golang: "go",
  go: "go",
  "amazon web services": "aws",
  aws: "aws",
  "google cloud": "gcp",
  "google cloud platform": "gcp",
  gcp: "gcp",
  "microsoft azure": "azure",
  azure: "azure",
  cicd: "ci/cd",
  "ci/cd": "ci/cd",
  "continuous integration": "ci/cd",
  docker: "docker",
  containers: "docker",
  rest: "rest",
  "rest api": "rest",
  "restful api": "rest",
  "restful apis": "rest",
  graphql: "graphql",
  nextjs: "next.js",
  "next.js": "next.js",
  vue: "vue",
  vuejs: "vue",
  python: "python",
  sql: "sql",
  nosql: "nosql",
  mongodb: "mongodb",
  mongo: "mongodb",
  redis: "redis",
  terraform: "terraform",
  kafka: "kafka",
  spark: "spark",
  tailwind: "tailwind",
  "tailwind css": "tailwind",
  figma: "figma",
  agile: "agile",
  scrum: "scrum",
};

/**
 * Normalizes a raw skill string using the synonym dictionary.
 */
export function normalizeSkill(skill: string): string {
  const clean = skill.trim().toLowerCase();
  return TECH_SYNONYMS[clean] || clean;
}

/**
 * Heuristically parses a pasted job description text into structured requirements.
 */
export function parseJobDescriptionHeuristics(
  text: string,
  userJobTitle = "",
  userCompany = "",
): ExtractedJobRequirements {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let jobTitle = userJobTitle;
  let company = userCompany;

  // Try to detect job title / company if not provided
  if (!jobTitle && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 80 && !firstLine.includes(".")) {
      const atMatch = firstLine.match(/^(.+?)\s+(?:at|@|–|-|\|)\s+(.+)$/i);
      if (atMatch) {
        jobTitle = atMatch[1].trim();
        company = atMatch[2].trim();
      } else {
        jobTitle = firstLine;
      }
    }
  }

  const hardRequirements: JobRequirement[] = [];
  const preferredQualifications: JobRequirement[] = [];
  const keyResponsibilities: string[] = [];

  let currentSection: "hard" | "preferred" | "responsibilities" | "general" = "general";

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers
    if (
      /^(requirements|qualifications|must have|what you.ll need|what we.re looking for|who you are|minimum qualifications)/i.test(
        lower,
      )
    ) {
      currentSection = "hard";
      continue;
    }
    if (
      /^(preferred|nice to have|bonus points|bonus qualifications|desired|plus if you have)/i.test(
        lower,
      )
    ) {
      currentSection = "preferred";
      continue;
    }
    if (
      /^(responsibilities|what you.ll do|about the role|the role|your impact|day-to-day)/i.test(
        lower,
      )
    ) {
      currentSection = "responsibilities";
      continue;
    }

    // Skip short headings or headers
    if (line.endsWith(":") && line.length < 40) continue;

    // Is it a bullet or statement?
    const isBullet = /^([•\-*–—▪▫]|\d+\.)\s*(.+)$/.test(line);
    const content = line.replace(/^([•\-*–—▪▫]|\d+\.)\s*/, "").trim();

    if (content.length < 6) continue;

    const detectedSkill = extractKeySkillFromLine(content);

    if (currentSection === "preferred" || isPreferredLine(lower)) {
      preferredQualifications.push({
        id: uid(),
        description: content,
        normalizedSkill: detectedSkill ? normalizeSkill(detectedSkill) : undefined,
        weight: 0.5,
      });
    } else if (currentSection === "responsibilities" || isResponsibilityLine(lower)) {
      keyResponsibilities.push(content);
    } else if (currentSection === "hard" || isHardRequirementLine(lower) || isBullet) {
      hardRequirements.push({
        id: uid(),
        description: content,
        normalizedSkill: detectedSkill ? normalizeSkill(detectedSkill) : undefined,
        weight: 1.0,
      });
    }
  }

  // Fallback: If no structured requirements found, treat non-empty bullet-like lines as hard requirements
  if (hardRequirements.length === 0 && preferredQualifications.length === 0) {
    for (const line of lines.slice(1, 15)) {
      if (line.length > 15) {
        const detectedSkill = extractKeySkillFromLine(line);
        hardRequirements.push({
          id: uid(),
          description: line,
          normalizedSkill: detectedSkill ? normalizeSkill(detectedSkill) : undefined,
          weight: 1.0,
        });
      }
    }
  }

  return {
    jobTitle: jobTitle || "Target Role",
    company: company || "Target Company",
    hardRequirements,
    preferredQualifications,
    keyResponsibilities,
  };
}

function isPreferredLine(line: string): boolean {
  return /preferred|nice to have|plus if|bonus|advantageous|ideally/i.test(line);
}

function isHardRequirementLine(line: string): boolean {
  return /must have|required|\d+\+?\s*years|experience with|proficient in|strong knowledge|bachelor|master|degree/i.test(
    line,
  );
}

function isResponsibilityLine(line: string): boolean {
  return /you will|responsible for|lead|design and build|collaborate|architect|deliver|manage/i.test(
    line,
  );
}

function extractKeySkillFromLine(line: string): string | undefined {
  const lower = ` ${line.toLowerCase().replace(/[^a-z0-9#+.-]/g, " ")} `;
  for (const [key, canonical] of Object.entries(TECH_SYNONYMS)) {
    if (lower.includes(` ${key} `)) {
      return canonical;
    }
  }
  return undefined;
}

/**
 * Compares extracted job requirements against candidate's master vault or resume document.
 * Computes transparent coverage score and separates matched evidence from skill gaps.
 */
export function matchEvidenceAndCalculateCoverage(
  job: ExtractedJobRequirements,
  candidate: CareerVault | ResumeDocument,
): JobMatchResult {
  const allReqs = [...job.hardRequirements, ...job.preferredQualifications];

  // Extract all candidate bullets and candidate skills
  const candidateBullets: Array<{ id: string; text: string; entryTitle: string }> = [];
  const candidateSkills = new Set<string>();

  if ("sections" in candidate) {
    // It's a ResumeDocument
    for (const section of candidate.sections) {
      if (section.type === "skills") {
        for (const entry of section.entries) {
          const parts = [entry.title, entry.description, ...entry.bullets.map((b) => b.text)]
            .filter(Boolean)
            .join(" · ")
            .split(/[,·|•\n]/)
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 1);
          parts.forEach((p) => candidateSkills.add(normalizeSkill(p)));
        }
      }
      for (const entry of section.entries) {
        for (const bullet of entry.bullets) {
          candidateBullets.push({
            id: bullet.id,
            text: bullet.text,
            entryTitle: entry.title || section.label,
          });
        }
      }
    }
  } else {
    // It's a CareerVault
    for (const item of candidate.items) {
      for (const bullet of item.bullets) {
        candidateBullets.push({
          id: bullet.id,
          text: bullet.text,
          entryTitle: item.title,
        });
      }
    }
    for (const skill of candidate.skills) {
      candidateSkills.add(normalizeSkill(skill.name));
    }
  }

  const matchedEvidence: MatchedEvidence[] = [];
  const skillGaps: SkillGap[] = [];

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const req of allReqs) {
    totalWeight += req.weight;

    const matchingBullets: MatchedEvidence["matchedBullets"] = [];
    const matchingSkills: string[] = [];

    const reqLower = req.description.toLowerCase();
    const reqTokens = reqLower
      .replace(/[^a-z0-9]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

    // 1. Check for normalized skill match
    if (req.normalizedSkill && candidateSkills.has(req.normalizedSkill)) {
      matchingSkills.push(req.normalizedSkill);
    }

    // 2. Check token and keyword overlap in candidate skills
    for (const skill of candidateSkills) {
      if (reqLower.includes(skill) || reqTokens.includes(skill)) {
        if (!matchingSkills.includes(skill)) matchingSkills.push(skill);
      }
    }

    // 3. Check matching bullets
    for (const bullet of candidateBullets) {
      const bulletLower = bullet.text.toLowerCase();
      let matchScore = 0;

      if (req.normalizedSkill && bulletLower.includes(req.normalizedSkill)) {
        matchScore += 3;
      }

      for (const token of reqTokens) {
        if (bulletLower.includes(token)) {
          matchScore += 1;
        }
      }

      // Strong threshold for match
      if (matchScore >= 2 || (req.normalizedSkill && matchScore >= 1)) {
        matchingBullets.push({
          bulletId: bullet.id,
          text: bullet.text,
          entryTitle: bullet.entryTitle,
        });
      }
    }

    if (matchingBullets.length > 0 || matchingSkills.length > 0) {
      matchedWeight += req.weight;
      matchedEvidence.push({
        requirementId: req.id,
        description: req.description,
        weight: req.weight,
        matchedBullets: matchingBullets,
        matchedSkills: matchingSkills,
      });
    } else {
      skillGaps.push({
        requirementId: req.id,
        description: req.description,
        weight: req.weight,
        normalizedSkill: req.normalizedSkill,
      });
    }
  }

  const coverageScore =
    totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 100;

  return {
    jobTitle: job.jobTitle,
    company: job.company,
    coverageScore,
    totalRequirementsCount: allReqs.length,
    matchedCount: matchedEvidence.length,
    matchedEvidence,
    skillGaps,
  };
}

/**
 * 1-Click Targeted Variant Generator:
 * Creates an independent named ResumeDocument with re-ranked bullets and prioritized skills.
 * Guarantees zero invented statements (Anti-Hallucination Invariant).
 */
export function generateTailoredVariant(
  baseDoc: ResumeDocument,
  matchResult: JobMatchResult,
  options?: { jobTitle?: string; company?: string },
): ResumeDocument {
  const roleName = options?.jobTitle || matchResult.jobTitle || "Role";
  const compName = options?.company || matchResult.company || "Target";
  const variantName = `${baseDoc.contact.name || "Resume"} — ${roleName} at ${compName} (Tailored)`;

  const copy = duplicateDocument(baseDoc, variantName);

  // Set of matched bullet IDs
  const matchedBulletIds = new Set<string>();
  for (const m of matchResult.matchedEvidence) {
    for (const b of m.matchedBullets) {
      matchedBulletIds.add(b.bulletId);
    }
  }

  // Set of matched skill names
  const matchedSkills = new Set<string>();
  for (const m of matchResult.matchedEvidence) {
    for (const s of m.matchedSkills) {
      matchedSkills.add(s);
    }
  }

  // Re-rank bullets in experience, project, and custom sections
  for (const section of copy.sections) {
    if (section.type === "experience" || section.type === "projects" || section.type === "custom") {
      for (const entry of section.entries) {
        // Partition bullets: matched ones first, followed by others
        const matched = entry.bullets.filter((b) => matchedBulletIds.has(b.id));
        const unmatched = entry.bullets.filter((b) => !matchedBulletIds.has(b.id));
        entry.bullets = [...matched, ...unmatched];
      }
    } else if (section.type === "skills") {
      // Prioritize matched skills at the front of description or entries
      for (const entry of section.entries) {
        if (entry.description) {
          const items = entry.description.split(/[,·|•\n]/).map((s) => s.trim()).filter(Boolean);
          const matchedList = items.filter((s) => matchedSkills.has(normalizeSkill(s)));
          const unmatchedList = items.filter((s) => !matchedSkills.has(normalizeSkill(s)));
          entry.description = [...matchedList, ...unmatchedList].join(" · ");
        }
      }
    }
  }

  return copy;
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "that", "this", "from", "have", "you", "will",
  "are", "our", "all", "any", "can", "has", "your", "who", "what", "which",
  "when", "where", "into", "more", "such", "well", "work", "team", "role"
]);
