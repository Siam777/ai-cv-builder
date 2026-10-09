import {
  type ResumeDocument,
  type Entry,
  dateRange,
} from "../document";

/**
 * Escapes characters that have special syntactic meaning in Markdown.
 */
function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, "\\$1");
}

/**
 * Converts a ResumeDocument into clean, semantic GitHub-Flavored Markdown.
 */
export function exportToMarkdown(doc: ResumeDocument): string {
  const lines: string[] = [];

  // Header / Contact info
  lines.push(`# ${doc.contact.name || "Resume"}`);
  if (doc.contact.headline) {
    lines.push(`**${doc.contact.headline}**`);
  }

  const contactParts: string[] = [];
  if (doc.contact.email) {
    contactParts.push(`[${doc.contact.email}](mailto:${doc.contact.email})`);
  }
  if (doc.contact.phone) {
    contactParts.push(doc.contact.phone);
  }
  if (doc.contact.location) {
    contactParts.push(doc.contact.location);
  }
  if (doc.contact.website) {
    const href = doc.contact.website.startsWith("http")
      ? doc.contact.website
      : `https://${doc.contact.website}`;
    contactParts.push(`[${doc.contact.website}](${href})`);
  }

  if (contactParts.length > 0) {
    lines.push(contactParts.join(" · "));
  }

  lines.push("");

  // Sections
  for (const section of doc.sections) {
    if (!section.visible || section.entries.length === 0) continue;

    lines.push("---");
    lines.push("");
    lines.push(`## ${section.label}`);
    lines.push("");

    for (const entry of section.entries) {
      const headingParts = [entry.title, entry.organization].filter(Boolean);
      if (headingParts.length > 0) {
        lines.push(`### ${headingParts.join(" · ")}`);
      }

      const metaParts = [entry.location, dateRange(entry)].filter(Boolean);
      if (metaParts.length > 0) {
        lines.push(`*${metaParts.join(" | ")}*`);
      }

      if (entry.description) {
        lines.push("");
        lines.push(entry.description);
      }

      if (entry.bullets.length > 0) {
        lines.push("");
        for (const bullet of entry.bullets) {
          if (bullet.text.trim()) {
            lines.push(`- ${bullet.text.trim()}`);
          }
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}
