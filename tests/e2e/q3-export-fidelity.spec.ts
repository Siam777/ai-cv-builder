import { test, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { DEMO_PROFILES } from "../../src/lib/demo-resumes";
import { layoutBlocks } from "../../src/lib/layout";
import { authenticateForExport } from "./helpers";

test("twelve fictional starters preserve facts through isolated public previews and authenticated exports", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/examples");
  const owner = await authenticateForExport(page);
  await mkdir("test-results/q3-starters", { recursive: true });
  for (const [index, profile] of DEMO_PROFILES.entries()) {
    await page.goto(`/examples/${profile.id}`);
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: "Annotated rewrite", exact: true }),
    ).toBeVisible();
    const doc = profile.create();
    const preview = await page
      .locator(".paginated-resume [data-block-text]")
      .allTextContents();
    expect(preview.join("")).toBe(
      layoutBlocks(doc)
        .filter((b) => b.kind !== "photo")
        .map((b) => b.text)
        .join(""),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).map((db) => db.name),
      ),
    ).not.toContain("cv-builder");
    doc.presentation.font = (["sans", "serif", "humanist"] as const)[index % 3];
    if (index === 0) doc.contact.name += " · Zoë García";
    if (index === 3) doc.presentation.direction = "rtl";
    if (index === 8) doc.contact.website = "javascript:alert('sample')";
    const source = {
      storage: "device",
      document: doc,
      processingConsent: true,
    };
    const headers = {
      origin: process.env.E2E_ORIGIN || "http://localhost:3100",
      "X-Workspace-User": owner.id,
    };
    const htmlResponse = await page.request.post("/api/exports", {
      headers,
      data: { kind: "resume", source, format: "html" },
    });
    expect(
      htmlResponse.status(),
      htmlResponse.ok() ? "" : await htmlResponse.text(),
    ).toBe(200);
    const html = await htmlResponse.text();
    expect(html).not.toMatch(/<script|href="javascript:/);
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const pageCount = await page.locator(".page-sheet").count();
    const clipped = await page
      .locator(".page-content")
      .evaluateAll((contents) =>
        contents.flatMap((content) => {
          const bounds = content.getBoundingClientRect();
          return Array.from(content.children)
            .filter(
              (child) =>
                child.getBoundingClientRect().bottom > bounds.bottom + 1 ||
                child.getBoundingClientRect().right > bounds.right + 1,
            )
            .map((child) => child.className);
        }),
      );
    expect(clipped).toEqual([]);
    await page.screenshot({
      path: `test-results/q3-starters/${profile.id}.png`,
      fullPage: true,
    });
    const pdf = await page.request.post("/api/exports", {
      headers,
      data: { kind: "resume", source, format: "pdf" },
    });
    expect(pdf.status(), pdf.ok() ? "" : await pdf.text()).toBe(200);
    await writeFile(
      `test-results/server-starter-${profile.id}.pdf`,
      await pdf.body(),
    );
    // The export intentionally labels fictional practice documents in the file.
    doc.contact.headline = `Fictional practice CV · ${doc.contact.headline}`;
    await writeFile(
      `test-results/server-starter-${profile.id}.json`,
      JSON.stringify({
        pageCount,
        text: layoutBlocks(doc)
          .filter((b) => b.kind !== "photo")
          .map((b) => b.text),
      }),
    );
  }
});
