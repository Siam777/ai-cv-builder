import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startSampleResume, openFirstCv } from "./helpers";

async function records(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("cv-builder", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const read = db.transaction("resumes").objectStore("resumes").getAll();
      return await new Promise<unknown[]>((resolve, reject) => {
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      });
    } finally {
      db.close();
    }
  });
}

for (const width of [360, 768, 1440]) {
  test(`public pages at ${width}px: working navigation, real previews and no draft writes`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const renderingErrors: string[] = [];
    page.on("pageerror", (error) => renderingErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|In HTML|cannot be a descendant/i.test(message.text())
      )
        renderingErrors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    const directory = `test-results/public-shell/${width}`;
    await mkdir(directory, { recursive: true });
    async function capture(state: string) {
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        state,
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `${directory}/${state}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Your experience. Clearly presented.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".document-library, .editor-toolbar, .editor-layout"),
    ).toHaveCount(0);
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    await capture("home-classic");
    await page
      .getByRole("group", { name: "Example design" })
      .getByRole("button", { name: "Modern", exact: true })
      .click();
    await expect(page.locator(".paginated-resume")).toHaveClass(
      /template-modern/,
    );
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    await capture("home-modern");
    if (width <= 900) {
      await page.getByText("Menu", { exact: true }).click();
      await capture("mobile-menu");
      await page
        .getByRole("navigation", { name: "Mobile public navigation" })
        .getByRole("link", { name: "Templates", exact: true })
        .click();
    } else
      await page
        .getByRole("navigation", { name: "Public navigation" })
        .getByRole("link", { name: "Templates", exact: true })
        .click();
    await expect(page).toHaveURL("/templates");
    await expect(page.getByRole("status")).toHaveText("12 designs");
    await capture("templates");
    await page
      .getByRole("group", { name: "Design categories" })
      .getByRole("button", { name: "Quiet & classic" })
      .click();
    await expect(page.getByRole("status")).toHaveText("4 designs");
    await page.getByLabel("Search designs").fill("No such design");
    await expect(
      page.getByRole("heading", { name: "No matches yet" }),
    ).toBeVisible();
    await capture("empty-filter");
    await page.getByRole("button", { name: "Show all designs" }).click();
    await page
      .getByRole("link", { name: "Preview Classic", exact: true })
      .click();
    await expect(page).toHaveURL("/templates/classic");
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    await capture("template-detail");
    await page.goto("/examples");
    await expect(page.getByRole("status")).toHaveText("12 examples");
    await capture("examples");
    await page.getByRole("link", { name: "Preview Alex Rowan" }).click();
    await expect(
      page.getByText("Demo · fictional content", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".paginated-resume")).toHaveAttribute(
      "data-pagination-ready",
      "true",
    );
    await capture("example-detail");
    // The application did not open a repository merely to browse public pages.
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).map((db) => db.name),
      ),
    ).not.toContain("cv-builder");
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: "Help", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Start, save, and export." }),
    ).toBeVisible();
    await capture("help");
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: "Data & privacy" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Know where your resume goes." }),
    ).toBeVisible();
    await capture("privacy");
    await page.goto("/templates/not-a-design");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await page.goto("/examples/not-an-example");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    expect(renderingErrors).toEqual([]);
  });
}

test("the landing route preserves existing IndexedDB drafts; explicit design starts stay blank and independent", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Existing draft · Zoë");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  const before = await records(page);
  await page.goto("/");
  await page
    .getByRole("link", { name: "Already have a draft? Open my CVs" })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  expect(await records(page)).toEqual(before);
  await openFirstCv(page);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Existing draft · Zoë",
  );
  await page.goto("/examples/siam-riaz");
  await page
    .getByRole("link", { name: "Use this design with my details" })
    .click();
  await expect(
    page.getByRole("region", { name: "Selected starting design" }),
  ).toContainText("Alex Rowan");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  expect(await records(page)).toEqual(before);
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  expect(await records(page)).toEqual(before);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `test-results/public-shell/${width}/selected-design.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "New CV" }).click();
  await expect(
    page.getByRole("region", { name: "Selected starting design" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start from scratch", exact: true })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(page.locator(".paginated-resume")).toHaveClass(/template-tech/);
  // The design choice leaves the address; the new CV is in it.
  await expect(page).toHaveURL(/\/builder\?cv=[^&]+$/);
  const after = (await records(page)) as Array<{
    id: string;
    sections: Array<{ entries: unknown[] }>;
    provenance: { purpose: string; exampleId?: string };
  }>;
  expect(after).toHaveLength(2);
  const original = before[0] as { id: string };
  expect(after.find((doc) => doc.id === original.id)).toEqual(before[0]);
  const blank = after.find((doc) => doc.id !== original.id)!;
  expect(blank.sections.every((section) => section.entries.length === 0)).toBe(
    true,
  );
  expect(blank.provenance).toMatchObject({
    purpose: "personal",
    exampleId: "siam-riaz",
  });
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  expect(await records(page)).toHaveLength(2);
});

test("design links are bounded; selection and cancellation never mutate existing CVs", async ({
  page,
}) => {
  await page.goto("/builder?template=made-up&example=foreign-id");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await expect(
    page.getByRole("region", { name: "Selected starting design" }),
  ).toHaveCount(0);
  expect(await records(page)).toHaveLength(0);
  await page.goto("/templates/modern");
  await page
    .getByRole("link", { name: "Use this design", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Selected starting design" }),
  ).toContainText("Modern");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  expect(await records(page)).toHaveLength(0);
  await page.getByRole("button", { name: "Clear design choice" }).click();
  await expect(page).toHaveURL("/builder");
  await page
    .getByRole("button", { name: "Start from scratch", exact: true })
    .click();
  await expect(page.locator(".paginated-resume")).toHaveClass(
    /template-classic/,
  );
});
