import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startSampleResume, openEditorTools } from "./helpers";
import { createDocument } from "../../src/lib/document";

for (const width of [360, 768, 1440]) {
  test(`toolbar disclosure, local fonts and readable controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1050 });
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontRequests.push(request.url());
    });
    await page.goto("/builder");
    await startSampleResume(page);
    await page.evaluate(() => document.fonts.ready);
    expect(fontRequests.length).toBeGreaterThanOrEqual(2);
    expect(
      fontRequests.every(
        (url) => new URL(url).origin === new URL(page.url()).origin,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).fontFamily.split(",")[0]),
    ).not.toMatch(/Arial|Helvetica/);

    const toolbar = page.locator(".document-toolbar");
    const more = page.getByRole("button", { name: "More tools", exact: true });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(
      toolbar.getByRole("button", { name: "Duplicate", exact: true }),
    ).toBeHidden();
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("group", { name: "Writing tools" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Duplicate", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");

    const exportTrigger = toolbar.locator("summary");
    await exportTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(
      toolbar.getByRole("button", { name: "Backup (.json)", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      toolbar.getByRole("button", { name: "PDF Document (.pdf)", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(exportTrigger).toBeFocused();
    await expect(toolbar.locator("details")).not.toHaveAttribute("open", "");
    await mkdir("test-results/editor-polish", { recursive: true });
    await page.screenshot({
      path: `test-results/editor-polish/${width}-collapsed.png`,
      fullPage: true,
    });
    await openEditorTools(page);
    const measurements = await toolbar.evaluate((el) =>
      Array.from(el.querySelectorAll("button, summary, select"))
        .filter((control) => control.getClientRects().length > 0)
        .map((control) => ({
          height: control.getBoundingClientRect().height,
          size: parseFloat(getComputedStyle(control).fontSize),
        })),
    );
    expect(
      measurements.every(
        (control) => control.height >= 44 && control.size >= 14,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/editor-polish/${width}-expanded.png`,
      fullPage: true,
    });
  });
}

async function checkDialogFocus(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  // A background control cannot take focus while the dialog is active.
  await page
    .getByRole("button", { name: "Account", exact: true })
    .evaluate((el) => (el as HTMLElement).focus());
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  const controls = dialog.locator(
    "button, a[href], input, select, textarea, summary, [tabindex]",
  );
  const visible = [];
  for (let index = 0; index < (await controls.count()); index++) {
    const control = controls.nth(index);
    if (
      (await control.isVisible()) &&
      (await control.isEnabled()) &&
      (await control.evaluate((el) => (el as HTMLElement).tabIndex >= 0))
    )
      visible.push(control);
  }
  expect(visible.length).toBeGreaterThan(0);
  await visible[0].focus();
  await page.keyboard.press("Shift+Tab");
  await expect(visible.at(-1)!).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(visible[0]).toBeFocused();
}

test("editor dialogs trap focus, close with Escape and restore their launching control", async ({
  page,
}) => {
  test.setTimeout(60000); // Ten dialogs plus the nested gallery in one acceptance flow.
  await page.goto("/builder");
  await startSampleResume(page);
  await page.getByLabel("Full name", { exact: true }).fill("Focus-check candidate");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await openEditorTools(page);
  const dialogs = [
    ["Design & templates", "Design & Templates"],
    ["Keyboard shortcuts", "Keyboard Navigation & Actions"],
    ["Upgrade", "Subscription Pricing"],
    ["Role Benchmark & Gaps", "Resume content review"],
    ["Tailor for job", "Job Tailoring Engine"],
    ["Cover letter", "Tailored Cover Letter Generator"],
    ["History", "Resume Version History"],
    ["Create practice example", "Create fictional practice CV"],
    ["Demo examples", "Demo Resume Gallery"],
    ["Add section", "Add Section to Resume"],
  ];
  for (const [buttonName, dialogName] of dialogs) {
    const launcher = page.getByRole("button", {
      name: buttonName,
      exact: true,
    });
    await launcher.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
    await checkDialogFocus(page, dialog);
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Focus-check candidate");
  }

  const design = page.getByRole("button", {
    name: "Design & templates",
    exact: true,
  });
  await design.click();
  const designDialog = page.getByRole("dialog", {
    name: "Design & Templates",
    exact: true,
  });
  const nestedLauncher = designDialog.getByRole("button", { name: /demo/i });
  await nestedLauncher.click();
  const gallery = page.getByRole("dialog", { name: "Demo Resume Gallery" });
  await checkDialogFocus(page, gallery);
  await page.keyboard.press("Escape");
  await expect(gallery).toBeHidden();
  await expect(designDialog).toBeVisible();
  await expect(nestedLauncher).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(design).toBeFocused();
});

test("keyboard preview navigation targets contact and entry fields with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/builder");
  await startSampleResume(page);
  for (const field of [
    "name",
    "headline",
    "email",
    "phone",
    "location",
    "website",
  ]) {
    const block = page
      .locator(`.preview-panel [data-block-id="${field}"]`)
      .first();
    await block.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`#contact-${field}`)).toBeFocused();
  }
  const entry = page.locator(".preview-panel .block-title").first();
  await entry.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page
        .locator(".editor-panel [data-entry-id]")
        .first()
        .evaluate((el) => el.contains(document.activeElement)),
    )
    .toBe(true);
  await expect(
    page
      .getByRole("complementary", { name: "Resume sections" })
      .locator('[aria-current="true"]'),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Skip to workspace" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-main")).toBeFocused();
});

test("import review keeps keyboard focus and cancellation preserves the original CV", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  const fixture = createDocument(true);
  fixture.contact.name = "Uncommitted replacement";
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const dialog = page.getByRole("dialog", { name: "Review imported resume" });
  await checkDialogFocus(page, dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
});
