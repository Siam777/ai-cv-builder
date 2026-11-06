import { test, expect, type Page } from "@playwright/test";
import { createDocument } from "../../src/lib/document";
import {
  authenticateForExport,
  editorTool,
  grantProAccount,
  openFirstCv,
} from "./helpers";

// Job capture phase B: Add a job, read by AI. Every AI reply here is controlled test data.
test.describe.configure({ timeout: 90_000 });
const origin = process.env.E2E_ORIGIN || "http://localhost:3100";

const POST = `Data Analyst at Northwind Traders
Location: Berlin, Germany
Hybrid, full-time. We offer €60,000 – €75,000 per year.

Requirements:
- 3+ years of SQL
- Building dashboards in Tableau
- Ten years of banking experience

Nice to have:
- dbt experience

Benefits:
- Free tea`;

/** Signed in (verified) with one personal account CV in the account workspace. */
async function accountCv(page: Page, consent = false) {
  await page.goto("/builder");
  const owner = await authenticateForExport(page);
  const headers = { origin, "X-Workspace-User": owner.id };
  const fixture = createDocument(true);
  fixture.provenance = { purpose: "personal", origin: "import" };
  const response = await page.request.post("/api/resumes", {
    headers,
    data: { document: fixture, expectedRevision: null },
  });
  expect(response.ok()).toBe(true);
  if (consent)
    expect(
      (
        await page.request.patch("/api/account", {
          headers,
          data: { aiWritingHelp: true },
        })
      ).ok(),
    ).toBe(true);
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "account"));
  return { owner, headers, doc: await response.json() };
}
async function api(page: Page, headers: Record<string, string>, path: string) {
  const response = await page.request.get(path, { headers });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function openAddJob(page: Page) {
  await page.goto("/applications");
  await page.getByRole("button", { name: "Add a job" }).click();
  return page.getByRole("dialog", { name: "Add a job" });
}

test("paste → Read the post → edit and move a requirement → save → Match my CV sends the kept requirements", async ({
  page,
}) => {
  const { owner, headers } = await accountCv(page, true);
  await grantProAccount(owner.id);
  const form = await openAddJob(page);
  const post = form.getByLabel("Job post", { exact: true });
  await post.fill(POST);
  await expect(
    form.getByText(`${[...POST].length} / 30,000 characters`),
  ).toBeVisible();
  await form.getByRole("button", { name: "Read the post" }).click();
  await expect(
    form.getByRole("status").filter({ hasText: "Nothing was sent" }),
  ).toBeVisible();
  await expect(form.getByLabel("Role", { exact: true })).toHaveValue(
    "Data Analyst",
  );
  await expect(form.getByLabel("Company", { exact: true })).toHaveValue(
    "Northwind Traders",
  );
  await expect(form.getByLabel("Work type")).toHaveValue("hybrid");
  await expect(
    form
      .getByText("From the post: “Data Analyst at Northwind Traders”")
      .first(),
  ).toBeVisible();
  // Edit a field: its quote disappears, because the value is now the person's own.
  await form.getByLabel("Location", { exact: true }).fill("Berlin");
  await expect(
    form.getByText("From the post: “Location: Berlin, Germany”"),
  ).toHaveCount(0);
  // Requirements: move one to nice, delete one.
  const must = form.getByRole("region", { name: /^Must have/ });
  await expect(must.getByRole("listitem")).toHaveCount(3);
  await form
    .getByRole("button", {
      name: "Move “Building dashboards in Tableau” to Nice to have",
    })
    .click();
  await form
    .getByRole("button", { name: "Remove “Ten years of banking experience”" })
    .click();
  const nice = form.getByRole("region", { name: /^Nice to have/ });
  await expect(nice.getByRole("listitem")).toHaveCount(2);
  await expect(
    form.getByText("Used for matching", { exact: true }),
  ).toHaveCount(3);
  await form.getByRole("button", { name: "Save to applications" }).click();
  await expect(page.getByRole("region", { name: /^Saved/ })).toContainText(
    "Northwind Traders",
  );

  const [saved] = await api(page, headers, "/api/applications");
  const detail = await api(page, headers, `/api/applications/${saved.id}`);
  expect(detail.capturedVia).toBe("paste");
  expect(detail.location).toBe("Berlin · Hybrid");
  expect(detail.employmentType).toBe("full-time");
  expect(detail.salaryText).toBe("€60,000 – €75,000 per year");
  expect(detail.jobPost).toBe(POST);
  expect(
    detail.requirements.map((r: { text: string; kind: string }) => [
      r.text,
      r.kind,
    ]),
  ).toEqual([
    ["3+ years of SQL", "must"],
    ["dbt experience", "nice"],
    ["Building dashboards in Tableau", "nice"],
  ]);

  // Match my CV: the editor's Match a job is pre-filled and Match with AI sends the kept requirements.
  await page.route("**/api/ai", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true, signedIn: true } })
      : route.fallback(),
  );
  let matchBody: Record<string, unknown> | null = null;
  await page.route("**/api/ai/job-match", async (route) => {
    const body = route.request().postDataJSON();
    matchBody = body;
    await route.fulfill({
      json: {
        requestId: body.requestId,
        withheld: 0,
        requirements: body.requirements.map(
          (r: { id: string; text: string; priority: string }) => ({
            ...r,
            status: "gap",
            evidence: [],
          }),
        ),
      },
    });
  });
  await page
    .getByRole("button", { name: "Open Data Analyst at Northwind Traders" })
    .click();
  await page.getByRole("button", { name: "Match my CV" }).click();
  await expect(page).toHaveURL(/\/builder/);
  await openFirstCv(page);
  const panel = page.getByRole("complementary", { name: "AI Assistant" });
  await expect(panel.getByLabel("Target Job Title")).toHaveValue(
    "Data Analyst",
  );
  await expect(panel.getByLabel("Company Name")).toHaveValue(
    "Northwind Traders",
  );
  await expect(
    panel.getByLabel("Job Description", { exact: true }),
  ).toHaveValue(POST);
  await expect(panel.getByTestId("given-requirements")).toContainText(
    "Uses the 3 requirements you reviewed",
  );
  await panel.getByRole("button", { name: "Match with AI" }).click();
  const turnOn = panel.getByRole("button", { name: "Turn on AI writing help" });
  if (await turnOn.isVisible().catch(() => false)) await turnOn.click();
  await expect.poll(() => matchBody).not.toBeNull();
  expect(
    (matchBody as unknown as { requirements: unknown[] }).requirements,
  ).toEqual([
    { id: "req-1", text: "3+ years of SQL", priority: "required" },
    { id: "req-2", text: "dbt experience", priority: "preferred" },
    {
      id: "req-3",
      text: "Building dashboards in Tableau",
      priority: "preferred",
    },
  ]);
});

test("Read with AI shows the request cost and every value with its words; a field the post does not support stays empty", async ({
  page,
}) => {
  await accountCv(page, true);
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/ai/job-read", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      json: {
        requestId: (sent as { requestId: string }).requestId,
        source: "ai",
        fields: {
          role: {
            value: "Data Analyst",
            quote: "Data Analyst at Northwind Traders",
          },
          workType: { value: "hybrid", quote: "Hybrid, full-time." },
        },
        requirements: [
          {
            id: "requirement-1",
            text: "3+ years of SQL",
            kind: "must",
            quote: "3+ years of SQL",
            paraphrased: false,
          },
          {
            id: "requirement-2",
            text: "Free tea",
            kind: "unstated",
            quote: "Free tea",
            paraphrased: false,
          },
        ],
        withheld: 2,
      },
    });
  });
  const form = await openAddJob(page);
  await form.getByLabel("Job post", { exact: true }).fill(POST);
  await form
    .getByLabel("Link to the post (optional)")
    .fill("https://jobs.example.test/1");
  await expect(
    form.getByText(
      /Read with AI uses 1 AI request and sends only the post and the link/,
    ),
  ).toBeVisible();
  await form.getByRole("button", { name: "Read with AI" }).click();
  await expect(
    form.getByRole("status").filter({ hasText: "2 values were left out" }),
  ).toBeVisible();
  expect(sent).toMatchObject({
    post: POST,
    url: "https://jobs.example.test/1",
  });
  expect(Object.keys(sent!).sort()).toEqual(["post", "requestId", "url"]);
  await expect(form.getByLabel("Role", { exact: true })).toHaveValue(
    "Data Analyst",
  );
  await expect(form.getByLabel("Company", { exact: true })).toHaveValue("");
  await expect(
    form.getByText("From the post: “Hybrid, full-time.”"),
  ).toBeVisible();
  // A Not stated item must be decided before saving.
  await form.getByLabel("Company", { exact: true }).fill("Northwind Traders");
  await form.getByRole("button", { name: "Save to applications" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "Choose Must have or Nice to have for 1 requirement",
  );
  await form.getByRole("button", { name: "Remove “Free tea”" }).click();
  await form.getByRole("button", { name: "Save to applications" }).click();
  await expect(page.getByRole("region", { name: /^Saved/ })).toContainText(
    "Northwind Traders",
  );
});

test("Read with AI through the real route and server checks (synthetic provider)", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_OPENAI !== "1",
    "Needs the opt-in synthetic OpenAI transport (E2E_OPENAI=1).",
  );
  await accountCv(page, true);
  const form = await openAddJob(page);
  await form.getByLabel("Job post", { exact: true }).fill(POST);
  await form.getByRole("button", { name: "Read with AI" }).click();
  // The synthetic model invents a company and a requirement and mislabels must/nice: the server corrects it.
  await expect(
    form.getByRole("status").filter({ hasText: "left out" }),
  ).toBeVisible();
  await expect(form.getByLabel("Role", { exact: true })).toHaveValue(
    "Data Analyst",
  );
  await expect(form.getByLabel("Company", { exact: true })).toHaveValue("");
  const must = form.getByRole("region", { name: /^Must have/ });
  await expect(must).toContainText("3+ years of SQL");
  await expect(form.getByText("Kubernetes")).toHaveCount(0);
});

test("a guest sees only the free local pass, and the draft survives signing in", async ({
  page,
}) => {
  await page.goto("/applications");
  await expect(
    page.getByRole("heading", { name: "Sign in to track applications" }),
  ).toBeVisible();
  const guest = page.getByRole("region", { name: "Try reading a job post" });
  await expect(guest.getByRole("button", { name: "Read with AI" })).toHaveCount(
    0,
  );
  await expect(guest.getByText("Sign in to use Read with AI")).toBeVisible();
  let calls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/ai")) calls++;
  });
  await guest.getByLabel("Job post", { exact: true }).fill(POST);
  await guest.getByRole("button", { name: "Read the post" }).click();
  await expect(guest.getByLabel("Role", { exact: true })).toHaveValue(
    "Data Analyst",
  );
  await expect(
    guest.getByRole("region", { name: /^Must have/ }).getByRole("listitem"),
  ).toHaveCount(3);
  expect(calls).toBe(0);
  await guest.getByRole("button", { name: "Sign in to save" }).click();
  await expect(page).toHaveURL(
    /\/profile\?return=%2Fapplications%3Ffrom%3Djob$/,
  );
});

test("the Add a job form works with the keyboard alone", async ({ page }) => {
  await accountCv(page);
  await page.goto("/applications");
  const add = page.getByRole("button", { name: "Add a job" });
  await add.focus();
  await page.keyboard.press("Enter");
  const form = page.getByRole("dialog", { name: "Add a job" });
  await page.keyboard.press("Tab");
  await expect(form.getByLabel("Job post", { exact: true })).toBeFocused();
  await page.keyboard.insertText(POST);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    form.getByRole("button", { name: "Read the post" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(form.getByLabel("Role", { exact: true })).toHaveValue(
    "Data Analyst",
  );
  // Reorder by keyboard: focus stays on the moved item.
  const down = form.getByRole("button", {
    name: "Move “3+ years of SQL” down",
  });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect(down).toBeFocused();
  const must = form.getByRole("region", { name: /^Must have/ });
  await expect(must.getByRole("listitem").first()).toContainText(
    "Building dashboards in Tableau",
  );
  // Remove by keyboard, then save with Enter on the submit button.
  const remove = form.getByRole("button", {
    name: "Remove “Ten years of banking experience”",
  });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(must.getByText("Ten years of banking experience")).toHaveCount(
    0,
  );
  await expect(must.getByRole("listitem")).toHaveCount(2);
  await form.getByRole("button", { name: "Save to applications" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: /^Saved/ })).toContainText(
    "Northwind Traders",
  );
});

test("the Add a job form fits 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await accountCv(page);
  const form = await openAddJob(page);
  await form.getByLabel("Job post", { exact: true }).fill(POST);
  await form.getByRole("button", { name: "Read the post" }).click();
  await expect(form.getByLabel("Role", { exact: true })).toHaveValue(
    "Data Analyst",
  );
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  const card = await form.locator(".modal-card").boundingBox();
  expect(card!.width).toBeLessThanOrEqual(375);
  for (const name of [
    "Move “3+ years of SQL” down",
    "Remove “dbt experience”",
    "Save to applications",
  ]) {
    const box = await form.getByRole("button", { name }).boundingBox();
    expect(box!.x + box!.width, name).toBeLessThanOrEqual(375);
  }
  await form.getByRole("button", { name: "Save to applications" }).click();
  await expect(page.getByRole("region", { name: /^Saved/ })).toContainText(
    "Northwind Traders",
  );
});
