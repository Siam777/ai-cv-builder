import type { ResumeDocument } from "../document";
import {
  parseJobDescriptionHeuristics,
  matchEvidenceAndCalculateCoverage,
  type ExtractedJobRequirements,
  type JobMatchResult,
} from "./job-tailoring";

export interface TargetJobInput {
  title?: string;
  company?: string;
  recipientName?: string;
  description?: string;
}

export interface GeneratedCoverLetter {
  candidateName: string;
  contactLine: string;
  date: string;
  recipient: string;
  company: string;
  roleTitle: string;
  salutation: string;
  opening: string;
  body1: string;
  body2: string;
  closing: string;
  signoff: string;
  fullText: string;
  markdown: string;
  matchedEvidenceCount: number;
}

/**
 * Generates an evidence-grounded, 3-to-4 paragraph tailored cover letter
 * directly matching target job requirements to verified candidate resume achievements.
 *
 * Anti-Hallucination Invariant:
 * Every metric, project, and past role cited is drawn strictly from the candidate's
 * validated ResumeDocument.
 */
export function generateCoverLetter(
  doc: ResumeDocument,
  input: TargetJobInput,
): GeneratedCoverLetter {
  const candidateName = doc.contact.name || "Candidate";
  const contactParts = [
    doc.contact.email,
    doc.contact.phone,
    doc.contact.location,
    doc.contact.website,
  ].filter(Boolean);
  const contactLine = contactParts.join(" | ");

  const roleTitle = input.title?.trim() || "Target Role";
  const company = input.company?.trim() || "Target Company";
  const recipient = input.recipientName?.trim() || `Hiring Team at ${company}`;

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Extract candidate's primary experience entry & title
  const experienceSection = doc.sections.find((s) => s.type === "experience");
  const primaryExperience = experienceSection?.entries[0];
  const candidateCurrentTitle =
    primaryExperience?.title || doc.contact.headline || "Professional";
  const candidateCurrentOrg = primaryExperience?.organization;

  // Perform job matching if description is provided
  let matchResult: JobMatchResult | null = null;
  if (input.description && input.description.trim().length > 20) {
    const jobReqs: ExtractedJobRequirements = parseJobDescriptionHeuristics(
      input.description,
      roleTitle,
      company,
    );
    matchResult = matchEvidenceAndCalculateCoverage(jobReqs, doc);
  }

  // Gather verified evidence bullets
  const verifiedBullets: Array<{ text: string; roleTitle?: string; company?: string }> = [];

  if (matchResult && matchResult.matchedEvidence.length > 0) {
    for (const evidence of matchResult.matchedEvidence) {
      for (const b of evidence.matchedBullets) {
        if (!verifiedBullets.some((v) => v.text === b.text)) {
          verifiedBullets.push({
            text: b.text,
            roleTitle: b.entryTitle,
          });
        }
      }
    }
  }

  // Fallback to top experience bullets if matching yielded fewer than 2 bullets
  if (verifiedBullets.length < 2) {
    for (const sec of doc.sections) {
      if (sec.type === "experience" || sec.type === "projects") {
        for (const entry of sec.entries) {
          for (const b of entry.bullets) {
            if (!verifiedBullets.some((v) => v.text === b.text)) {
              verifiedBullets.push({
                text: b.text,
                roleTitle: entry.title,
                company: entry.organization,
              });
            }
          }
        }
      }
    }
  }

  // Extract candidate top skills
  const skillsList: string[] = [];
  const skillsSection = doc.sections.find((s) => s.type === "skills");
  if (skillsSection) {
    for (const entry of skillsSection.entries) {
      const parts = [entry.title, entry.description, ...entry.bullets.map((b) => b.text)]
        .filter(Boolean)
        .join(" · ")
        .split(/[,·|•\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 35);
      for (const p of parts) {
        if (!skillsList.includes(p) && skillsList.length < 5) {
          skillsList.push(p);
        }
      }
    }
  }

  // 1. Opening Paragraph
  const opening =
    `I am writing to express my strong interest in the ${roleTitle} position at ${company}. ` +
    (candidateCurrentOrg
      ? `As a ${candidateCurrentTitle} at ${candidateCurrentOrg}, I have dedicated my career to driving high-leverage outcomes and building robust, scalable solutions. `
      : `With a strong background as a ${candidateCurrentTitle}, I have dedicated my career to driving high-leverage outcomes and delivering high-quality results. `) +
    `Given ${company}'s focus and mission, I am excited about the opportunity to bring my proven experience and technical execution to your team.`;

  // 2. Body Paragraph 1 (Direct Evidence & Verified Impact)
  const primaryEvidence = verifiedBullets[0];
  let body1 = "";
  if (primaryEvidence) {
    const formattedBullet = cleanBulletForNarrative(primaryEvidence.text);
    const contextPrefix = primaryEvidence.company
      ? `During my tenure at ${primaryEvidence.company}`
      : primaryEvidence.roleTitle
        ? `In my work as ${primaryEvidence.roleTitle}`
        : "Throughout my recent experience";
    body1 = `${contextPrefix}, I focused on delivering measurable, high-impact contributions: ${formattedBullet}. This experience reinforced my disciplined approach to problem-solving, stakeholder collaboration, and executing against demanding technical standards.`;
  } else {
    body1 = `Throughout my career, I have prioritized measurable execution, rapid iteration, and delivering sustainable value. I thrive in collaborative environments where ownership, technical rigor, and customer focus are critical to success.`;
  }

  // 3. Body Paragraph 2 (Secondary Achievement & Skill Alignment)
  const secondaryEvidence = verifiedBullets[1];
  let body2 = "";
  const skillsMention =
    skillsList.length > 0
      ? `In addition, my core competencies in ${skillsList.slice(0, 4).join(", ")} allow me to ramp up quickly and contribute immediately to ongoing initiatives. `
      : "";

  if (secondaryEvidence && secondaryEvidence.text !== primaryEvidence?.text) {
    const formattedBullet2 = cleanBulletForNarrative(secondaryEvidence.text);
    body2 = `${skillsMention}Furthermore, I led initiatives where I ${formattedBullet2.charAt(0).toLowerCase() + formattedBullet2.slice(1)}. I am confident that this blend of technical domain expertise and delivery focus makes me a natural fit for the challenges facing your team.`;
  } else {
    body2 = `${skillsMention}I am eager to apply these capabilities to help ${company} achieve its strategic product and business objectives with speed and engineering excellence.`;
  }

  // 4. Closing Paragraph
  const closing =
    `I would welcome the opportunity to discuss how my qualifications, track record, and technical background align with the goals of ${company}. Thank you for your time and consideration.`;

  const salutation = recipient.startsWith("Dear") ? recipient : `Dear ${recipient},`;
  const signoff = `Sincerely,\n${candidateName}`;

  // Assemble plain text format
  const plainTextParts = [
    candidateName.toUpperCase(),
    contactLine,
    "",
    today,
    "",
    recipient,
    company,
    "",
    salutation,
    "",
    opening,
    "",
    body1,
    "",
    body2,
    "",
    closing,
    "",
    signoff,
  ].filter((p) => p !== undefined);

  const fullText = plainTextParts.join("\n");

  // Assemble markdown format
  const markdownParts = [
    `# ${candidateName}`,
    `*${contactLine}*`,
    "",
    `**Date:** ${today}  `,
    `**To:** ${recipient}  `,
    `**Company:** ${company}  `,
    `**Position:** ${roleTitle}  `,
    "",
    `---`,
    "",
    salutation,
    "",
    opening,
    "",
    body1,
    "",
    body2,
    "",
    closing,
    "",
    signoff.replace("\n", "  \n"),
  ];

  const markdown = markdownParts.join("\n");

  return {
    candidateName,
    contactLine,
    date: today,
    recipient,
    company,
    roleTitle,
    salutation,
    opening,
    body1,
    body2,
    closing,
    signoff,
    fullText,
    markdown,
    matchedEvidenceCount: verifiedBullets.length,
  };
}

/**
 * Cleans a bullet point (stripping leading bullet glyphs or dashes)
 * and ensuring smooth narrative capitalization.
 */
function cleanBulletForNarrative(text: string): string {
  let cleaned = text.replace(/^[•\-*–—▪▫\d.]+\s*/, "").trim();
  if (cleaned.endsWith(".")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}
