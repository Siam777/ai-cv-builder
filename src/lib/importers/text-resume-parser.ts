import {
  createDocument,
  documentSchema,
  newEntry,
  uid,
  type Entry,
  type ResumeDocument,
  type Section,
  type SectionType,
} from "../document";

export interface ParsedResumeResult {
  document: ResumeDocument;
  warnings: string[];
}

export function parseTextToResume(
  text: string,
  fileName = "Imported Resume",
): ParsedResumeResult {
  const warnings: string[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const doc = createDocument(false);
  doc.name = fileName.replace(/\.[^/.]+$/, "").slice(0, 100) || "Imported Resume";

  if (lines.length === 0) {
    warnings.push("The uploaded file contained no readable text.");
    return { document: doc, warnings };
  }

  // 1. Extract contact details
  const { contactLines, remainingLines } = extractContactInfo(lines, doc, warnings);

  // 2. Identify sections
  const sectionChunks = partitionIntoSections(remainingLines);

  // 3. Populate sections
  const parsedSections: Section[] = [];

  for (const chunk of sectionChunks) {
    const sType = chunk.type;
    const existing = doc.sections.find((s) => s.type === sType);
    const section: Section = existing
      ? structuredClone(existing)
      : {
          id: uid(),
          type: sType,
          label: chunk.headerTitle,
          visible: true,
          entries: [],
        };

    section.visible = true;
    section.label = chunk.headerTitle;

    if (sType === "summary") {
      const summaryText = chunk.lines.join(" ");
      section.entries = [
        {
          id: uid(),
          title: "",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: summaryText,
          bullets: [],
        },
      ];
    } else if (sType === "skills") {
      section.entries = parseSkillsSection(chunk.lines);
    } else {
      section.entries = parseGenericEntries(chunk.lines, sType);
    }

    if (section.entries.length > 0) {
      parsedSections.push(section);
    }
  }

  // Preserve any standard sections from template that were not in the import, but set them empty/hidden
  for (const s of doc.sections) {
    if (!parsedSections.some((ps) => ps.type === s.type)) {
      parsedSections.push({ ...s, visible: false, entries: [] });
    }
  }

  doc.sections = parsedSections;

  // Validate invariants
  try {
    documentSchema.parse(doc);
  } catch (e) {
    warnings.push(`Schema warning: ${(e as Error).message}`);
  }

  return { document: doc, warnings };
}

function extractContactInfo(
  lines: string[],
  doc: ResumeDocument,
  warnings: string[],
): { contactLines: string[]; remainingLines: string[] } {
  let nameIndex = -1;
  const contactLines: string[] = [];
  const remainingLines: string[] = [];

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
  const linkRegex = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[a-zA-Z0-9_-]+|github\.com\/[a-zA-Z0-9_-]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

  // Assume the first 8 lines contain candidate header
  const headerCandidates = lines.slice(0, 8);
  let headerEnd = 0;

  for (let i = 0; i < headerCandidates.length; i++) {
    const line = headerCandidates[i];

    if (isSectionHeader(line)) {
      break;
    }

    headerEnd = i + 1;

    const emailMatch = line.match(emailRegex);
    let lineWithoutEmail = line;
    if (emailMatch) {
      if (!doc.contact.email) {
        doc.contact.email = emailMatch[0];
      }
      lineWithoutEmail = line.replace(emailMatch[0], "");
    }

    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch && !doc.contact.phone && phoneMatch[0].length >= 8) {
      doc.contact.phone = phoneMatch[0].trim();
    }

    const linkMatch = lineWithoutEmail.match(linkRegex);
    if (linkMatch && !doc.contact.website && !linkMatch[0].includes("@")) {
      doc.contact.website = linkMatch[0].trim();
    }



    if (
      nameIndex === -1 &&
      line.length >= 2 &&
      line.length <= 50 &&
      !emailMatch &&
      !phoneMatch &&
      !line.includes("http") &&
      !line.includes("www")
    ) {
      nameIndex = i;
      doc.contact.name = line;
    } else if (
      nameIndex !== -1 &&
      !doc.contact.headline &&
      !emailMatch &&
      !phoneMatch &&
      !line.includes("http") &&
      line.length < 60
    ) {
      doc.contact.headline = line;
    }
  }

  if (!doc.contact.name) {
    doc.contact.name = "Your Name";
    warnings.push("Candidate name could not be identified automatically.");
  }

  return {
    contactLines: lines.slice(0, headerEnd),
    remainingLines: lines.slice(headerEnd),
  };
}

interface SectionChunk {
  type: SectionType;
  headerTitle: string;
  lines: string[];
}

function partitionIntoSections(lines: string[]): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  let currentChunk: SectionChunk | null = null;

  for (const line of lines) {
    const detectedType = getSectionTypeFromHeader(line);
    if (detectedType) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = {
        type: detectedType,
        headerTitle: line.replace(/[:\-–—]+$/, "").trim(),
        lines: [],
      };
    } else if (currentChunk) {
      currentChunk.lines.push(line);
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function isSectionHeader(line: string): boolean {
  return getSectionTypeFromHeader(line) !== null;
}

function getSectionTypeFromHeader(line: string): SectionType | null {
  const clean = line.toUpperCase().replace(/[^A-Z\s]/g, "").trim();

  if (/^(WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s+EXPERIENCE|HISTORY)$/.test(clean)) {
    return "experience";
  }
  if (/^(EDUCATION|ACADEMIC\s+BACKGROUND|DEGREES)$/.test(clean)) {
    return "education";
  }
  if (/^(TECHNICAL\s+SKILLS|SKILLS|COMPETENCIES|CORE\s+SKILLS|TECHNOLOGIES)$/.test(clean)) {
    return "skills";
  }
  if (/^(PROJECTS|PERSONAL\s+PROJECTS|KEY\s+PROJECTS)$/.test(clean)) {
    return "projects";
  }
  if (/^(CERTIFICATIONS|LICENSES|CERTIFICATES)$/.test(clean)) {
    return "certifications";
  }
  if (/^(LANGUAGES|SPOKEN\s+LANGUAGES)$/.test(clean)) {
    return "languages";
  }
  if (/^(SUMMARY|PROFESSIONAL\s+SUMMARY|PROFILE|ABOUT\s+ME|OBJECTIVE)$/.test(clean)) {
    return "summary";
  }
  if (/^(VOLUNTEER|VOLUNTEERING|VOLUNTEER\s+EXPERIENCE|COMMUNITY\s+SERVICE|PUBLICATIONS|RESEARCH|PAPERS|SPEAKING|CONFERENCES|PRESENTATIONS|AWARDS|HONORS|AWARDS\s+AND\s+HONORS|PATENTS|LEADERSHIP|TEACHING|MENTORSHIP|ACTIVITIES)$/.test(clean)) {
    return "custom";
  }

  return null;
}

function parseSkillsSection(lines: string[]): Entry[] {
  const entries: Entry[] = [];

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const category = line.slice(0, colonIndex).trim();
      const skillsText = line.slice(colonIndex + 1).trim();
      const bullets = skillsText
        .split(/[,•|·]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((text) => ({ id: uid(), text }));

      entries.push({
        id: uid(),
        title: category,
        organization: "",
        location: "",
        start: "",
        end: "",
        current: false,
        description: skillsText,
        bullets,
      });
    } else {
      const skills = line
        .split(/[,•|·]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (skills.length > 0) {
        entries.push({
          id: uid(),
          title: "Technical Skills",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: line,
          bullets: skills.map((text) => ({ id: uid(), text })),
        });
      }
    }
  }

  return entries;
}

function parseGenericEntries(lines: string[], sType: SectionType): Entry[] {
  const entries: Entry[] = [];
  let currentEntry: Entry | null = null;

  const datePattern =
    /\b((?:19|20)\d{2}(?:-(?:0[1-9]|1[0-2]))?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:19|20)\d{2})\b\s*(?:–|-|to)\s*\b(Present|Current|(?:19|20)\d{2}(?:-(?:0[1-9]|1[0-2]))?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:19|20)\d{2})\b/i;

  const bulletIndicator = /^([•\-*▪–—]\s*|\d+\.\s+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dateMatch = line.match(datePattern);
    const isBullet = bulletIndicator.test(line);

    if (dateMatch) {
      if (currentEntry && currentEntry.start) {
        entries.push(currentEntry);
        currentEntry = null;
      }
      if (!currentEntry) {
        currentEntry = newEntry();
      }

      currentEntry.start = normalizeDate(dateMatch[1]);
      if (/present|current/i.test(dateMatch[2])) {
        currentEntry.current = true;
        currentEntry.end = "";
      } else {
        currentEntry.end = normalizeDate(dateMatch[2]);
      }

      const remainingText = line
        .replace(datePattern, "")
        .replace(/^[|\s–-]+|[|\s–-]+$/g, "")
        .trim();
      if (remainingText) {
        const parts = remainingText.split(/[-|·]/).map((p) => p.trim()).filter(Boolean);
        if (!currentEntry.title) {
          currentEntry.title = parts[0] || (sType === "education" ? "Degree" : "Role");
          if (parts[1] && !currentEntry.organization) currentEntry.organization = parts[1];
        } else if (!currentEntry.location) {
          currentEntry.location = remainingText;
        }
      }
    } else if ((currentEntry === null || currentEntry.start || currentEntry.bullets.length > 0) && !isBullet) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = newEntry();
      const parts = line.split(/[-|·]/).map((p) => p.trim());
      currentEntry.title = parts[0] || (sType === "education" ? "Degree" : "Role");
      if (parts[1]) currentEntry.organization = parts[1];
    } else if (currentEntry) {
      if (isBullet) {
        const bulletText = line.replace(bulletIndicator, "").trim();
        if (bulletText) {
          currentEntry.bullets.push({ id: uid(), text: bulletText });
        }
      } else if (!currentEntry.organization && line.length < 50) {
        currentEntry.organization = line;
      } else if (!currentEntry.description) {
        currentEntry.description = line;
      } else {
        currentEntry.bullets.push({ id: uid(), text: line });
      }
    }

  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

function normalizeDate(raw: string): string {
  const isoMatch = raw.match(/\b((?:19|20)\d{2})(?:-(0[1-9]|1[0-2]))?\b/);
  if (isoMatch) {
    return isoMatch[2] ? `${isoMatch[1]}-${isoMatch[2]}` : isoMatch[1];
  }

  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const textMatch = raw.match(/\b([A-Za-z]{3})[a-z]*\.?\s+((?:19|20)\d{2})\b/);
  if (textMatch) {
    const month = monthMap[textMatch[1].toLowerCase().slice(0, 3)] || "01";
    return `${textMatch[2]}-${month}`;
  }

  return "";
}
