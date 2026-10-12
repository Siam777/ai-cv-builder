import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { designSample } from "../../src/lib/public-catalog";
import { layoutBlocks } from "../../src/lib/layout";
import { authenticateForExport } from "./helpers";
import type { Presentation } from "../../src/lib/presentation";
import { TEMPLATE_RENDER_VERSION } from "../../src/lib/resume-presentation";

test("photo policy, mirrored sidebar and oversized metadata preserve text in authenticated exports", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/templates");
  const owner = await authenticateForExport(page);
  const cases = [
    {
      template: "creative",
      direction: "rtl",
      sidebar: true,
      showPhoto: true,
      pageSize: "A4",
    },
    {
      template: "creative",
      direction: "ltr",
      sidebar: false,
      showPhoto: false,
      pageSize: "Letter",
    },
    {
      template: "timeline",
      direction: "rtl",
      sidebar: false,
      showPhoto: true,
      pageSize: "A4",
    },
    {
      template: "classic",
      direction: "ltr",
      sidebar: false,
      showPhoto: true,
      pageSize: "Letter",
    },
  ] as const;
  for (const [index, settings] of cases.entries()) {
    const doc = designSample(settings.template);
    doc.provenance = { purpose: "personal", origin: "import" };
    doc.presentation = { ...doc.presentation, ...settings } as Presentation;
    doc.contact.photoUrl =
      "data:image/svg+xml," +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#dbe5eb'/><circle cx='50' cy='40' r='20' fill='#526473'/></svg>",
      );
    if (index === 0)
      doc.contact.website = `https://example.com/${"portfolio".repeat(240)}`;
    if (index === 2)
      doc.sections[1].entries[0].organization = Array.from(
        { length: 220 },
        (_, i) => `Fictional division ${i + 1}`,
      ).join(" ");
    const headers = {
      origin: process.env.E2E_ORIGIN || "http://localhost:3100",
      "X-Workspace-User": owner.id,
    };
    const source = {
      storage: "device",
      document: doc,
      processingConsent: true,
    };
    const response = await page.request.post("/api/exports", {
      headers,
      data: { kind: "resume", source, format: "html" },
    });
    expect(response.status(), response.ok() ? "" : await response.text()).toBe(
      200,
    );
    await page.setContent(await response.text());
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) => image.decode()),
      );
    });
    const blocks = layoutBlocks(doc).filter((block) => block.kind !== "photo");
    expect(
      (
        await page
          .locator(".paginated-resume [data-block-text]")
          .allTextContents()
      ).join(""),
    ).toBe(blocks.map((block) => block.text).join(""));
    await expect(page.locator(".paginated-resume .block-photo")).toHaveCount(
      index === 0 || index === 2 ? 1 : 0,
    );
    const errors = await page.locator(".page-content").evaluateAll((contents) =>
      contents.flatMap((content) => {
        const bounds = content.getBoundingClientRect();
        return Array.from(content.children)
          .filter(
            (child) =>
              child.getBoundingClientRect().bottom > bounds.bottom + 1 ||
              child.getBoundingClientRect().right > bounds.right + 1 ||
              child.getBoundingClientRect().left < bounds.left - 1,
          )
          .map((child) => child.className);
      }),
    );
    expect(errors).toEqual([]);
    const pdf = await page.request.post("/api/exports", {
      headers,
      data: { kind: "resume", source, format: "pdf" },
    });
    expect(pdf.status(), pdf.ok() ? "" : await pdf.text()).toBe(200);
    const prefix = `test-results/server-stress-${settings.template}-${index}-${settings.pageSize}`;
    await writeFile(`${prefix}.pdf`, await pdf.body());
    await writeFile(
      `${prefix}.json`,
      JSON.stringify({
        pageCount: await page.locator(".page-sheet").count(),
        templateVersion: TEMPLATE_RENDER_VERSION,
        text: blocks.map((block) => block.text),
      }),
    );
  }
});
