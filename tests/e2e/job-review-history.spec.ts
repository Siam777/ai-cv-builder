import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createDocument } from "../../src/lib/document";
import { reviewJobEvidence } from "../../src/lib/vault/job-evidence";
import { reviewSaveInput } from "../../src/lib/job-review-history";
import { authenticateForExport, openFirstCv, editorTool } from "./helpers";
const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
async function setup(page: Page) {
  await page.goto("/builder");
  const owner = await authenticateForExport(page);
  const fixture = createDocument(true);
  fixture.provenance = { purpose: "personal", origin: "import" };
  const response = await page.request.post("/api/resumes", {
    headers: { origin, "X-Workspace-User": owner.id },
    data: { document: fixture, expectedRevision: null },
  });
  expect(response.ok()).toBe(true);
  const doc = await response.json();
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "account"));
  await page.reload();
  await openFirstCv(page);
  return { owner, doc };
}
async function open(page: Page) {
  await editorTool(page, "Match a job");
}
async function analyze(page: Page) {
  await open(page);
  await page.getByLabel("Target Job Title").fill("Product Designer");
  await page
    .getByLabel("Job Description", { exact: true })
    .fill(
      "Requirements:\nExperience with prototyping\nFigma\n5 years of Figma",
    );
  await page.getByLabel("Use this target role, seniority and language").check();
  await page.getByRole("button", { name: "Analyze & Match Evidence" }).click();
  await expect(
    page.getByRole("region", { name: "Requirement coverage" }),
  ).toBeVisible();
}
const consent =
  "Save this posting and cited CV excerpts in my account until I delete them";

test("account history requires consent, survives reload, preserves priority overrides and becomes stale without changing the CV", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  const { owner, doc } = await setup(page);
  await analyze(page);
  const history = page.getByRole("region", { name: "Saved job reviews" });
  await expect(
    history.getByRole("button", { name: "Save job review", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", {
      name: "Priority for Experience with prototyping",
      exact: true,
    })
    .selectOption("preferred");
  await history.getByLabel(consent).check();
  await history
    .getByRole("button", { name: "Save job review", exact: true })
    .click();
  await expect(
    history.getByRole("button", { name: "Report saved", exact: true }),
  ).toBeDisabled();
  const list = await (
    await page.request.get(`/api/resumes/${doc.id}/job-reviews`, {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(list).toHaveLength(1);
  const current = await (
    await page.request.get(`/api/resumes/${doc.id}`, {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(current).toEqual(doc);
  await page.reload();
  await openFirstCv(page);
  await open(page);
  await page
    .getByRole("button", { name: "Open saved review for Product Designer" })
    .click();
  const detail = page.getByRole("article", { name: "Saved review detail" });
  await expect(detail).toContainText("Priority set by candidate review");
  await expect(detail).toContainText("Manual review");
  await expect(detail.getByRole("combobox")).toHaveCount(0);
  await detail.getByRole("button", { name: "Recheck this posting" }).click();
  await expect(page.getByLabel("Job Description", { exact: true })).toHaveValue(
    /Experience with prototyping/,
  );
  await expect(
    page.getByRole("button", { name: "Analyze & Match Evidence" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Later CV snapshot");
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  await open(page);
  await page
    .getByRole("button", { name: "Open saved review for Product Designer" })
    .click();
  await expect(detail).toContainText("Stale");
  await mkdir("test-results/job-history", { recursive: true });
  await detail.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/job-history/mobile-stale-review.png",
    fullPage: true,
  });
  const width = await page.getByRole("dialog").evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  const exported = await (
    await page.request.get("/api/account/export", {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(exported.jobReviews).toHaveLength(1);
  expect(exported.jobReviews[0].sourceRevision).toBe(0);
  expect(exported.jobReviews[0].sourceSnapshot).toBeUndefined();
  await detail.getByRole("button", { name: "Delete saved review" }).click();
  await expect(history).toContainText("No saved job reviews");
  const latest = await (
    await page.request.get(`/api/resumes/${doc.id}`, {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(latest.contact.name).toBe("Later CV snapshot");
  expect(latest.sections).toEqual(doc.sections);
});

test("history save recovers one committed record after a lost response and failed deletion keeps the report for retry", async ({
  page,
}) => {
  const { owner, doc } = await setup(page);
  await analyze(page);
  const history = page.getByRole("region", { name: "Saved job reviews" });
  const url = `**/api/resumes/${doc.id}/job-reviews`;
  const ids: string[] = [];
  let lose = true;
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    ids.push(route.request().postDataJSON().requestId);
    if (!lose) return route.continue();
    lose = false;
    const result = await route.fetch();
    expect(result.ok()).toBe(true);
    await route.abort("failed");
  });
  await history.getByLabel(consent).check();
  await history
    .getByRole("button", { name: "Save job review", exact: true })
    .click();
  await expect(history.getByRole("alert")).toContainText(
    "Could not reach account storage",
  );
  await history
    .getByRole("button", { name: "Save job review", exact: true })
    .click();
  await expect(
    history.getByRole("button", { name: "Report saved", exact: true }),
  ).toBeDisabled();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  const records = await (
    await page.request.get(`/api/resumes/${doc.id}/job-reviews`, {
      headers: { "X-Workspace-User": owner.id },
    })
  ).json();
  expect(records).toHaveLength(1);
  await history
    .getByRole("button", { name: "Open saved review for Product Designer" })
    .click();
  const detail = page.getByRole("article", { name: "Saved review detail" });
  const deleteUrl = `**/api/resumes/${doc.id}/job-reviews/${records[0].id}`;
  await page.route(deleteUrl, (route) =>
    route.request().method() === "DELETE" ? route.abort() : route.continue(),
  );
  await detail.getByRole("button", { name: "Delete saved review" }).click();
  await expect(history.getByRole("alert")).toContainText(
    "Could not reach account storage",
  );
  await expect(detail).toBeVisible();
  await page.unroute(deleteUrl);
  let loseDeletion = true;
  await page.route(deleteUrl, async (route) => {
    if (route.request().method() !== "DELETE" || !loseDeletion)
      return route.continue();
    loseDeletion = false;
    const result = await route.fetch();
    expect(result.ok()).toBe(true);
    await route.abort("failed");
  });
  await detail.getByRole("button", { name: "Delete saved review" }).click();
  await expect(history.getByRole("alert")).toContainText(
    "Could not reach account storage",
  );
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Delete saved review" }).click();
  await expect(history).toContainText("No saved job reviews");
});

test("failed history loading is not empty history and a delayed initial list cannot erase a newly saved record", async ({
  page,
}) => {
  const { doc } = await setup(page);
  const history = page.getByRole("region", { name: "Saved job reviews" });
  const url = `**/api/resumes/${doc.id}/job-reviews`;
  await page.route(url, (route) =>
    route.request().method() === "GET" ? route.abort() : route.continue(),
  );
  await open(page);
  await expect(history.getByRole("alert")).toContainText(
    "Could not reach account storage",
  );
  await expect(
    history.getByText("No saved job reviews for this CV.", { exact: true }),
  ).toHaveCount(0);
  await page.unroute(url);
  await history.getByRole("button", { name: "Refresh saved reviews" }).click();
  await expect(history).toContainText("No saved job reviews");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayedOnce = false;
  let completed!: () => void;
  const finished = new Promise<void>((resolve) => {
    completed = resolve;
  });
  await page.route(url, async (route) => {
    if (route.request().method() !== "GET" || delayedOnce)
      return route.continue();
    delayedOnce = true;
    const response = await route.fetch();
    await delayed;
    await route.fulfill({ response });
    completed();
  });
  await analyze(page);
  await expect.poll(() => delayedOnce).toBe(true);
  await history.getByLabel(consent).check();
  await history
    .getByRole("button", { name: "Save job review", exact: true })
    .click();
  await expect(
    history.getByRole("button", { name: "Report saved", exact: true }),
  ).toBeDisabled();
  await expect(
    history.getByRole("button", {
      name: "Open saved review for Product Designer",
    }),
  ).toBeVisible();
  release();
  await finished;
  await history
    .getByRole("button", { name: "Open saved review for Product Designer" })
    .click();
  await expect(
    page.getByRole("article", { name: "Saved review detail" }),
  ).toBeVisible();
  await expect(
    history.getByRole("button", {
      name: "Open saved review for Product Designer",
    }),
  ).toHaveCount(1);
});

test("history APIs enforce authentication, ownership, origin, canonical input, stale revisions and CV deletion", async ({
  page,
  browser,
}) => {
  const { owner, doc } = await setup(page);
  const review = await reviewJobEvidence(doc, "Required: Figma", {
    role: "Designer",
    company: "",
    seniority: "Senior",
    language: "english",
  });
  const input = reviewSaveInput(review, crypto.randomUUID());
  const path = `/api/resumes/${doc.id}/job-reviews`;
  const headers = { origin, "X-Workspace-User": owner.id };
  expect(
    (
      await page.request.post(path, {
        headers,
        data: { ...input, consent: false },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post(path, {
        headers: { ...headers, origin: "https://foreign.example" },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(path, {
        headers,
        data: { ...input, matches: [], groups: {} },
      })
    ).status(),
  ).toBe(400);
  const saved = await page.request.post(path, { headers, data: input });
  expect(saved.ok()).toBe(true);
  expect(saved.headers()["cache-control"]).toContain("no-store");
  const record = await saved.json();
  expect((await page.request.post(path, { headers, data: input })).ok()).toBe(
    true,
  );
  expect(await (await page.request.get(path, { headers })).json()).toHaveLength(
    1,
  );
  const context = await browser.newContext({ baseURL: origin });
  const other = await context.newPage();
  await other.goto("/builder");
  expect(
    (
      await other.request.get(path, {
        headers: { "X-Workspace-User": owner.id },
      })
    ).status(),
  ).toBe(401);
  const second = await authenticateForExport(other);
  const otherHeaders = { origin, "X-Workspace-User": second.id };
  for (const endpoint of [path, `${path}/${record.id}`])
    expect(
      (await other.request.get(endpoint, { headers: otherHeaders })).status(),
    ).toBe(404);
  expect(
    (
      await other.request.delete(`${path}/${record.id}`, {
        headers: otherHeaders,
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.request.post(path, {
        headers: otherHeaders,
        data: { ...input, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(path, {
        headers: { "X-Workspace-User": second.id },
      })
    ).status(),
  ).toBe(409);
  const change = await page.request.post("/api/resumes", {
    headers,
    data: {
      document: { ...doc, name: "A later revision" },
      expectedRevision: doc.revision,
    },
  });
  expect(change.ok()).toBe(true);
  expect(
    (
      await page.request.post(path, {
        headers,
        data: { ...input, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const detail = await (
    await page.request.get(`${path}/${record.id}`, { headers })
  ).json();
  expect(detail.stale).toBe(true);
  expect(
    (
      await page.request.delete(`${path}/${record.id}`, {
        headers: { ...headers, origin: "https://foreign.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.delete(`/api/resumes/${doc.id}`, {
        headers,
        data: { expectedRevision: 1 },
      })
    ).ok(),
  ).toBe(true);
  const exported = await (
    await page.request.get("/api/account/export", { headers })
  ).json();
  expect(exported.jobReviews).toEqual([]);
  await context.close();
});
