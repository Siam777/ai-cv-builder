import { getDocument, version } from "pdfjs-dist/legacy/build/pdf.mjs";

// This isolated process extracts text and link annotations only. No viewer, scripting
// manager, rendering, remote URL, or candidate-supplied JavaScript is invoked.
process.once("message", async ({ bytes }) => {
  let result;
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: false,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: true,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 40) throw new Error("LIMIT");
    const pages = [],
      bodyPages = [],
      links = [];
    let characters = 0,
      linkCharacters = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // PDF.js may split a page counter into several text items (especially RTL).
      // Ignore a footer row only when the entire row matches our known furniture.
      const footerRows = new Map();
      for (const item of content.items) {
        if (typeof item.str !== "string" || item.transform?.[5] >= 35) continue;
        const y = Math.round(item.transform[5] * 100);
        footerRows.set(y, (footerRows.get(y) || "") + item.str);
      }
      const knownFooterRows = new Set(
        [...footerRows]
          .filter(([, value]) => {
            const row = value
              .replace("Created with AI CV Builder", "")
              .replace(/\s+/g, "");
            return (
              row === `${i}/${pdf.numPages}` ||
              row === `${pdf.numPages}/${i}` ||
              value.trim() === "Created with AI CV Builder"
            );
          })
          .map(([y]) => y),
      );
      let text = "",
        body = "";
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        text += item.str + (item.hasEOL ? "\n" : "");
        const footer =
          item.transform?.[5] < 35 &&
          knownFooterRows.has(Math.round(item.transform[5] * 100));
        if (!footer) body += item.str + (item.hasEOL ? "\n" : "");
        characters += item.str.length;
        if (characters > 200000) throw new Error("LIMIT");
      }
      pages.push(text.trim());
      bodyPages.push(body.trim());
      for (const annotation of await page.getAnnotations()) {
        if (typeof annotation.url === "string") {
          linkCharacters += annotation.url.length;
          if (linkCharacters > 200000) throw new Error("LIMIT");
          links.push(annotation.url);
        }
        if (links.length > 1000) throw new Error("LIMIT");
      }
      page.cleanup();
    }
    result = {
      pages,
      comparisonText: bodyPages.join("\n\n"),
      links,
      parser: { name: "PDF.js text extraction", version },
    };
  } catch (error) {
    result = {
      error:
        error.name === "PasswordException"
          ? "ENCRYPTED"
          : error.message === "LIMIT"
            ? "LIMIT"
            : "UNREADABLE",
    };
  } finally {
    await task.destroy();
    process.send(result, () => {
      process.disconnect();
      process.exit(0);
    });
  }
});
