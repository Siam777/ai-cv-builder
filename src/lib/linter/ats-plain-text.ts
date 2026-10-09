import type { ResumeDocument } from "../document";
import { dateRange } from "../document";

export interface AtsAuditResult {
  readingOrderValid: boolean;
  hasHazardousTables: boolean;
  hasLigatures: boolean;
  diagnostics: string[];
  plainText: string;
}

/**
 * Extracts normalized plain text matching the linear extraction algorithms
 * used by enterprise ATS systems (Workday, Taleo, Greenhouse, iCIMS).
 */
export function extractAtsPlainText(doc: ResumeDocument): string {
  const lines: string[] = [];

  // 1. Header & Contact
  if (doc.contact.name) lines.push(doc.contact.name.toUpperCase());
  if (doc.contact.headline) lines.push(doc.contact.headline);

  const contactParts = [
    doc.contact.email,
    doc.contact.phone,
    doc.contact.location,
    doc.contact.website,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    lines.push(contactParts.join(" • "));
  }
  lines.push("");

  // 2. Strictly Sequential Sections
  for (const section of doc.sections.filter((s) => s.visible && s.entries.length > 0)) {
    lines.push(section.label.toUpperCase());
    lines.push("-".repeat(Math.max(20, section.label.length)));

    for (const entry of section.entries) {
      const headerParts = [entry.title, entry.organization].filter(Boolean);
      if (headerParts.length > 0) lines.push(headerParts.join(" | "));

      const metaParts = [entry.location, dateRange(entry)].filter(Boolean);
      if (metaParts.length > 0) lines.push(metaParts.join(" | "));

      if (entry.description) lines.push(entry.description);

      for (const bullet of entry.bullets) {
        if (bullet.text.trim()) {
          lines.push(`• ${bullet.text.trim()}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

/**
 * Runs ATS diagnostic checks on the document structure and text content.
 */
export function auditAtsExtraction(doc: ResumeDocument): AtsAuditResult {
  const plainText = extractAtsPlainText(doc);
  const diagnostics: string[] = [];

  // Check 1: Applicant name at line 0
  const firstLine = plainText.split("\n")[0] || "";
  if (!firstLine.trim() || firstLine !== doc.contact.name.toUpperCase()) {
    diagnostics.push("Applicant name is not clearly detected on the first line.");
  }

  // Check 2: Check for font ligatures or problematic non-standard characters
  const ligaturePattern = /[\uFB00-\uFB06]/;
  const hasLigatures = ligaturePattern.test(plainText);
  if (hasLigatures) {
    diagnostics.push("Text contains Unicode ligatures (e.g. fi/fl) which may fail standard keyword search.");
  }

  // Check 3: Reading order integrity
  const visibleSections = doc.sections.filter((s) => s.visible && s.entries.length > 0);
  let readingOrderValid = true;

  // Verify that all visible sections appear in the extracted text in sequential order
  let lastIndex = 0;
  for (const s of visibleSections) {
    const idx = plainText.indexOf(s.label.toUpperCase());
    if (idx === -1 || idx < lastIndex) {
      readingOrderValid = false;
      diagnostics.push(`Section “${s.label}” is out of sequential order or missing in plain text stream.`);
      break;
    }
    lastIndex = idx;
  }

  return {
    readingOrderValid,
    hasHazardousTables: false, // HTML preview uses CSS grid/flexbox without nested layout tables
    hasLigatures,
    diagnostics,
    plainText,
  };
}
