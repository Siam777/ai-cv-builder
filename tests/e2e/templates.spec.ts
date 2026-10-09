import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createDocument } from "../../src/lib/document";
import { layoutBlocks } from "../../src/lib/layout";
import { templates } from "../../src/lib/presentation";

async function ready(page: Page) {
  await expect(page.locator(".paginated-resume")).toHaveAttribute(
    "data-pagination-ready",
    "true",
  );
}
async function assertPages(page: Page, expectedText: string) {
  await ready(page);
  const text = await page
    .locator(".paginated-resume [data-block-text]")
    .allTextContents();
  expect(text.join("")).toBe(expectedText);
  const issues = await page.locator(".page-sheet").evaluateAll((sheets) =>
    sheets.flatMap((sheet, pageIndex) => {
      const content = sheet.querySelector(".page-content")!;
      const bounds = content.getBoundingClientRect();
      const blocks = [...content.children];
      const errors: string[] = [];
      if (!blocks.length) errors.push(`Empty page ${pageIndex + 1}`);
      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        if (rect.bottom > bounds.bottom + 1 || rect.right > bounds.right + 1)
          errors.push(`Overflow on page ${pageIndex + 1}: ${block.className}`);
      }
      if (blocks.at(-1)?.classList.contains("block-section"))
        errors.push(`Orphan heading on page ${pageIndex + 1}`);
      const last = blocks.at(-1) as HTMLElement | undefined;
      const next = sheets[pageIndex + 1]?.querySelector(".resume-block") as
        HTMLElement | undefined;
      if (
        last?.dataset.blockGroup &&
        last.dataset.blockGroup === next?.dataset.blockGroup &&
        (last.classList.contains("block-title") ||
          last.classList.contains("block-meta"))
      )
        errors.push(`Entry heading stranded on page ${pageIndex + 1}`);
      return errors;
    }),
  );
  expect(issues).toEqual([]);
}
async function exportPdf(
  page: Page,
  name: string,
  blocks: ReturnType<typeof layoutBlocks>,
) {
  await ready(page);
  const pageCount = await page.locator(".page-sheet").count();
  await page.pdf({
    path: `test-results/${name}.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });
  await writeFile(
    `test-results/${name}.json`,
    JSON.stringify({ pageCount, text: blocks.map((b) => b.text) }),
  );
}

test("print action waits for the current paginated document", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printed =
        document
          .querySelector(".paginated-resume")
          ?.getAttribute("data-pagination-ready") ?? "false";
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "true");
  await expect(page.locator(".alert")).toHaveCount(0);
});

for (const template of templates)
  test(`${template.name}: short and long pages, A4/Letter, density extremes`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const fixture = createDocument(true);
    fixture.contact.name = "Zoë Morgan";
    fixture.presentation.template = template.id;
    fixture.presentation.accent = template.id === "creative" ? "plum" : "navy";
    fixture.presentation.font = template.id === "classic" ? "serif" : "sans";
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page
      .getByLabel("Import JSON backup")
      .setInputFiles({
        name: "fixture.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixture)),
      });
    await page.getByRole("button", { name: "Restore as new" }).click();
    await page.getByRole("button", { name: "Design & templates" }).click();
    const expectedShort = layoutBlocks(fixture)
      .map((b) => b.text)
      .join("");
    for (const size of ["A4", "Letter"]) {
      await page.getByLabel("Page size").selectOption(size);
      await assertPages(page, expectedShort);
      await exportPdf(
        page,
        `${template.id}-short-${size}`,
        layoutBlocks(fixture),
      );
    }
    await page.screenshot({
      path: `test-results/${template.id}-gallery.png`,
      fullPage: true,
    });
    // A single oversized entry, a long unbroken URL, empty sections, and an accented name.
    fixture.contact.website = `https://example.com/${"portfolio".repeat(35)}`;
    fixture.sections[1].entries[0].description = Array.from(
      { length: 65 },
      (_, i) =>
        `Research note ${i + 1}: Collaborated with the team to document workflows and explain decisions clearly.`,
    ).join("\n");
    await page
      .getByLabel("Import JSON backup")
      .setInputFiles({
        name: "long.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixture)),
      });
    await page.getByRole("button", { name: "Replace active content" }).click();
    const expectedLong = layoutBlocks(fixture)
      .map((b) => b.text)
      .join("");
    for (const size of ["A4", "Letter"]) {
      await page.getByLabel("Page size").selectOption(size);
      for (const density of ["airy", "tight"]) {
        await page.getByLabel("Resume density").selectOption(density);
        await page
          .getByLabel("Resume text size")
          .selectOption(density === "airy" ? "12" : "10");
        await assertPages(page, expectedLong);
        expect(await page.locator(".page-sheet").count()).toBeGreaterThan(1);
        await exportPdf(
          page,
          `${template.id}-long-${size}-${density}`,
          layoutBlocks(fixture),
        );
      }
    }
    if (template.id === "creative") {
      await page.getByLabel("Colored side rail").uncheck();
      await assertPages(page, expectedLong);
      await expect(page.locator(".paginated-resume")).not.toHaveClass(
        /with-sidebar/,
      );
    }
  });

test("design switching persists without changing facts; hidden mobile editor paginates", async ({
  page,
}) => {
  const fixture = createDocument(true);
  fixture.contact.name = "নাদিয়া · Zoë";
  fixture.sections.reverse();
  fixture.sections[0].visible = false;
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page
    .getByLabel("Import JSON backup")
    .setInputFiles({
      name: "facts.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Restore as new" }).click();
  await page.getByRole("button", { name: "Design & templates" }).click();
  for (const template of templates) {
    await page
      .getByRole("button", { name: `${template.name} template`, exact: true })
      .click();
    await assertPages(
      page,
      layoutBlocks(fixture)
        .map((b) => b.text)
        .join(""),
    );
  }
  await page.getByLabel("Resume font").selectOption("humanist");
  for (const density of ["airy", "balanced", "compact", "tight"]) {
    await page.getByLabel("Resume density").selectOption(density);
    await assertPages(
      page,
      layoutBlocks(fixture)
        .map((b) => b.text)
        .join(""),
    );
  }
  await page.getByLabel("Accent color").selectOption("rust");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await page.getByRole("button", { name: "Design & templates" }).click();
  const lastTemplate = templates.at(-1)!;
  await expect(
    page.getByRole("button", { name: `${lastTemplate.name} template`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Resume font")).toHaveValue("humanist");
  await expect(page.getByLabel("Accent color")).toHaveValue("rust");
  await page.getByRole("button", { name: "Close design dialog" }).click();
  await page.locator("summary").click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Backup (.json)", exact: true })
    .click();
  const saved = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(saved.contact).toEqual(fixture.contact);
  expect(saved.sections).toEqual(fixture.sections);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Full name", { exact: true }).fill("Mobile edit");
  await ready(page);
  await page.getByRole("button", { name: "Preview resume" }).click();
  await expect(page.getByRole("article")).toContainText("Mobile edit");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/design-mobile.png",
    fullPage: true,
  });
});

test("RTL reading direction adjusts layout and preview styles", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await ready(page);

  // Default is LTR
  await expect(page.locator(".paginated-resume")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".paginated-resume")).not.toHaveClass(/rtl/);

  // Open Design & templates panel
  await page.getByRole("button", { name: "Design & templates" }).click();
  await expect(page.getByLabel("Reading direction")).toHaveValue("ltr");

  // Switch to RTL
  await page.getByLabel("Reading direction").selectOption("rtl");
  await ready(page);

  // Check preview attributes
  await expect(page.locator(".paginated-resume")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".paginated-resume")).toHaveClass(/rtl/);
  await expect(page.locator(".page-sheet").first()).toHaveAttribute("dir", "rtl");

  // Switch back to LTR
  await page.getByLabel("Reading direction").selectOption("ltr");
  await ready(page);
  await expect(page.locator(".paginated-resume")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".paginated-resume")).not.toHaveClass(/rtl/);
});
