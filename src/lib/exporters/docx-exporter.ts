import {
  type ResumeDocument,
  type Entry,
  dateRange,
} from "../document";
import { SimpleZip } from "./zip-writer";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTextRun(text: string, options?: { bold?: boolean; italic?: boolean; sizePt?: number; colorHex?: string }): string {
  const rPrParts: string[] = [];
  if (options?.bold) rPrParts.push("<w:b/>");
  if (options?.italic) rPrParts.push("<w:i/>");
  if (options?.sizePt) rPrParts.push(`<w:sz w:val="${Math.round(options.sizePt * 2)}"/>`);
  if (options?.colorHex) rPrParts.push(`<w:color w:val="${options.colorHex.replace("#", "")}"/>`);

  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

export function exportToDocx(
  doc: ResumeDocument,
  options?: { showWatermark?: boolean },
): Uint8Array {
  const zip = new SimpleZip();

  // 1. [Content_Types].xml
  zip.addFile(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );

  // 2. _rels/.rels
  zip.addFile(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  // 3. word/_rels/document.xml.rels
  zip.addFile(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );

  // 4. word/styles.xml
  zip.addFile(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:color w:val="26322C"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`,
  );

  // 5. word/document.xml
  const isLetter = doc.presentation.pageSize === "Letter";
  const pgW = isLetter ? 12240 : 11906; // twips
  const pgH = isLetter ? 15840 : 16838;
  const marginTwips = 850; // ~15mm

  const isRtl = doc.presentation.direction === "rtl";
  const bidiPr = isRtl ? '<w:bidi/><w:jc w:val="right"/>' : "";
  const bidiBulletPr = isRtl
    ? '<w:bidi/><w:jc w:val="right"/><w:ind w:right="360" w:hanging="180"/>'
    : '<w:ind w:left="360" w:hanging="180"/>';

  const paragraphs: string[] = [];

  // Contact Name
  paragraphs.push(`
    <w:p>
      <w:pPr>
        ${bidiPr}
        <w:spacing w:after="80"/>
      </w:pPr>
      ${xmlTextRun(doc.contact.name || "Resume", { bold: true, sizePt: 22, colorHex: "1A221D" })}
    </w:p>`);

  // Headline
  if (doc.contact.headline) {
    paragraphs.push(`
      <w:p>
        <w:pPr>
          ${bidiPr}
          <w:spacing w:after="100"/>
        </w:pPr>
        ${xmlTextRun(doc.contact.headline, { bold: true, sizePt: 11, colorHex: "285641" })}
      </w:p>`);
  }

  // Contact Info Row
  const contactParts = [
    doc.contact.email,
    doc.contact.phone,
    doc.contact.location,
    doc.contact.website,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    paragraphs.push(`
      <w:p>
        <w:pPr>
          ${bidiPr}
          <w:spacing w:after="240"/>
        </w:pPr>
        ${xmlTextRun(contactParts.join(" | "), { sizePt: 9, colorHex: "556358" })}
      </w:p>`);
  }

  // Sections
  for (const section of doc.sections) {
    if (!section.visible || section.entries.length === 0) continue;

    // Section Heading
    paragraphs.push(`
      <w:p>
        <w:pPr>
          ${bidiPr}
          <w:spacing w:before="260" w:after="100"/>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="6" w:space="3" w:color="285641"/>
          </w:pBdr>
        </w:pPr>
        ${xmlTextRun(section.label.toUpperCase(), { bold: true, sizePt: 11, colorHex: "285641" })}
      </w:p>`);

    // Entries
    for (const entry of section.entries) {
      const headingParts = [entry.title, entry.organization].filter(Boolean);
      const metaParts = [entry.location, dateRange(entry)].filter(Boolean);

      if (headingParts.length > 0) {
        paragraphs.push(`
          <w:p>
            <w:pPr>
              ${bidiPr}
              <w:spacing w:before="120" w:after="40"/>
            </w:pPr>
            ${xmlTextRun(headingParts.join(" · "), { bold: true, sizePt: 10.5 })}
          </w:p>`);
      }

      if (metaParts.length > 0) {
        paragraphs.push(`
          <w:p>
            <w:pPr>
              ${bidiPr}
              <w:spacing w:after="80"/>
            </w:pPr>
            ${xmlTextRun(metaParts.join(" | "), { italic: true, sizePt: 9, colorHex: "5B695E" })}
          </w:p>`);
      }

      if (entry.description) {
        paragraphs.push(`
          <w:p>
            <w:pPr>
              ${bidiPr}
              <w:spacing w:after="80"/>
            </w:pPr>
            ${xmlTextRun(entry.description, { sizePt: 10 })}
          </w:p>`);
      }

      for (const bullet of entry.bullets) {
        if (!bullet.text.trim()) continue;
        paragraphs.push(`
          <w:p>
            <w:pPr>
              ${bidiBulletPr}
              <w:spacing w:after="40"/>
            </w:pPr>
            ${xmlTextRun("• ", { sizePt: 10, colorHex: "285641" })}
            ${xmlTextRun(bullet.text.trim(), { sizePt: 10 })}
          </w:p>`);
      }
    }
  }

  // Watermark if requested
  if (options?.showWatermark) {
    paragraphs.push(`
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:before="400" w:after="100"/>
        </w:pPr>
        ${xmlTextRun("Created with AI CV Builder", { italic: true, sizePt: 8, colorHex: "888888" })}
      </w:p>`);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="${pgW}" w:h="${pgH}"/>
      <w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.addFile("word/document.xml", documentXml);

  return zip.generate();
}
