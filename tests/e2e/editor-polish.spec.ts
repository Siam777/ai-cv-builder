import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startSampleResume } from "./helpers";
import { createDocument } from "../../src/lib/document";

for (const width of [360, 768, 1440]) {
  test(`toolbar menus, local fonts and readable controls at ${width}px`, async ({
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

    const toolbar = page.locator(".editor-toolbar");
    const cvMenu = page.getByRole("button", { name: "CV options", exact: true });
    await expect(cvMenu).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("menuitem", { name: /^Duplicate/ }),
    ).toBeHidden();
    await cvMenu.focus();
    await page.keyboard.press("Enter");
    await expect(cvMenu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menuitem", { name: /^Duplicate/ })).toBeVisible();
    // Arrow keys move through the menu; Escape returns to its button.
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /^Duplicate/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(cvMenu).toBeFocused();
    await expect(cvMenu).toHaveAttribute("aria-expanded", "false");

    const exportTrigger = toolbar.locator("summary");
    await expect(exportTrigger).toHaveText(/Download/);
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
      path: `test-results/editor-polish/${width}-toolbar.png`,
      fullPage: true,
    });
    const measurements = await toolbar.evaluate((el) =>
      Array.from(el.querySelectorAll("button, summary, select"))
        .filter((control) => control.getClientRects().length > 0)
        .map((control) => ({
          label: control.textContent?.trim() || control.getAttribute("aria-label"),
          height: control.getBoundingClientRect().height,
          size: parseFloat(getComputedStyle(control).fontSize),
        })),
    );
    expect(
      measurements.filter(
        (control) => control.height < 44 || control.size < 13,
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

async function checkDialogFocus(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  // A background control cannot take focus while the dialog is active.
  await page
    .getByRole("button", { name: "Account menu", exact: true })
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
  test.setTimeout(60000); // Eight dialogs in one acceptance flow.
  await page.goto("/builder");
  await startSampleResume(page);
  await page.getByLabel("Full name", { exact: true }).fill("Focus-check candidate");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  // [menu button or launcher, menu item (if any), dialog name]
  const dialogs: [string, string | null, string][] = [
    ["Account menu", "Keyboard shortcuts", "Keyboard Navigation & Actions"],
    ["Upgrade", null, "Subscription Pricing"],
    ["AI Assistant", "Match a job", "Job Tailoring Engine"],
    ["AI Assistant", "Cover letter", "Tailored Cover Letter Generator"],
    ["CV options", "History", "Resume Version History"],
    ["CV options", "Create practice example", "Create fictional practice CV"],
    ["CV options", "Demo examples", "Demo Resume Gallery"],
    ["Add section", null, "Add Section to Resume"],
  ];
  for (const [launcherName, item, dialogName] of dialogs) {
    const launcher = button(launcherName);
    await launcher.focus();
    await page.keyboard.press("Enter");
    if (item) {
      const option = page.getByRole("menuitem", { name: new RegExp(`^${item}`) });
      await option.focus();
      await page.keyboard.press("Enter");
    }
    const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
    await checkDialogFocus(page, dialog);
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Focus-check candidate");
  }
});

test("side panels dock beside the form, keep it usable and close with Escape", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  const preview = page.getByRole("region", { name: "Live preview" });
  await expect(preview).toBeVisible();

  const design = page.getByRole("button", { name: "Design", exact: true });
  await design.click();
  await expect(design).toHaveAttribute("aria-pressed", "true");
  const panel = page.getByRole("complementary", { name: "Design" });
  await expect(panel).toBeVisible();
  await expect(preview).toBeHidden();
  // The form stays editable while a panel is open.
  await page.getByLabel("Full name", { exact: true }).fill("Docked edit");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Docked edit");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(preview).toBeVisible();

  // Jumping to a finding keeps the Check panel open.
  await page.getByRole("button", { name: /^Check/ }).click();
  const check = page.getByRole("complementary", { name: "Check my CV" });
  await check.getByRole("button", { name: /^Fix:/ }).first().click();
  await expect(check).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".editor-panel")
        .evaluate((el) => el.contains(document.activeElement)),
    )
    .toBe(true);
  await check.getByRole("button", { name: "Close Check my CV" }).click();
  await expect(check).toBeHidden();
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
      .locator('[aria-current="step"]'),
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

test("undo and redo walk the edit history from the toolbar and keyboard", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  const name = page.getByLabel("Full name", { exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await expect(redo).toBeDisabled();
  await name.fill("First change");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(name).toHaveValue("Alex Morgan");
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(name).toHaveValue("First change");
  // Ctrl+Shift+Z redoes when focus is outside a text field.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Design", exact: true }).focus();
  await page.keyboard.press("Control+Shift+Z");
  await expect(name).toHaveValue("First change");
  // A new edit clears the redo history.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await name.fill("Second change");
  await expect(redo).toBeDisabled();
});
