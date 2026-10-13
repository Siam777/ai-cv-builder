import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createDocument, type ResumeDocument } from "../../src/lib/document";
import {
  startSampleResume,
  openFirstCv,
  authenticateForExport,
  editorTool, cvCount } from "./helpers";

async function savedDocuments(page: Page): Promise<ResumeDocument[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("cv-builder", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("resumes");
          const read = tx.objectStore("resumes").getAll();
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
          read.onerror = () => reject(read.error);
        };
        request.onerror = () => reject(request.error);
      }),
  ) as Promise<ResumeDocument[]>;
}
async function openReview(
  page: Page,
  posting = "Required: Experience with prototyping",
  language = "english",
) {
  await editorTool(page, "Match a job");
  await page.getByLabel("Target Job Title").fill("Product Designer");
  await page.getByLabel("Analysis language").selectOption(language);
  await page.getByLabel("Job Description", { exact: true }).fill(posting);
  await page.getByLabel("Use this target role, seniority and language").check();
  await page.getByRole("button", { name: "Analyze & Match Evidence" }).click();
  await expect(
    page.getByRole("region", { name: "Requirement coverage" }),
  ).toBeVisible();
}
async function accept(page: Page) {
  await page
    .getByLabel("Accept ordering for Product Designer", { exact: true })
    .check();
  await page
    .getByLabel(
      "I reviewed the job priorities and CV excerpts supporting the selected changes",
    )
    .check();
}

test("mobile review exposes sources, OR and partial evidence; priority edits reset acceptance and repeated creation preserves facts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto("/builder");
  await startSampleResume(page);
  const original = (await savedDocuments(page))[0];
  let aiCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/ai")) aiCalls++;
  });
  await openReview(
    page,
    "Requirements:\n• Experience with prototyping\n• AWS or Azure\n• Figma\n• 5 years of Figma",
  );
  await expect(
    page.getByRole("region", { name: "Job criteria and CV excerpts" }),
  ).toContainText("Alternatives: aws OR azure");
  await expect(
    page.getByRole("region", { name: "Job criteria and CV excerpts" }),
  ).toContainText("Partial / related");
  await expect(
    page.getByRole("region", { name: "Job criteria and CV excerpts" }),
  ).toContainText("Manual review");
  await accept(page);
  await page
    .getByRole("combobox", {
      name: "Priority for Experience with prototyping",
      exact: true,
    })
    .selectOption("preferred");
  await expect(
    page.getByLabel("Accept ordering for Product Designer", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Create reviewed variant" }),
  ).toBeDisabled();
  await accept(page);
  await page
    .getByLabel("Accept ordering for Product Designer", { exact: true })
    .uncheck();
  await expect(
    page.getByLabel(
      "I reviewed the job priorities and CV excerpts supporting the selected changes",
    ),
  ).not.toBeChecked();
  await accept(page);
  await mkdir("test-results/job-evidence", { recursive: true });
  await page.screenshot({
    path: "test-results/job-evidence/mobile-review.png",
    fullPage: true,
  });
  const overflow = await page.getByRole("dialog").evaluate((dialog) => ({
    scroll: dialog.scrollWidth,
    width: dialog.clientWidth,
    content: dialog.querySelector(".tailor-content")!.scrollWidth,
    contentWidth: dialog.querySelector(".tailor-content")!.clientWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1);
  expect(overflow.content).toBeLessThanOrEqual(overflow.contentWidth + 1);
  await page
    .getByRole("button", { name: "Create reviewed variant" })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => cvCount(page)).toBe(2);
  const docs = await savedDocuments(page);
  expect(docs.find((doc) => doc.id === original.id)).toEqual(original);
  const variant = docs.find((doc) => doc.id !== original.id)!;
  expect(variant.contact).toEqual(original.contact);
  expect(variant.presentation).toEqual(original.presentation);
  expect(variant.provenance).toEqual(original.provenance);
  const normalized = structuredClone(variant);
  normalized.id = original.id;
  normalized.name = original.name;
  normalized.updatedAt = original.updatedAt;
  normalized.revision = original.revision;
  const experience = normalized.sections.find(
    (section) => section.type === "experience",
  )!;
  const reordered = experience.entries.find(
    (entry) => entry.title === "Product Designer",
  )!;
  expect(reordered.bullets[0].text).toContain("prototypes");
  reordered.bullets.reverse();
  expect(normalized).toEqual(original);
  expect(aiCalls).toBe(0);
});

test("review rejects a source changed in another tab without saving a variant and keeps retry data", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await openReview(page);
  await accept(page);
  const other = await page.context().newPage();
  await other.goto("/builder");
  await openFirstCv(other);
  await other
    .getByLabel("Full name", { exact: true })
    .fill("A later source revision");
  await expect(other.locator(".save-status")).toHaveText(
    "Saved in this browser",
  );
  await page.getByRole("button", { name: "Create reviewed variant" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Saving was not confirmed",
  );
  await expect(
    page.getByLabel("Accept ordering for Product Designer", { exact: true }),
  ).toBeChecked();
  const docs = await savedDocuments(page);
  expect(docs).toHaveLength(1);
  expect(docs[0].contact.name).toBe("A later source revision");
  await other.close();
});

test("manual language and unscorable input never invent zero scores or an applicable proposal", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  const original = await savedDocuments(page);
  await openReview(page, "Required: Experience with prototyping", "other");
  await expect(
    page.getByRole("region", { name: "Requirement coverage" }),
  ).toContainText("Not enough information");
  await expect(
    page.getByRole("region", { name: "Proposed ordering changes" }),
  ).toContainText("No supported ordering change");
  await expect(
    page.getByRole("button", { name: "Create reviewed variant" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit Job Description" }).click();
  await page.getByLabel("Analysis language").selectOption("english");
  await page
    .getByLabel("Job Description", { exact: true })
    .fill("A welcoming team that values good collaboration.");
  await page.getByLabel("Use this target role, seniority and language").check();
  await page.getByRole("button", { name: "Analyze & Match Evidence" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "no explicit criteria were recognized",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  expect(await savedDocuments(page)).toEqual(original);
});

test("undo cannot delete later edits to a reviewed variant", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await openReview(page);
  await accept(page);
  await page.getByRole("button", { name: "Create reviewed variant" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("My newer variant edits");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await page
    .getByRole("button", { name: "Undo reviewed variant creation" })
    .click();
  await expect(page.locator(".alert[role=alert]")).toContainText(
    "variant has been edited",
  );
  const docs = await savedDocuments(page);
  expect(docs).toHaveLength(2);
  expect(
    docs.some((doc) => doc.contact.name === "My newer variant edits"),
  ).toBe(true);
});

test("a lost account-save response retries the same variant once, preserves the source and supports cloud undo", async ({
  page,
}) => {
  await page.goto("/builder");
  const owner = await authenticateForExport(page);
  const source = createDocument(true);
  source.provenance = { purpose: "personal", origin: "import" };
  const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
  const response = await page.request.post("/api/resumes", {
    headers: { origin, "X-Workspace-User": owner.id },
    data: { document: source, expectedRevision: null },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const original = await response.json();
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "account"));
  await page.reload();
  await openFirstCv(page);
  await openReview(page);
  await accept(page);
  const submittedIds: string[] = [];
  await page.route("**/api/resumes", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submittedIds.push(route.request().postDataJSON().document.id);
    const committed = await route.fetch();
    expect(committed.ok()).toBe(true);
    await route.abort("failed"); // The server committed, but its response never reaches the editor.
  });
  await page.getByRole("button", { name: "Create reviewed variant" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Saving was not confirmed",
  );
  const saved = await (
    await page.request.get("/api/resumes", {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(saved).toHaveLength(2);
  await page.getByRole("button", { name: "Create reviewed variant" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => cvCount(page)).toBe(2);
  expect(submittedIds).toHaveLength(1);
  await page.unroute("**/api/resumes");
  await page
    .getByRole("button", { name: "Undo reviewed variant creation" })
    .click();
  await expect.poll(() => cvCount(page)).toBe(1);
  const after = await (
    await page.request.get("/api/resumes", {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(after).toEqual([original]);
  expect(await savedDocuments(page)).toHaveLength(0);
});
