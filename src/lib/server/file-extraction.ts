import { fork, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { fromBuffer, type Entry } from "yauzl";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { layoutBlocks } from "../layout";
import type { ResumeDocument } from "../document";
import {
  FILE_DIAGNOSTIC_VERSION,
  type FileDiagnosticReport,
  type FileDiagnosticCheck,
} from "../file-diagnostics";
import { HttpError } from "./http";

export const MAX_FILE_SIZE = 5_000_000;
const MAX_TEXT = 200_000;
let activePdfProcesses = 0;
type Extraction = {
  comparisonText?: string;
  pages: string[];
  links: string[];
  parser: { name: string; version: string };
  tables?: number;
  textBoxes?: number;
};
function invalid(
  code = "UNREADABLE_FILE",
  message = "This file could not be read. Choose an unencrypted PDF, DOCX or UTF-8 TXT file.",
) {
  return new HttpError(422, code, message);
}
function pdfText(bytes: Uint8Array): Promise<Extraction> {
  if (activePdfProcesses >= 2)
    throw new HttpError(
      429,
      "PARSER_BUSY",
      "File checks are busy. Try again shortly.",
    );
  activePdfProcesses++;
  return new Promise((resolve, reject) => {
    let parser: ChildProcess;
    try {
      parser = fork(
        new URL("./pdf-diagnostic-process.mjs", import.meta.url),
        [],
        {
          execArgv: ["--max-old-space-size=128", "--stack-size=4096"],
          serialization: "advanced",
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          ...{ windowsHide: true },
        },
      );
    } catch {
      activePdfProcesses--;
      reject(invalid());
      return;
    }
    let finished = false;
    const finish = (error?: Error, result?: Extraction, stopParser = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (stopParser) parser.kill();
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(
      () =>
        finish(
          new HttpError(
            408,
            "PARSER_TIMEOUT",
            "File extraction timed out. Try a smaller file.",
          ),
          undefined,
          true,
        ),
      15000,
    );
    parser.once("message", (result: Extraction & { error?: string }) => {
      if (result.error) {
        finish(
          invalid(
            result.error,
            result.error === "ENCRYPTED"
              ? "Password-protected PDFs are not supported. Upload an unencrypted copy."
              : result.error === "LIMIT"
                ? "This file exceeds the extraction limits: 40 PDF pages or 200,000 text/link characters. Try a smaller file."
                : undefined,
          ),
        );
      } else finish(undefined, result);
    });
    parser.once("error", () => finish(invalid()));
    parser.once("close", () => {
      activePdfProcesses--;
      if (!finished) finish(invalid());
    });
    try {
      parser.send({ bytes }, (error) => {
        if (error) finish(invalid(), undefined, true);
      });
    } catch {
      finish(invalid(), undefined, true);
    }
  });
}
function docxParts(bytes: Uint8Array): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      Buffer.from(bytes),
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error || !zip) {
          reject(invalid());
          return;
        }
        const parts = new Map<string, string>();
        const seen = new Set<string>();
        let entries = 0,
          expanded = 0,
          done = false;
        const fail = () => {
          if (done) return;
          done = true;
          zip.close();
          reject(
            invalid(
              "INVALID_DOCX",
              "This DOCX archive is malformed or exceeds the extraction limits.",
            ),
          );
        };
        const timer = setTimeout(fail, 10000);
        zip.on("error", fail);
        zip.on("end", () => {
          clearTimeout(timer);
          if (!done) {
            done = true;
            resolve(parts);
          }
        });
        zip.on("close", () => clearTimeout(timer));
        zip.on("entry", (entry: Entry) => {
          entries++;
          expanded += entry.uncompressedSize;
          if (
            entries > 1000 ||
            expanded > 20_000_000 ||
            entry.uncompressedSize > 5_000_000 ||
            entry.generalPurposeBitFlag & 1 ||
            seen.has(entry.fileName) ||
            /(?:^|\/)\.\.(?:\/|$)|^\//.test(entry.fileName)
          ) {
            fail();
            return;
          }
          seen.add(entry.fileName);
          if (
            ![
              "[Content_Types].xml",
              "word/document.xml",
              "word/_rels/document.xml.rels",
            ].includes(entry.fileName)
          ) {
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) {
              fail();
              return;
            }
            const chunks: Buffer[] = [];
            let count = 0;
            stream.on("data", (chunk: Buffer) => {
              count += chunk.length;
              if (count > 5_000_000) {
                stream.destroy();
                fail();
              } else chunks.push(chunk);
            });
            stream.on("error", fail);
            stream.on("end", () => {
              if (done) return;
              try {
                parts.set(
                  entry.fileName,
                  new TextDecoder("utf-8", { fatal: true }).decode(
                    Buffer.concat(chunks),
                  ),
                );
              } catch {
                fail();
                return;
              }
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
// Preserve paragraph/run order. Do not expand DTD/custom entities or read links.
const xmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
  processEntities: false,
});
function xmlNodes(xml: string): Record<string, unknown>[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw invalid(
      "INVALID_DOCX",
      "This DOCX contains invalid or unsupported XML.",
    );
  let depth = 0,
    tags = 0;
  for (const match of xml.matchAll(
    /<(\/?)[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?(\/?)>/g,
  )) {
    if (++tags > 50000)
      throw invalid("LIMIT", "This DOCX contains too many XML structures.");
    if (match[1]) depth--;
    else if (!match[2]) depth++;
    if (depth > 100)
      throw invalid("LIMIT", "This DOCX contains excessively nested XML.");
  }
  return xmlParser.parse(xml);
}
function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (original, entity: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      };
      if (named[entity]) return named[entity];
      const point = entity.startsWith("#x")
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : original;
    },
  );
}
function walk(
  nodes: Record<string, unknown>[],
  visit: (
    tag: string,
    attrs: Record<string, string>,
    children: Record<string, unknown>[],
  ) => void,
) {
  for (const node of nodes) {
    for (const [tag, value] of Object.entries(node)) {
      if (tag === ":@" || tag === "#text" || !Array.isArray(value)) continue;
      visit(tag, (node[":@"] ?? {}) as Record<string, string>, value);
      walk(value, visit);
    }
  }
}
async function docxText(bytes: Uint8Array): Promise<Extraction> {
  const parts = await docxParts(bytes);
  const document = parts.get("word/document.xml"),
    types = parts.get("[Content_Types].xml");
  if (
    !document ||
    !types ||
    !types.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    )
  )
    throw invalid(
      "INVALID_DOCX",
      "Choose a valid DOCX document, rather than a renamed ZIP or macro-enabled file.",
    );
  xmlNodes(types);
  const nodes = xmlNodes(document);
  let text = "",
    tables = 0,
    textBoxes = 0;
  walk(nodes, (tag, _attrs, children) => {
    if (tag === "w:t")
      text += decodeEntities(
        children
          .map((node) =>
            typeof node["#text"] === "string" ? node["#text"] : "",
          )
          .join(""),
      );
    if (tag === "w:tab") text += "\t";
    if (tag === "w:br" || tag === "w:cr") text += "\n";
    if (tag === "w:p") text += "\n";
    if (tag === "w:tbl") tables++;
    if (tag === "w:txbxContent") textBoxes++;
    if (text.length > MAX_TEXT)
      throw invalid(
        "LIMIT",
        "Choose a document with at most 200,000 text characters.",
      );
  });
  const links: string[] = [];
  const relationships = parts.get("word/_rels/document.xml.rels");
  if (relationships)
    walk(xmlNodes(relationships), (tag, attrs) => {
      if (
        tag === "Relationship" &&
        attrs["@_Type"]?.endsWith("/hyperlink") &&
        attrs["@_TargetMode"] === "External"
      )
        links.push(decodeEntities(attrs["@_Target"] || ""));
    });
  return {
    pages: [text.trim()],
    links,
    tables,
    textBoxes,
    parser: {
      name: "DOCX body XML (yauzl + fast-xml-parser)",
      version: "3.4.0 / 5.11.2",
    },
  };
}
const comparable = (text: string) =>
  text.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("en-US");
export async function analyzeFile(
  file: File,
  expected?: ResumeDocument,
): Promise<FileDiagnosticReport> {
  if (file.size > MAX_FILE_SIZE)
    throw new HttpError(
      413,
      "FILE_TOO_LARGE",
      "File exceeds the 5 MB size limit.",
    );
  const format = file.name.toLowerCase().split(".").at(-1);
  if (format !== "pdf" && format !== "docx" && format !== "txt")
    throw new HttpError(
      415,
      "UNSUPPORTED_FILE",
      "Supported files are PDF, DOCX and UTF-8 TXT.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length) throw invalid("EMPTY_FILE", "The selected file is empty.");
  let extraction: Extraction;
  if (format === "pdf") {
    if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-")))
      throw invalid();
    extraction = await pdfText(bytes);
  } else if (format === "docx")
    extraction = await docxText(bytes).catch((error) => {
      if (error instanceof HttpError) throw error;
      throw invalid();
    });
  else {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw invalid("INVALID_TEXT", "Choose a UTF-8 TXT file.");
    }
    if (text.length > MAX_TEXT)
      throw invalid(
        "LIMIT",
        "Choose a file with at most 200,000 text characters.",
      );
    if (text.includes("\u0000"))
      throw invalid(
        "INVALID_TEXT",
        "Choose a UTF-8 TXT file without binary data.",
      );
    extraction = {
      pages: [text],
      links: [],
      parser: { name: "UTF-8 text decoder", version: "1" },
    };
  }
  const text = extraction.pages.join("\n\n");
  const blankPages = extraction.pages.filter((page) => !page.trim()).length;
  const checks: FileDiagnosticCheck[] = [
    {
      id: "text",
      label: "Selectable text",
      status: text.trim() ? "observed" : "issue",
      detail: text.trim()
        ? `${text.length} characters extracted. Review the text below for omissions.`
        : "No readable text was extracted. Image-only or scanned files need a separate OCR workflow; OCR was not run.",
    },
    {
      id: "empty_pages",
      label: "Pages without extracted text",
      status:
        format === "pdf" ? (blankPages ? "issue" : "observed") : "not_checked",
      detail:
        format === "pdf"
          ? `${blankPages} of ${extraction.pages.length} pages have no extracted text.`
          : "Physical page boundaries are not determined for DOCX/TXT.",
    },
    {
      id: "characters",
      label: "Character signals",
      status: /[\ufffd\ue000-\uf8ff]/u.test(text) ? "issue" : "observed",
      detail: /[\ufffd\ue000-\uf8ff]/u.test(text)
        ? "Replacement or private-use characters were observed. Compare them with the original."
        : /[\ufb00-\ufb06]/u.test(text)
          ? "Typographic ligatures were observed. Comparison expands them; raw extracted text is preserved below."
          : "No replacement, private-use characters or common Latin ligatures were observed. This does not verify every glyph.",
    },
    {
      id: "links",
      label: "Link targets",
      status: extraction.links.length ? "observed" : "not_checked",
      detail: `${extraction.links.length} link targets extracted. Destinations were not opened or verified.`,
    },
    {
      id: "layout",
      label: "Visual layout and font rendering",
      status: "not_checked",
      detail:
        "Text extraction does not check visual clipping, installed fonts or ATS acceptance.",
    },
  ];
  if (format === "docx")
    checks.push({
      id: "structures",
      label: "DOCX body structures",
      status: extraction.tables || extraction.textBoxes ? "issue" : "observed",
      detail: `${extraction.tables} tables and ${extraction.textBoxes} text boxes observed in body XML. Headers, footers and visual reading order are not analyzed.`,
    });
  let comparison: FileDiagnosticReport["comparison"] = null;
  if (expected && text.trim()) {
    const blocks = layoutBlocks(expected).filter(
      (block) => block.kind !== "photo" && block.text.trim(),
    );
    const body = comparable(extraction.comparisonText ?? text);
    const consumed: { start: number; end: number }[] = [];
    const availableIndex = (value: string, from: number) => {
      let index = body.indexOf(value, from);
      while (
        index >= 0 &&
        consumed.some(
          (range) => index < range.end && index + value.length > range.start,
        )
      )
        index = body.indexOf(value, index + 1);
      return index;
    };
    const findings: NonNullable<
      FileDiagnosticReport["comparison"]
    >["findings"] = [];
    let cursor = 0,
      foundCount = 0,
      missingCount = 0,
      outOfOrderCount = 0;
    for (const block of blocks) {
      const value = comparable(block.text);
      const index = availableIndex(value, cursor);
      if (index >= 0) {
        foundCount++;
        cursor = index + value.length;
        consumed.push({ start: index, end: cursor });
      } else {
        const earlier = availableIndex(value, 0);
        const status = earlier >= 0 ? "out_of_order" : "missing";
        if (earlier >= 0)
          consumed.push({ start: earlier, end: earlier + value.length });
        if (status === "missing") missingCount++;
        else {
          outOfOrderCount++;
          foundCount++;
        }
        if (findings.length < 30)
          findings.push({
            id: block.id,
            text: block.text.slice(0, 160),
            status,
          });
      }
    }
    comparison = {
      documentId: expected.id,
      revision: expected.revision,
      contentHash: createHash("sha256")
        .update(JSON.stringify(blocks))
        .digest("hex"),
      expectedCount: blocks.length,
      foundCount,
      missingCount,
      outOfOrderCount,
      findings,
    };
    checks.push({
      id: "comparison",
      label: "Source text and order",
      status: missingCount || outOfOrderCount ? "issue" : "observed",
      detail: `${foundCount}/${blocks.length} visible source blocks found; ${missingCount} missing, ${outOfOrderCount} out of sequence. Matching normalizes case, whitespace and typographic ligatures; known app PDF footer text is excluded. It does not establish visual reading order.`,
    });
  } else
    checks.push({
      id: "comparison",
      label: "Source text and order",
      status: "not_checked",
      detail: expected
        ? "No readable text is available to compare with the current CV."
        : "No expected source document was supplied. Missing facts and source order cannot be verified.",
    });
  return {
    version: FILE_DIAGNOSTIC_VERSION,
    analyzedAt: new Date().toISOString(),
    file: {
      name: file.name.slice(0, 200),
      format,
      size: file.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
    parser: extraction.parser,
    text,
    pageCount: format === "pdf" ? extraction.pages.length : null,
    links: extraction.links.slice(0, 100),
    checks,
    comparison,
  };
}
