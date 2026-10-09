import {
  type ResumeDocument,
  type Section,
  type Entry,
  type Bullet,
  uid,
  createDocument,
} from "../document";

export interface ParsedLinkedInResult {
  document: ResumeDocument;
  warnings: string[];
  recordsCount: {
    positions: number;
    education: number;
    skills: number;
    certifications: number;
  };
}

/**
 * Parses RFC 4180 CSV text into an array of objects keyed by header column name.
 * Handles quoted fields, multiline cells, and escaped double quotes ("").
 */
export function parseCsvRecords(csvText: string): Array<Record<string, string>> {
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if (char === "\n" && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  // Normalize header keys (lowercase, trim)
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const records: Array<Record<string, string>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = row[c] ?? "";
    }
    records.push(record);
  }

  return records;
}

/**
 * Detects if a text string is a recognized LinkedIn export CSV.
 */
export function isLinkedInCsv(text: string): boolean {
  const firstLine = text.split("\n")[0]?.toLowerCase() ?? "";
  return (
    (firstLine.includes("company name") && firstLine.includes("title")) ||
    (firstLine.includes("school name") && firstLine.includes("degree")) ||
    (firstLine.includes("first name") && firstLine.includes("last name")) ||
    firstLine === "name" ||
    (firstLine.includes("start date") && firstLine.includes("end date"))
  );
}

/**
 * Ingests a set of named CSV files (e.g. from a LinkedIn data export archive)
 * into a single unified ResumeDocument.
 */
export function parseLinkedInArchive(
  files: Record<string, string>,
  candidateName = "Candidate",
): ParsedLinkedInResult {
  const doc = createDocument(false);
  const warnings: string[] = [];
  const recordsCount = {
    positions: 0,
    education: 0,
    skills: 0,
    certifications: 0,
  };

  // Helper to find file by partial name match
  const findContent = (pattern: RegExp): string | undefined => {
    for (const [filename, content] of Object.entries(files)) {
      if (pattern.test(filename)) return content;
    }
    return undefined;
  };

  // 1. Process Profile.csv
  const profileCsv = findContent(/profile\.csv$/i);
  if (profileCsv) {
    const records = parseCsvRecords(profileCsv);
    if (records.length > 0) {
      const p = records[0];
      const firstName = p["first name"] || "";
      const lastName = p["last name"] || "";
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        doc.contact.name = fullName;
        doc.name = `${fullName} · LinkedIn Resume`;
      }
      if (p["headline"]) doc.contact.headline = p["headline"];
      if (p["geo location"] || p["address"]) {
        doc.contact.location = p["geo location"] || p["address"];
      }
      if (p["summary"]) {
        const sumSection = doc.sections.find((s) => s.type === "summary");
        if (sumSection) {
          sumSection.entries = [
            {
              id: uid(),
              title: "",
              organization: "",
              location: "",
              start: "",
              end: "",
              current: false,
              description: p["summary"],
              bullets: [],
            },
          ];
          sumSection.visible = true;
        }
      }
    }
  }

  if (!doc.contact.name || doc.contact.name === "New resume" || /^(positions|education|skills|certifications)$/i.test(doc.contact.name)) {
    const cleanName = /^(positions|education|skills|certifications)$/i.test(candidateName)
      ? "Candidate"
      : candidateName;
    doc.contact.name = cleanName;
    doc.name = `${cleanName} · LinkedIn Resume`;
  }

  // 2. Process Positions.csv (Experience)
  const positionsCsv = findContent(/positions?\.csv$/i);
  if (positionsCsv) {
    const records = parseCsvRecords(positionsCsv);
    recordsCount.positions = records.length;
    const entries: Entry[] = [];

    for (const pos of records) {
      const title = pos["title"] || "Role";
      const organization = pos["company name"] || pos["company"] || "";
      const location = pos["location"] || "";
      const rawStart = pos["started on"] || pos["start date"] || "";
      const rawEnd = pos["finished on"] || pos["end date"] || "";
      const isCurrent = !rawEnd || rawEnd.toLowerCase() === "present";
      const start = normalizeLinkedInDate(rawStart);
      const end = isCurrent ? "" : normalizeLinkedInDate(rawEnd);
      const rawDesc = pos["description"] || "";

      // Split multiline descriptions or bullet-point markers
      const bullets: Bullet[] = [];
      const lines = rawDesc
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        const clean = line.replace(/^[•\-*–—▪▫\d.]+\s*/, "").trim();
        if (clean.length > 3) {
          bullets.push({ id: uid(), text: clean });
        }
      }

      entries.push({
        id: uid(),
        title,
        organization,
        location,
        start,
        end,
        current: isCurrent,
        description: bullets.length === 0 ? rawDesc : "",
        bullets,
      });
    }

    if (entries.length > 0) {
      // Find or create experience section
      let expSection = doc.sections.find((s) => s.type === "experience");
      if (expSection) {
        expSection.entries = entries;
        expSection.visible = true;
      } else {
        doc.sections.push({
          id: uid(),
          type: "experience",
          label: "Experience",
          visible: true,
          entries,
        });
      }
    }
  }

  // 3. Process Education.csv
  const educationCsv = findContent(/education\.csv$/i);
  if (educationCsv) {
    const records = parseCsvRecords(educationCsv);
    recordsCount.education = records.length;
    const entries: Entry[] = [];

    for (const edu of records) {
      const organization = edu["school name"] || edu["institution"] || "";
      const degree = edu["degree name"] || edu["degree"] || "";
      const field = edu["notes"] || edu["activities and societies"] || "";
      const title = degree || organization || "Degree";
      const start = normalizeLinkedInDate(edu["start date"] || "");
      const end = normalizeLinkedInDate(edu["end date"] || "");

      entries.push({
        id: uid(),
        title,
        organization: organization !== title ? organization : "",
        location: "",
        start,
        end,
        current: false,
        description: field,
        bullets: [],
      });
    }

    if (entries.length > 0) {
      let eduSection = doc.sections.find((s) => s.type === "education");
      if (eduSection) {
        eduSection.entries = entries;
        eduSection.visible = true;
      } else {
        doc.sections.push({
          id: uid(),
          type: "education",
          label: "Education",
          visible: true,
          entries,
        });
      }
    }
  }

  // 4. Process Skills.csv
  const skillsCsv = findContent(/skills?\.csv$/i);
  if (skillsCsv) {
    const records = parseCsvRecords(skillsCsv);
    recordsCount.skills = records.length;
    const skillNames = records
      .map((r) => r["name"] || r["skill"] || "")
      .filter((s) => s.length > 0);

    if (skillNames.length > 0) {
      let skillsSection = doc.sections.find((s) => s.type === "skills");
      if (!skillsSection) {
        skillsSection = {
          id: uid(),
          type: "skills",
          label: "Skills",
          visible: true,
          entries: [],
        };
        doc.sections.push(skillsSection);
      }
      skillsSection.entries = [
        {
          id: uid(),
          title: "Technical & Core Skills",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: skillNames.join(" · "),
          bullets: [],
        },
      ];
      skillsSection.visible = true;
    }
  }

  // 5. Process Certifications.csv
  const certsCsv = findContent(/certifications?\.csv$/i);
  if (certsCsv) {
    const records = parseCsvRecords(certsCsv);
    recordsCount.certifications = records.length;
    const entries: Entry[] = [];

    for (const cert of records) {
      const name = cert["name"] || "Certification";
      const authority = cert["authority"] || cert["organization"] || "";
      const start = normalizeLinkedInDate(cert["started on"] || "");
      const end = normalizeLinkedInDate(cert["finished on"] || "");
      const url = cert["url"] || "";

      entries.push({
        id: uid(),
        title: name,
        organization: authority,
        location: "",
        start,
        end,
        current: false,
        description: url ? `Credential: ${url}` : "",
        bullets: [],
      });
    }

    if (entries.length > 0) {
      let certSection = doc.sections.find((s) => s.type === "certifications");
      if (certSection) {
        certSection.entries = entries;
        certSection.visible = true;
      } else {
        doc.sections.push({
          id: uid(),
          type: "certifications",
          label: "Certifications",
          visible: true,
          entries,
        });
      }
    }
  }

  if (
    recordsCount.positions === 0 &&
    recordsCount.education === 0 &&
    recordsCount.skills === 0
  ) {
    warnings.push(
      "No recognized positions, education, or skills rows were found in the uploaded file(s).",
    );
  }

  return {
    document: doc,
    warnings,
    recordsCount,
  };
}

export function normalizeLinkedInDate(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Valid YYYY or YYYY-MM
  if (/^\d{4}$/.test(trimmed) || /^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    return trimmed;
  }
  // ISO like 2022-01 or 2022/01
  const isoMatch = trimmed.match(/\b((?:19|20)\d{2})[-/](0[1-9]|1[0-2])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }
  // Month name and year: "Jan 2022", "January 2022", "May 2021"
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const textMatch = trimmed.match(/\b([A-Za-z]{3})[a-z]*\.?\s+((?:19|20)\d{2})\b/);
  if (textMatch) {
    const month = monthMap[textMatch[1].toLowerCase().slice(0, 3)] || "01";
    return `${textMatch[2]}-${month}`;
  }
  // MM/YYYY
  const slashMatch = trimmed.match(/\b(0[1-9]|1[0-2])\/((?:19|20)\d{2})\b/);
  if (slashMatch) {
    return `${slashMatch[2]}-${slashMatch[1]}`;
  }
  // Isolated 4-digit year
  const yearMatch = trimmed.match(/\b((?:19|20)\d{2})\b/);
  if (yearMatch) {
    return yearMatch[1];
  }
  return "";
}
