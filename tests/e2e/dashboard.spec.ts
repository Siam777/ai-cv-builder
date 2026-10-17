import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createDocument, type ResumeDocument } from "../../src/lib/document";
import { authenticateForExport, openAccount } from "./helpers";

async function deviceDocuments(page: Page, write?: ResumeDocument[]) {
  return page.evaluate(
    async (documents) =>
      new Promise<ResumeDocument[]>((resolve, reject) => {
        const open = indexedDB.open("cv-builder", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            "resumes",
            documents ? "readwrite" : "readonly",
          );
          const store = tx.objectStore("resumes");
          documents?.forEach((doc) => store.put(doc));
          let result: ResumeDocument[] = [];
          const request = store.getAll();
          request.onsuccess = () => {
            result = request.result;
          };
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    write,
  );
}
async function library(page: Page, width = 1440) {
  // Narrow headers keep "My CVs" in the account menu.
  if (width <= 900) {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /^My CVs/ }).click();
  } else
    await page
      .locator(".header-nav")
      .getByRole("button", { name: "My CVs", exact: true })
      .click();
  await expect(page.getByRole("main", { name: "CV library" })).toBeVisible();
}
function personal(name: string) {
  const doc = createDocument(true);
  doc.name = name;
  doc.provenance = { purpose: "personal", origin: "import" };
  return doc;
}

for (const width of [360, 768, 1440]) {
  test(`dashboard and first draft at ${width}px: steps, persistence and mobile review`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const output = `test-results/dashboard/${width}`;
    await mkdir(output, { recursive: true });
    const captures: Array<{
      state: string;
      path: string;
      overflow: number;
      dialogOverflow: number;
      clippedControls: string[];
    }> = [];
    async function capture(name: string) {
      const dimensions = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        dialogOverflow: Math.max(
          0,
          ...Array.from(
            document.querySelectorAll<HTMLElement>(
              '[role="dialog"] .modal-card, [role="dialog"].modal-card',
            ),
          ).map((element) => element.scrollWidth - element.clientWidth),
        ),
        clippedControls: Array.from(
          document.querySelectorAll<HTMLElement>(
            ".library-card-actions button, .step-footer button, .mobile-tabs button",
          ),
        )
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.width > 0 &&
              (bounds.left < -1 || bounds.right > innerWidth + 1)
            );
          })
          .map((element) => element.textContent?.trim() || element.tagName),
      }));
      expect(dimensions.overflow, name).toBeLessThanOrEqual(1);
      expect(dimensions.dialogOverflow, name).toBeLessThanOrEqual(1);
      expect(dimensions.clippedControls, name).toEqual([]);
      const path = `${output}/${name}.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push({ state: name, path, ...dimensions });
      await writeFile(
        `${output}/manifest.json`,
        JSON.stringify({ width, records: captures }, null, 2),
      );
    }
    await page.goto("/builder");
    await expect(page.locator(".save-status")).toHaveText(
      "Saved in this browser",
    );
    await capture("empty");
    await page
      .getByRole("button", { name: "Start from scratch", exact: true })
      .click();
    await expect(page.getByLabel("CV name", { exact: true })).toHaveValue(
      "Untitled resume",
    );
    // The badge counts findings to fix, not sections not started yet.
    await expect(page.getByRole("button", { name: /^Check/ })).toHaveAccessibleName(
      /^Check \d+ to fix$/,
    );
    await capture("start");
    if (width > 520) {
      // The strength card points to the first missing item.
      await page.getByRole("button", { name: /^Suggested: Add your name/ }).click();
      await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();
    }
    await page
      .getByLabel("Full name", { exact: true })
      .fill("Synthetic candidate · Zoë");
    await page
      .getByLabel("CV name", { exact: true })
      .fill("Graduate — platform engineer");
    // Back and Next walk through the steps and move focus to the new step.
    await page.getByRole("button", { name: "Next: Profile", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Resume editor" }),
    ).toBeFocused();
    await expect(
      page.getByRole("region", { name: "Resume editor" }),
    ).toContainText("Profile");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Resume editor" }),
    ).toContainText("Personal details");
    await expect(page.locator(".save-status")).toHaveText(
      "Saved in this browser",
    );
    await capture("editor");
    if (width <= 900) {
      await page
        .getByRole("button", { name: "Preview resume", exact: true })
        .click();
      await expect(page.locator(".paginated-resume")).toHaveAttribute(
        "data-pagination-ready",
        "true",
      );
      await expect(page.locator(".save-status")).toHaveText(
        "Saved in this browser",
      );
      await capture("preview");
    }
    await page.getByRole("button", { name: /^Check/ }).click();
    await expect(page.locator("#side-panel")).toHaveAccessibleName(
      "Check my CV",
    );
    await capture("review");
    await page.getByRole("button", { name: "Close Check my CV" }).click();
    await library(page, width);
    await expect(
      page.getByRole("heading", { name: "My CVs", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".library-preview .page-content")).toContainText(
      "Synthetic candidate · Zoë",
    );
    await capture("own-draft");
    await page.getByRole("searchbox").fill("No such candidate");
    await expect(
      page.getByRole("heading", { name: "No matching CVs" }),
    ).toBeVisible();
    await capture("empty-search");
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    const records = await deviceDocuments(page);
    expect(records).toHaveLength(1);
    expect(
      records[0].sections.every((section) => section.entries.length === 0),
    ).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Open CV", exact: true }).click();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
      "Synthetic candidate · Zoë",
    );
    await expect(page.getByLabel("CV name", { exact: true })).toHaveValue(
      "Graduate — platform engineer",
    );
  });
}

test("dashboard sorting, duplicate independence, delete cancellation and collection isolation", async ({
  page,
}) => {
  await page.goto("/builder");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  const alpha = personal("Alpha");
  alpha.updatedAt = "2026-10-09T10:00:00.000Z";
  const zeta = personal("Zeta");
  zeta.updatedAt = "2026-10-10T10:00:00.000Z";
  zeta.presentation.pageSize = "Letter";
  zeta.presentation.template = "modern";
  const practice = createDocument(true);
  practice.name = "Fictional practice";
  await deviceDocuments(page, [alpha, zeta, practice]);
  await page.reload();
  await expect(page.locator(".library-card-content > h3").first()).toHaveText(
    "Zeta",
  );
  await page.screenshot({
    path: "test-results/dashboard/1440/filled-gallery.png",
    fullPage: true,
  });
  await page.getByLabel("Sort CVs").selectOption("name");
  await expect(page.locator(".library-card-content > h3").first()).toHaveText(
    "Alpha",
  );
  const original = (await deviceDocuments(page)).find(
    (doc) => doc.id === alpha.id,
  )!;
  await page
    .getByRole("article", { name: "Alpha", exact: true })
    .getByRole("button", { name: "Duplicate CV" })
    .click();
  await expect(page.getByLabel("CV name")).toHaveValue("Alpha — copy");
  await page.getByLabel("Full name", { exact: true }).fill("Independent copy");
  await library(page);
  expect(
    (await deviceDocuments(page)).find((doc) => doc.id === alpha.id),
  ).toEqual(original);
  const copy = page.getByRole("article", { name: "Alpha — copy", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await copy.getByRole("button", { name: "Delete CV" }).click();
  await expect(copy).toBeVisible();
  expect(await deviceDocuments(page)).toHaveLength(4);
  page.once("dialog", (dialog) => dialog.accept());
  await copy.getByRole("button", { name: "Delete CV" }).click();
  await expect(copy).toHaveCount(0);
  expect(await deviceDocuments(page)).toHaveLength(3);
  await page
    .getByRole("navigation", { name: "Document collections" })
    .getByRole("button", { name: /Practice copies/ })
    .click();
  await page.getByRole("button", { name: "Duplicate CV", exact: true }).click();
  const all = await deviceDocuments(page);
  expect(
    all.filter((doc) => doc.provenance.purpose === "personal"),
  ).toHaveLength(2);
  expect(
    all.filter((doc) => doc.provenance.purpose === "practice"),
  ).toHaveLength(2);
});

test("a stale dashboard cannot delete a newer revision; duplication reads the latest saved facts", async ({
  page,
}) => {
  await page.goto("/builder");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  const source = personal("Concurrent draft");
  await deviceDocuments(page, [source]);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Concurrent draft" }),
  ).toBeVisible();
  const newer = {
    ...source,
    revision: source.revision + 1,
    contact: { ...source.contact, name: "Newer saved identity" },
  };
  await deviceDocuments(page, [newer]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete CV", exact: true }).click();
  await expect(page.locator(".alert")).toContainText("changed in another tab");
  expect(await deviceDocuments(page)).toEqual([newer]);
  await page.getByRole("button", { name: "Duplicate CV", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Newer saved identity",
  );
  expect(
    (await deviceDocuments(page)).find((doc) => doc.id === source.id),
  ).toEqual(newer);
});

test("account dashboard duplicate/delete affect account CVs and preserve independent device originals", async ({
  page,
}) => {
  await page.goto("/builder");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  const device = personal("Device original");
  await deviceDocuments(page, [device]);
  const deviceBefore = await deviceDocuments(page);
  const user = await authenticateForExport(page);
  await openAccount(page);
  await page.getByRole("button", { name: "Open my account CVs" }).click();
  await page.getByRole("button", { name: "Close account settings" }).click();
  await page
    .getByRole("button", { name: "Start from scratch", exact: true })
    .click();
  await page.getByLabel("CV name").fill("Account original");
  await library(page);
  const requestOptions = { headers: { "X-Workspace-User": user.id } };
  const before = (await (
    await page.request.get("/api/resumes", requestOptions)
  ).json()) as ResumeDocument[];
  expect(before).toHaveLength(1);
  await page.getByRole("button", { name: "Duplicate CV", exact: true }).click();
  await expect(page.getByLabel("CV name")).toHaveValue(
    "Account original — copy",
  );
  await library(page);
  await page
    .getByRole("article", { name: "Account original — copy", exact: true })
    .getByRole("button", { name: "Delete CV" })
    .click();
  await expect(page.locator(".library-card")).toHaveCount(1);
  expect(
    await (await page.request.get("/api/resumes", requestOptions)).json(),
  ).toEqual(before);
  expect(await deviceDocuments(page)).toEqual(deviceBefore);
});
