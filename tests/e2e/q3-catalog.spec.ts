import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { designSample, publicDesigns } from "../../src/lib/public-catalog";
import { letterDocument } from "../../src/lib/letter-layout";
import { layoutBlocks } from "../../src/lib/layout";
import { authenticateForExport } from "./helpers";

for (const width of [360, 1440]) {
  test(`Q3 catalog at ${width}px: filters, comparison and short/long/letter samples stay isolated`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await mkdir(`test-results/q3-catalog/${width}`, { recursive: true });
    async function capture(name: string) {
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `test-results/q3-catalog/${width}/${name}.png`,
        fullPage: true,
      });
    }
    await page.goto("/templates");
    await page
      .getByRole("combobox", { name: "Columns", exact: true })
      .selectOption("Sidebar");
    await expect(page.getByRole("status")).toHaveText("1 design");
    await page
      .getByRole("combobox", { name: "Export format", exact: true })
      .selectOption("Word");
    await expect(page.getByRole("status")).toHaveText("1 design");
    await page
      .getByRole("combobox", { name: "Career stage", exact: true })
      .selectOption("Leadership");
    await page
      .getByRole("combobox", { name: "Sample length", exact: true })
      .selectOption("long");
    await capture("sidebar-filter");
    await page.getByLabel("Search designs").fill("no match");
    await page.getByRole("button", { name: "Show all designs" }).click();
    await expect(page.getByRole("status")).toHaveText("12 designs");
    await page
      .getByRole("button", { name: "Compare two designs", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "First design", exact: true })
      .selectOption("creative");
    await page
      .getByRole("combobox", { name: "Second design", exact: true })
      .selectOption("timeline");
    await expect(
      page.locator(
        "#design-comparison .paginated-resume[data-pagination-ready=true]",
      ),
    ).toHaveCount(2);
    const previews = page.locator("#design-comparison .paginated-resume");
    expect(
      (
        await previews.nth(0).locator("[data-block-text]").allTextContents()
      ).join(""),
    ).toBe(
      (
        await previews.nth(1).locator("[data-block-text]").allTextContents()
      ).join(""),
    );
    await capture("comparison");
    await page.goto("/templates/creative");
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    const shortPages = await page.locator(".page-sheet").count();
    await page
      .getByRole("button", { name: "Long resume", exact: true })
      .click();
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    expect(await page.locator(".page-sheet").count()).toBeGreaterThan(
      shortPages,
    );
    await capture("long-detail");
    await page
      .getByRole("button", { name: "Matching letterhead", exact: true })
      .click();
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    await expect(page.locator(".paginated-resume")).toContainText(
      "Fictional letter example",
    );
    await expect(page.locator(".paginated-resume")).not.toContainText(
      "Senior Product Designer",
    );
    await capture("letterhead-detail");
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).map((db) => db.name),
      ),
    ).not.toContain("cv-builder");
  });
}

test("reviewed letters use all twelve matching designs through the authorized print boundary", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/templates");
  const owner = await authenticateForExport(page);
  for (const [index, design] of publicDesigns.entries()) {
    const doc = designSample(design.id);
    doc.provenance = { purpose: "personal", origin: "import" };
    doc.presentation.pageSize = "Letter";
    const body =
      `Reviewed letter ${index + 1}\n\nDear hiring team,\n\n` +
      Array.from(
        { length: index === 3 ? 36 : 2 },
        (_, n) =>
          `Paragraph ${n + 1}: This is only the reviewed letter body, with literal <script> text and supported experience.`,
      ).join("\n\n") +
      "\n\nKind regards,\nAlex Morgan";
    const response = await page.request.post("/api/exports", {
      headers: {
        origin: process.env.E2E_ORIGIN || "http://localhost:3100",
        "X-Workspace-User": owner.id,
      },
      data: {
        kind: "letter",
        source: { storage: "device", document: doc, processingConsent: true },
        format: "print",
        text: body,
        name: "Reviewed letter",
      },
    });
    expect(response.status(), response.ok() ? "" : await response.text()).toBe(
      200,
    );
    const html = await response.text();
    expect(html).not.toContain("<script>");
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const expected = layoutBlocks(letterDocument(doc, body)).map(
      (block) => block.text,
    );
    expect(
      (
        await page
          .locator(".paginated-resume [data-block-text]")
          .allTextContents()
      ).join(""),
    ).toBe(expected.join(""));
    const overflow = await page
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
    expect(overflow).toEqual([]);
    const prefix = `test-results/server-letter-${design.id}-Letter`;
    await page.pdf({
      path: `${prefix}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await writeFile(
      `${prefix}.json`,
      JSON.stringify({
        pageCount: await page.locator(".page-sheet").count(),
        text: expected,
      }),
    );
  }
});
