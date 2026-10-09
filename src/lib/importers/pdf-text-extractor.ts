import { inflateSync } from "node:zlib";

/**
 * Extracts plain text from an unencrypted PDF ArrayBuffer/Buffer.
 * Decompresses FlateDecode streams and parses PDF text operators (BT...ET, Tj, TJ).
 */
export function extractTextFromPdf(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const latin1 = new TextDecoder("latin1").decode(bytes);

  const textPieces: string[] = [];
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(latin1)) !== null) {
    const streamStart = match.index + match[0].indexOf("\n") + 1;
    const streamLength = match[1].length;
    const rawStreamBytes = bytes.subarray(streamStart, streamStart + streamLength);

    let streamText = "";
    // Check if the stream was compressed with FlateDecode
    try {
      const decompressed = inflateSync(rawStreamBytes);
      streamText = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);
    } catch {
      // If inflate fails, try uncompressed ASCII/latin1
      streamText = match[1];
    }

    if (streamText.includes("BT") && streamText.includes("ET")) {
      const extracted = parsePdfStreamText(streamText);
      if (extracted.trim()) {
        textPieces.push(extracted);
      }
    }
  }

  // Fallback: If no streams yielded text, scan for raw string literals
  if (textPieces.length === 0) {
    const rawStrings = parsePdfStreamText(latin1);
    if (rawStrings.trim()) {
      textPieces.push(rawStrings);
    }
  }

  return cleanExtractedText(textPieces.join("\n\n"));
}

/**
 * Parses text inside PDF BT (Begin Text) and ET (End Text) blocks.
 */
function parsePdfStreamText(streamContent: string): string {
  const lines: string[] = [];
  const btEtRegex = /BT[\r\n]+([\s\S]*?)[\r\n]+ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = btEtRegex.exec(streamContent)) !== null) {
    const block = blockMatch[1];
    const blockLines: string[] = [];

    // Parse (string) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      blockLines.push(unescapePdfString(tjMatch[1]));
    }

    // Parse [(str1) num (str2)] TJ
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrayMatch: RegExpExecArray | null;
    while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
      const parts = tjArrayMatch[1];
      const partRegex = /\(([^)]*)\)/g;
      let pMatch: RegExpExecArray | null;
      let assembled = "";
      while ((pMatch = partRegex.exec(parts)) !== null) {
        assembled += unescapePdfString(pMatch[1]);
      }
      if (assembled.trim()) {
        blockLines.push(assembled);
      }
    }

    if (blockLines.length > 0) {
      lines.push(blockLines.join(" "));
    }
  }

  return lines.join("\n");
}

function unescapePdfString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // strip control characters
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
