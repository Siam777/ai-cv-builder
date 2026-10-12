import { chromium, type Page } from "playwright";
import type { ResumeDocument } from "../document";
import { exportToStandaloneHtml } from "../exporters/html-exporter";
import { layoutBlocks, paginateBlocks, type LayoutBlock } from "../layout";
import { pageCapacity } from "../resume-presentation";

export interface PdfRenderOptions {
  showWatermark?: boolean;
}

async function load(page: Page, html: string) {
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.decode().catch(() => {}),
      ),
    );
  });
}

async function withResumePage<T>(
  doc: ResumeDocument,
  options: PdfRenderOptions | undefined,
  output: (page: Page, html: string) => Promise<T>,
): Promise<T> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  const deadline = setTimeout(() => {
    void browser.close().catch(() => {});
  }, 45000);
  deadline.unref();
  try {
    const page = await browser.newPage({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(15000);
    await page.route("**/*", (route) => route.abort());
    await load(page, exportToStandaloneHtml(doc, options));
    // Only our self-contained pagination function is evaluated. Resume strings
    // stay structured arguments and escaped HTML; scripts/network remain disabled.
    const pages = await page.evaluate(
      ({ source, blocks, capacity }) => {
        const paginate = new Function(
          "__name",
          "blocks",
          "root",
          "capacity",
          `return (${source})(blocks, root, capacity)`,
        );
        return paginate(
          (fn: unknown) => fn,
          blocks,
          document.querySelector(".layout-measure .page-content"),
          capacity,
        ) as LayoutBlock[][];
      },
      {
        source: paginateBlocks.toString(),
        blocks: layoutBlocks(doc),
        capacity: pageCapacity(doc.presentation),
      },
    );
    const html = exportToStandaloneHtml(doc, { ...options, pages });
    await load(page, html);
    return await output(page, html);
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

export async function renderResumeHtml(
  doc: ResumeDocument,
  options?: PdfRenderOptions,
): Promise<string> {
  return withResumePage(doc, options, async (_page, html) => html);
}

export async function renderResumePdf(
  doc: ResumeDocument,
  options?: PdfRenderOptions,
): Promise<Uint8Array> {
  return withResumePage(doc, options, (page) =>
    page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    }),
  );
}
