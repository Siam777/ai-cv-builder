import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import { startSampleResume, openFirstCv, editorTool } from "./helpers";

test("guided start creates only supplied facts and retains them after reload", async ({
  page,
}) => {
  await page.goto("/builder");
  await page
    .getByRole("button", { name: "Help me start", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Start a CV with guidance" });
  await dialog
    .getByLabel("Full name", { exact: true })
    .fill("Fictional Guide Candidate");
  await dialog
    .getByLabel("Your role or professional headline")
    .fill("Support assistant");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel("Your job title").fill("Assistant");
  await dialog.getByLabel("Organization (optional)").fill("Example Team");
  await dialog
    .getByLabel("What did you do or learn?")
    .fill(
      "Prepared weekly support reports.\nHelped the team review open requests.",
    );
  await dialog.getByRole("button", { name: "Continue" }).click();
  const create = dialog.getByRole("button", { name: "Create my draft" });
  await expect(create).toBeDisabled();
  await dialog.getByLabel("These details describe my own experience.").check();
  await create.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Fictional Guide Candidate",
  );
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await page.reload();
  await openFirstCv(page);
  await page.getByRole("button", { name: /Experience/ }).click();
  await expect(page.getByLabel("Bullet 1", { exact: true })).toHaveValue(
    "Prepared weekly support reports.",
  );
  await expect(page.getByLabel("Bullet 2", { exact: true })).toHaveValue(
    "Helped the team review open requests.",
  );
});

test("photo errors are recoverable and uploading enables preview on a supported design", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  const input = page.getByLabel("Choose resume photo");
  await input.setInputFiles({
    name: "not-a-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("Invalid image"),
  });
  await expect(
    page.getByRole("region", { name: "Resume photo" }).getByRole("alert"),
  ).toContainText("could not be opened as a photo");
  await input.setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("Your resume photo")).toBeVisible();
  // The sample uses Classic, which cannot show a photo: say so instead of
  // claiming the photo was added.
  const warning = page.locator(".photo-design-warning");
  await expect(warning).toContainText(
    "Your current design (Classic) doesn't show photos.",
  );
  await expect(page.locator('[data-block-id="photo"]')).toHaveCount(0);
  await warning
    .getByRole("button", { name: "Switch to a photo design" })
    .click();
  const designs = page.getByRole("complementary", { name: "Design" });
  await expect(
    designs.getByRole("tab", { name: "Supports photo" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    designs.getByRole("button", { name: "Classic template" }),
  ).toHaveCount(0);
  await designs
    .getByRole("button", { name: "Modern template", exact: true })
    .click();
  await page.getByRole("button", { name: "Close Design" }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByText("Photo added. It shows on your CV preview.")).toBeVisible();
  await expect(page.locator('[data-block-id="photo"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(page.getByAltText("Your resume photo")).toHaveCount(0);
  await expect(page.locator('[data-block-id="photo"]')).toHaveCount(0);
});

for (const width of [360, 1440]) {
  test(`writing dialog scrolls, restores editing and routes the selected bullet at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 620 });
    await page.goto("/builder");
    await startSampleResume(page);
    await page.getByRole("button", { name: /Experience/ }).click();
    const bullet = page.getByLabel("Bullet 1", { exact: true }).first();
    await bullet.fill("Helped document the support team's weekly process.");
    const size = await bullet.evaluate((el) => ({
      input: el.clientWidth,
      row: el.closest(".bullet-field")!.clientWidth,
    }));
    expect(size.input / size.row).toBeGreaterThan(0.7);
    await page
      .getByRole("button", { name: "Improve this bullet", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Rewrite with AI", exact: true })
      .first()
      .click();
    // Docked beside the form on wide screens, a bottom sheet on phones.
    const dialog = page.locator("#side-panel");
    await expect(dialog.locator(".selected-bullet")).toHaveText(
      await bullet.inputValue(),
    );
    await expect(dialog).toContainText("sign in, explicitly copy this draft");
    await expect(
      dialog.getByRole("button", { name: "Sign in / Open account" }),
    ).toBeVisible();
    await dialog.getByRole("tab", { name: "Write a summary" }).click();
    await expect(dialog).toContainText("No AI request is made");
    const body = dialog.locator(".side-panel-body");
    // Long content scrolls inside the panel, never the page behind a sheet.
    if (await body.evaluate((el) => el.scrollHeight > el.clientHeight + 1)) {
      await body.hover();
      await page.mouse.wheel(0, 900);
      await expect
        .poll(() => body.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
    }
    await expect(
      dialog.getByRole("button", { name: "Close AI Assistant" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/usability/writing-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/modal-open/);
    await bullet.fill(
      "Helped document the support team's revised weekly process.",
    );
    await expect(bullet).toHaveValue(
      "Helped document the support team's revised weekly process.",
    );
  });
}

test("a pending AI suggestion can be closed without applying or locking the page", async ({
  page,
}) => {
  const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
  const response = await page.request.post("/api/auth", {
    headers: { origin, "x-forwarded-for": "192.0.2.198" },
    data: {
      action: "signup",
      email: `pending-${randomUUID()}@example.test`,
      password: "Synthetic-pending-password-42",
    },
  });
  expect(response.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const fixture = createDocument(true);
  const saved = await page.request.post("/api/resumes", {
    headers,
    data: { document: fixture, expectedRevision: null },
  });
  expect(saved.status()).toBe(200);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/api/ai", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, signedIn: true } });
    calls++;
    await pending;
    await route.abort().catch(() => {});
  });
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await editorTool(page, "Writing help");
    // Docked beside the form on wide screens, a bottom sheet on phones.
    const dialog = page.locator("#side-panel");
    await dialog
      .getByLabel("Send this evidence and instruction to OpenAI.")
      .check();
    await dialog.getByRole("button", { name: "Suggest a rewrite" }).click();
    await expect.poll(() => calls).toBe(1);
    await expect(dialog).toContainText("No change is applied automatically");
    await dialog.getByRole("button", { name: "Close AI Assistant" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/modal-open/);
    await expect(page.getByLabel("Full name", { exact: true })).toBeEnabled();
    const latest = await (
      await page.request.get(`/api/resumes/${fixture.id}`, { headers })
    ).json();
    expect(latest.revision).toBe(0);
  } finally {
    release();
  }
});

test("CV checker starts with actionable findings and job fields fit a small viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 620 });
  await page.goto("/builder");
  await startSampleResume(page);
  await page.getByRole("button", { name: /^Check/ }).click();
  // At this width the panel is a bottom sheet.
  const check = page.getByRole("dialog", { name: "Check my CV" });
  await expect(
    check.getByRole("tab", { name: /To fix/ }),
  ).toHaveAttribute("aria-selected", "true");
  await check.getByRole("button", { name: "Close Check my CV" }).click();
  await editorTool(page, "Match a job");
  const dialog = page.getByRole("dialog", { name: "Job Tailoring Engine" });
  await expect(dialog).toContainText("See what your CV supports");
  for (const label of ["Target Job Title", "Company Name"]) {
    const box = await dialog.getByLabel(label).boundingBox();
    expect(box!.width).toBeGreaterThan(240);
  }
  await page.screenshot({ path: "test-results/usability/job-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
});

test("a photo on Brand shows the design warning and keeping the design hides it", async ({
  page,
}) => {
  await page.goto("/builder");
  const fixture = createDocument(true);
  fixture.presentation.template = "bold";
  await startSampleResume(page, fixture);
  await page.getByLabel("Choose resume photo").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const warning = page.locator(".photo-design-warning");
  await expect(warning).toContainText(
    "Your current design (Brand) doesn't show photos.",
  );
  await expect(page.getByText("Photo added", { exact: false })).toHaveCount(0);
  await warning
    .getByRole("button", { name: "Keep design without photo" })
    .click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByText("Photo saved but hidden on your CV")).toBeVisible();
  await expect(page.locator('[data-block-id="photo"]')).toHaveCount(0);
});
