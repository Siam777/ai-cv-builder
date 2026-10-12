import type { ResumeDocument } from "../document";
import { layoutBlocks } from "../layout";
import { accents, densities, fonts, pageMetrics } from "../presentation";
import { SimpleZip } from "./zip-writer";

function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const wns =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const rns =
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const relationshipType =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";

/** Editable, sequential Word layout. Decorative PDF rails/panels and photos
 * intentionally stay out of DOCX; content and presentation tokens are shared. */
export function exportToDocx(
  doc: ResumeDocument,
  options?: { showWatermark?: boolean },
): Uint8Array {
  const zip = new SimpleZip();
  const p = doc.presentation;
  const metrics = pageMetrics(p);
  const density = densities[p.density];
  const accent = accents[p.accent].slice(1);
  const font = fonts[p.font].name;
  const rtl = p.direction === "rtl";
  const bidi = rtl ? '<w:bidi/><w:jc w:val="right"/>' : "";
  const centered = ["classic", "executive", "elegant"].includes(p.template);
  const serif = ["classic", "executive", "elegant", "academic"].includes(
    p.template,
  );
  const nameSize =
    p.template === "compact" ? 22 : p.template === "minimalist" ? 25 : 27;
  const twips = (mm: number) => Math.round((mm * 1440) / 25.4);
  const run = (text: string, properties = "") =>
    `<w:r>${properties || rtl ? `<w:rPr>${properties}${rtl ? "<w:rtl/>" : ""}</w:rPr>` : ""}${text
      .split(/\r?\n/)
      .map(
        (line, i) =>
          `${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`,
      )
      .join("")}</w:r>`;
  const relationships = [
    `<Relationship Id="styles" Type="${relationshipType}styles" Target="styles.xml"/>`,
    `<Relationship Id="numbering" Type="${relationshipType}numbering" Target="numbering.xml"/>`,
  ];
  const paragraphs = layoutBlocks(doc)
    .filter((block) => block.kind !== "photo")
    .map((block, index) => {
      const style =
        block.kind === "name"
          ? "Title"
          : block.kind === "section"
            ? "Heading1"
            : block.kind === "title"
              ? "Heading2"
              : block.kind === "headline"
                ? "Subtitle"
                : block.kind === "meta" || block.kind === "contact"
                  ? "Metadata"
                  : "Normal";
      let properties = `<w:pStyle w:val="${style}"/>${bidi}${block.keepNext ? "<w:keepNext/>" : ""}<w:widowControl/>`;
      if (centered && ["name", "headline", "contact"].includes(block.kind))
        properties += '<w:jc w:val="center"/>';
      if (block.kind === "bullet")
        properties +=
          '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
      let content = run(block.text);
      if (block.href) {
        const id = `link${index}`;
        relationships.push(
          `<Relationship Id="${id}" Type="${relationshipType}hyperlink" Target="${escapeXml(block.href)}" TargetMode="External"/>`,
        );
        content = `<w:hyperlink r:id="${id}">${run(block.text, `<w:color w:val="${accent}"/><w:u w:val="single"/>`)}</w:hyperlink>`;
      }
      return `<w:p><w:pPr>${properties}</w:pPr>${content}</w:p>`;
    });
  const watermark = !!options?.showWatermark;
  if (watermark) {
    relationships.push(
      `<Relationship Id="footer" Type="${relationshipType}footer" Target="footer1.xml"/>`,
    );
    zip.addFile(
      "word/footer1.xml",
      `${declaration}<w:ftr ${wns}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run("Created with AI CV Builder", '<w:sz w:val="15"/><w:color w:val="677468"/>')}</w:p></w:ftr>`,
    );
  }
  zip.addFile(
    "[Content_Types].xml",
    `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${["document", "styles", "numbering"].map((part) => `<Override PartName="/word/${part}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${part === "document" ? "document.main" : part}+xml"/>`).join("")}${watermark ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ""}</Types>`,
  );
  zip.addFile(
    "_rels/.rels",
    `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="${relationshipType}officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.addFile(
    "word/_rels/document.xml.rels",
    `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`,
  );
  const style = (
    id: string,
    name: string,
    paragraph: string,
    properties: string,
  ) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr>${paragraph}</w:pPr><w:rPr>${properties}</w:rPr></w:style>`;
  const headingFont = serif
    ? '<w:rFonts w:ascii="Source Serif 4" w:hAnsi="Source Serif 4"/>'
    : "";
  zip.addFile(
    "word/styles.xml",
    `${declaration}<w:styles ${wns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${p.fontSize * 2}"/><w:szCs w:val="${p.fontSize * 2}"/><w:color w:val="26322C"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${p.density === "tight" ? 40 : 80}" w:line="${Math.round(density.lineHeight * 240)}" w:lineRule="auto"/><w:widowControl/>${bidi}</w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  ${style("Title", "Title", '<w:keepNext/><w:spacing w:after="140"/>', `${headingFont}<w:b/><w:sz w:val="${nameSize * 2}"/><w:color w:val="${accent}"/>`)}
  ${style("Subtitle", "Subtitle", '<w:keepNext/><w:spacing w:after="140"/>', `<w:sz w:val="22"/><w:color w:val="${accent}"/>`)}
  ${style("Heading1", "heading 1", `<w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/><w:spacing w:before="${density.gap * 20}" w:after="100"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="${accent}"/></w:pBdr>`, `${headingFont}<w:b/><w:sz w:val="22"/><w:color w:val="${accent}"/>`)}
  ${style("Heading2", "heading 2", '<w:keepNext/><w:keepLines/><w:outlineLvl w:val="1"/><w:spacing w:before="100" w:after="40"/>', "<w:b/>")}
  ${style("Metadata", "Metadata", '<w:spacing w:after="60"/>', '<w:sz w:val="18"/><w:color w:val="4F5F52"/>')}
  </w:styles>`,
  );
  zip.addFile(
    "word/numbering.xml",
    `${declaration}<w:numbering ${wns}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="${rtl ? "right" : "left"}"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="240"/></w:tabs><w:ind w:${rtl ? "right" : "left"}="240" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
  );
  zip.addFile(
    "word/document.xml",
    `${declaration}<w:document ${wns} ${rns}><w:body>${paragraphs.join("")}<w:sectPr>${watermark ? '<w:footerReference w:type="default" r:id="footer"/>' : ""}<w:pgSz w:w="${twips(metrics.width)}" w:h="${twips(metrics.height)}"/><w:pgMar w:top="${twips(metrics.margin)}" w:right="${twips(metrics.margin)}" w:bottom="${twips(metrics.margin)}" w:left="${twips(metrics.margin)}" w:footer="397"/>${rtl ? "<w:bidi/>" : ""}</w:sectPr></w:body></w:document>`,
  );
  return zip.generate();
}
