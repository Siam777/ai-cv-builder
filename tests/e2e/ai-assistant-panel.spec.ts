import { expect, test, type Page } from "@playwright/test";
import { createDocument } from "../../src/lib/document";
import { editorTool, grantPaidPlan, startSampleResume } from "./helpers";

async function openExperience(page: Page) {
  await page.getByRole("button", { name: /Experience/ }).click();
}

function sparkle(page: Page, label: string) {
  return page.getByRole("button", { name: `AI help for ${label}`, exact: true });
}

function card(page: Page, label: string) {
  return page.getByRole("group", { name: `AI help for ${label}` });
}

test("sparkle menu is keyboard operable and Escape returns focus to it", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await openExperience(page);
  const trigger = sparkle(page, "Bullet 1").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const items = page.getByRole("menuitem");
  await expect(items).toHaveCount(6);
  await expect(items.nth(0)).toBeFocused();
  await expect(items.nth(0)).toContainText("Improve wording");
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await expect(items.nth(1)).toContainText("Shorten");
  await expect(items.nth(2)).toContainText("Continue writing");
  await expect(items.nth(3)).toContainText("Rewrite selection");
  await expect(items.nth(4)).toContainText("Add a result (you type it)");
  await expect(items.nth(5)).toContainText("Fix grammar");
  await page.keyboard.press("Escape");
  await expect(items).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Add a result shows an inline diff; Keep mine changes nothing; Accept applies it and Undo restores it", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await openExperience(page);
  const bullet = page.getByLabel("Bullet 1", { exact: true }).first();
  await bullet.fill("Prepared weekly support reports.");
  const help = card(page, "Bullet 1").first();

  await sparkle(page, "Bullet 1").first().click();
  await page.getByRole("menuitem", { name: /^Add a result/ }).click();
  const result = help.getByLabel("What was the real result?");
  await expect(result).toBeFocused();
  await expect(help.getByRole("button", { name: "Preview change" })).toBeDisabled();
  await result.fill("cutting prep time by 30%");
  await help.getByRole("button", { name: "Preview change" }).click();
  await expect(help).toContainText("Your wording");
  await expect(help).toContainText("Suggested");
  await expect(help.locator(".field-ai-text ins").first()).toContainText("30%");
  // The view never changes the bullet until it is accepted.
  await expect(bullet).toHaveValue("Prepared weekly support reports.");
  await expect(help.getByRole("button", { name: "Accept" })).toBeFocused();

  await help.getByRole("button", { name: "Keep mine" }).click();
  await expect(help).toHaveCount(0);
  await expect(bullet).toHaveValue("Prepared weekly support reports.");

  await sparkle(page, "Bullet 1").first().click();
  await page.getByRole("menuitem", { name: /^Add a result/ }).click();
  await help.getByLabel("What was the real result?").fill("cutting prep time by 30%");
  await page.keyboard.press("Enter");
  await help.getByRole("button", { name: "Accept" }).click();
  await expect(bullet).toHaveValue(/cutting prep time by 30%/);
  await expect(help).toContainText("Undo restores your previous wording");
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("cutting prep time by 30%");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(bullet).toHaveValue("Prepared weekly support reports.");
});

test("Escape dismisses a suggestion without applying it", async ({ page }) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await openExperience(page);
  const bullet = page.getByLabel("Bullet 1", { exact: true }).first();
  await bullet.fill("led the the team ,and shipped   the app");
  const help = card(page, "Bullet 1").first();
  await sparkle(page, "Bullet 1").first().click();
  await page.getByRole("menuitem", { name: /^Fix grammar/ }).click();
  await expect(help.locator(".field-ai-text ins").first()).toBeVisible();
  await expect(help.locator(".field-ai-text del").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(bullet).toHaveValue("led the the team ,and shipped   the app");
  // Escape closed the suggestion only; the page is still usable.
  await expect(bullet).toBeFocused();

  await sparkle(page, "Bullet 1").first().click();
  await page.getByRole("menuitem", { name: /^Fix grammar/ }).click();
  await help.getByRole("button", { name: "Accept" }).click();
  await expect(bullet).toHaveValue("Led the team, and shipped the app");

  // Nothing to fix says so instead of showing an empty change.
  await sparkle(page, "Bullet 1").first().click();
  await page.getByRole("menuitem", { name: /^Fix grammar/ }).click();
  await expect(help).toContainText("No spacing, capital or repeated-word fixes");
});

test("summary and skills have sparkle menus built from details already in the CV", async ({
  page,
}) => {
  await page.goto("/builder");
  const fixture = createDocument(true);
  fixture.contact.headline = "Product designer";
  const summary = fixture.sections.find((s) => s.type === "summary")!;
  summary.entries[0].description = "";
  fixture.sections.find((s) => s.type === "experience")!.entries[0].bullets[0].text =
    "Built a TypeScript component library for four teams.";
  await startSampleResume(page, fixture);

  await page.locator(".section-nav").getByRole("button", { name: /^Profile/ }).click();
  await sparkle(page, "Professional summary").click();
  // Write with AI, Show examples, Quick draft and Fix grammar.
  await expect(page.getByRole("menuitem")).toHaveCount(4);
  await page.getByRole("menuitem", { name: /^Quick draft/ }).click();
  const summaryHelp = card(page, "Professional summary");
  await expect(summaryHelp.getByRole("listitem")).toHaveCount(3);
  await summaryHelp
    .getByRole("button", { name: /^Preview draft: Results from your CV/ })
    .click();
  await summaryHelp.getByRole("button", { name: "Accept" }).click();
  await expect(
    page.getByRole("textbox", { name: "Professional summary" }),
  ).toHaveValue(/Experience:/);

  await page.locator(".section-nav").getByRole("button", { name: /^Skills/ }).click();
  await sparkle(page, "Skills").click();
  await page.getByRole("menuitem", { name: /^Add skills from my CV/ }).click();
  const skillsHelp = card(page, "Skills");
  await expect(skillsHelp).toContainText("TypeScript");
  await skillsHelp.getByRole("button", { name: "Keep mine" }).click();
  await expect(page.locator(".skill-chip", { hasText: "TypeScript" })).toHaveCount(0);
  await sparkle(page, "Skills").click();
  await page.getByRole("menuitem", { name: /^Add skills from my CV/ }).click();
  await skillsHelp.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator(".skill-chip", { hasText: "TypeScript" })).toHaveCount(1);
  // Listed skills are not suggested twice.
  await sparkle(page, "Skills").click();
  await page.getByRole("menuitem", { name: /^Add skills from my CV/ }).click();
  await expect(skillsHelp).toContainText("No new skills found");
});

test("the AI Assistant is one panel with three modes and the retired entry points are gone", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await openExperience(page);

  // One toggle button, not a menu of separate tools.
  const toggle = page.getByRole("button", { name: "AI Assistant", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  const panel = page.getByRole("complementary", { name: "AI Assistant" });
  await expect(panel).toBeVisible();
  const tabs = panel.getByRole("tab");
  await expect(tabs).toHaveText(["Help me finish", "Match a job", "Cover letter"]);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

  // Retired entry points: separate writing tools, bullet chips, review button, XYZ coach.
  for (const name of [
    "Rewrite a bullet",
    "Write a summary",
    "Add a real result",
    "Find skills",
  ])
    await expect(page.getByRole("tab", { name })).toHaveCount(0);
  for (const name of [
    "Improve this bullet",
    "Rewrite with AI",
    "Shorten with AI",
    "Review writing",
    "Writing help",
    "Writing tools",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByText("Impact Coach")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Arrow keys move between modes.
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("region", { name: "Job Tailoring Engine" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  // Cover letters are a Go and Pro feature; this guest is on Free.
  await expect(panel.getByRole("group", { name: "Locked: Cover letters" })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

  // Typed input survives a trip to another mode.
  await tabs.nth(1).click();
  await panel.getByLabel("Target Job Title").fill("Product Designer");
  await tabs.nth(2).click();
  await tabs.nth(1).click();
  await expect(panel.getByLabel("Target Job Title")).toHaveValue("Product Designer");

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("Help me finish jumps to the field and opens its sparkle action", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await editorTool(page, "Writing help");
  const panel = page.getByRole("complementary", { name: "AI Assistant" });
  const list = panel.getByRole("list", { name: "What to finish" });
  await expect(list.getByRole("listitem").first()).toContainText("Add a result to");
  await list.getByRole("button", { name: /^Add a result:/ }).first().click();
  // The editor moved to Experience and its field opened the result prompt.
  await expect(
    page.getByRole("heading", { name: "Experience", level: 2 }),
  ).toBeVisible();
  const prompt = page.getByLabel("What was the real result?");
  await expect(prompt).toBeVisible();
  await expect(prompt).toBeFocused();
  // The docked panel stays open beside the form on wide screens.
  await expect(panel).toBeVisible();
  await prompt.fill("saving the team 5 hours a week");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(panel.getByRole("list", { name: "What to finish" })).not.toContainText(
    "saving the team 5 hours a week",
  );
});

test("free plan shows tailored copies as locked and a paid plan unlocks them", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await editorTool(page, "Match a job");
  const tool = page.getByRole("region", { name: "Job Tailoring Engine" });
  await tool.getByLabel("Target Job Title").fill("Product Designer");
  await tool
    .getByLabel("Job Description", { exact: true })
    .fill("Required: Experience with prototyping");
  await tool.getByLabel("Use this target role, seniority and language").check();
  await tool.getByRole("button", { name: "Analyze & Match Evidence" }).click();
  await expect(
    tool.getByRole("region", { name: "Requirement coverage" }),
  ).toBeVisible();

  // The free comparison works; the saved copy is locked, with a reason and a way forward.
  const locked = tool.getByRole("group", { name: "Locked: tailored CV copies" });
  await expect(locked).toBeVisible();
  await expect(locked).toContainText("The comparison is free");
  await expect(locked).toContainText("part of Go and Pro");
  await expect(
    tool.getByRole("button", { name: "Create reviewed variant" }),
  ).toHaveCount(0);
  await locked.getByRole("button", { name: "See plans" }).click();
  await expect(
    page.getByRole("dialog", { name: "Subscription Pricing" }),
  ).toBeVisible();
});

test("a paid plan can create the tailored copy", async ({ page }) => {
  await grantPaidPlan(page);
  await page.goto("/builder");
  await startSampleResume(page);
  await editorTool(page, "Match a job");
  const tool = page.getByRole("region", { name: "Job Tailoring Engine" });
  await tool.getByLabel("Target Job Title").fill("Product Designer");
  await tool
    .getByLabel("Job Description", { exact: true })
    .fill("Required: Experience with prototyping");
  await tool.getByLabel("Use this target role, seniority and language").check();
  await tool.getByRole("button", { name: "Analyze & Match Evidence" }).click();
  await expect(
    tool.getByRole("region", { name: "Requirement coverage" }),
  ).toBeVisible();
  await expect(
    tool.getByRole("group", { name: "Locked: tailored CV copies" }),
  ).toHaveCount(0);
  await expect(
    tool.getByRole("button", { name: "Create reviewed variant" }),
  ).toBeVisible();
});

for (const width of [360, 768, 1440]) {
  test(`sparkle menu and AI panel fit and stay usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/builder");
    await startSampleResume(page);
    await openExperience(page);
    const trigger = sparkle(page, "Bullet 1").first();
    await trigger.scrollIntoViewIfNeeded();
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const menu = page.getByRole("menu", { name: "AI help for Bullet 1" });
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    for (const item of await page.getByRole("menuitem").all())
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");

    await editorTool(page, "Writing help");
    const sheet = width <= 900;
    const panel = page.getByRole(sheet ? "dialog" : "complementary", {
      name: "AI Assistant",
    });
    await expect(panel).toBeVisible();
    for (const tab of await panel.getByRole("tab").all())
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const button of await panel
      .getByRole("list", { name: "What to finish" })
      .getByRole("button")
      .all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/ai-assistant/panel-${width}.png`,
    });

    // From the panel to the field: a sheet gets out of the way.
    await panel
      .getByRole("list", { name: "What to finish" })
      .getByRole("button")
      .first()
      .click();
    await expect(page.getByLabel("What was the real result?")).toBeVisible();
    if (sheet) await expect(panel).toHaveCount(0);
    else await expect(panel).toBeVisible();
    await page.screenshot({
      path: `test-results/ai-assistant/field-${width}.png`,
    });
  });
}
