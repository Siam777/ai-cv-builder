import {
  test,
  expect,
  request as playwrightRequest,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import {
  authenticateForExport,
  editorTool,
  grantPaidPlan,
  openFirstCv,
  verifyTestEmail,
} from "./helpers";

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-account-password-42";

/** Signed in with a verified account CV open in the editor. */
async function accountCv(page: Page) {
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
async function api(
  page: Page,
  owner: string,
  path: string,
  data?: unknown,
  method = data ? "POST" : "GET",
) {
  const response = await page.request.fetch(path, {
    method,
    headers: { origin, "X-Workspace-User": owner },
    ...(data ? { data } : {}),
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
const today = (page: Page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

test("export → record as an application → stage → reminder due → frozen copy unchanged after an edit → delete", async ({
  page,
}) => {
  const { owner, doc } = await accountCv(page);
  const originalName = doc.contact.name as string;

  // Export a CV; the editor offers to record it.
  const downloading = page.waitForEvent("download");
  await page.locator(".export-menu summary").click();
  await page.getByRole("button", { name: "PDF Document (.pdf)" }).click();
  await downloading;
  const prompt = page.getByRole("region", { name: "Record this export" });
  await expect(prompt).toContainText("Record this as an application?");
  await prompt
    .getByRole("button", { name: "Record as an application" })
    .click();

  // The create form attaches the export's snapshot.
  await expect(page).toHaveURL(/\/applications$/);
  const form = page.getByRole("dialog", {
    name: "Record this as an application",
  });
  await expect(form).toContainText("Attaching:");
  await expect(form).toContainText("The copy you sent is kept as it was");
  await form.getByLabel("Company").fill("Synthetic Labs");
  await form.getByLabel("Role").fill("Product Designer");
  await form.getByRole("button", { name: "Save application" }).click();

  // Then: "Did you send it?" creates the submission.
  const sent = page.getByRole("dialog", { name: "Did you send it?" });
  // Saving runs create → freeze → reload; the first call to each route compiles
  // it on the e2e dev server, which can take more than 5 s under parallel load.
  await expect(sent).toBeVisible({ timeout: 20_000 });
  await sent.getByRole("button", { name: "Yes, I sent it" }).click();
  await expect(sent).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "marked as sent" }),
  ).toBeVisible();
  const applied = page.getByRole("region", { name: /^Applied/ });
  await expect(
    applied.getByRole("button", {
      name: "Open Product Designer at Synthetic Labs",
    }),
  ).toBeVisible();
  await expect(applied).toContainText("1 time");

  // Change the stage from the list.
  await page
    .getByLabel("Stage for Product Designer at Synthetic Labs")
    .selectOption("interview");
  await expect(page.getByRole("region", { name: /^Interview/ })).toContainText(
    "Synthetic Labs",
  );

  // Set a reminder for today in the detail panel; it shows under Due.
  await page
    .getByRole("button", { name: "Open Product Designer at Synthetic Labs" })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Product Designer at Synthetic Labs",
  });
  await detail.getByLabel("Reminder date").fill(await today(page));
  await detail.getByLabel("Next action").fill("Prepare portfolio walkthrough");
  await detail.getByRole("button", { name: "Save changes" }).click();
  await expect(detail.getByRole("status")).toHaveText("Changes saved.");
  await expect(
    detail.getByRole("list").filter({ hasText: "Saved → Applied" }),
  ).toBeVisible();
  await expect(detail).toContainText("Applied → Interview");
  await detail
    .getByRole("button", { name: "Close Product Designer at Synthetic Labs" })
    .click();
  const due = page.getByRole("region", { name: /^Due/ });
  await expect(due).toContainText("Due today");
  await expect(due).toContainText(
    "Prepare portfolio walkthrough · Product Designer at Synthetic Labs",
  );

  // The account menu shows the due count in the editor.
  await page.goto("/builder");
  await expect(
    page.getByRole("button", {
      name: "Account menu, 1 application reminder due",
    }),
  ).toBeVisible();

  // Edit the CV after the export; the frozen copy does not change.
  await openFirstCv(page);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Edited After Export");
  await expect(page.locator(".save-status").first()).toHaveText(
    "Saved to your account",
  );
  const stored = await api(page, owner.id, `/api/resumes/${doc.id}`);
  expect(stored.contact.name).toBe("Edited After Export");
  await page.goto("/applications");
  await page
    .getByRole("button", { name: "Open Product Designer at Synthetic Labs" })
    .click();
  await detail.getByRole("button", { name: /^View frozen copy/ }).click();
  const frozen = page.getByRole("region", { name: "Frozen CV" });
  await expect(frozen).toContainText(originalName);
  await expect(frozen).not.toContainText("Edited After Export");
  await page
    .getByRole("dialog", { name: /^Frozen copy/ })
    .getByRole("button", { name: "Close", exact: true })
    .click();

  // Delete the application and everything kept with it.
  await detail.getByRole("button", { name: "Delete application" }).click();
  await detail.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Application deleted." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No applications yet" }),
  ).toBeVisible();
  expect(await api(page, owner.id, "/api/applications")).toEqual([]);
});

test("Not now discards the export copy; Match a job saves the job to applications", async ({
  page,
}) => {
  const { owner } = await accountCv(page);
  const downloading = page.waitForEvent("download");
  await page.locator(".export-menu summary").click();
  await page.getByRole("button", { name: "Plain text (.txt)" }).click();
  await downloading;
  const prompt = page.getByRole("region", { name: "Record this export" });
  await prompt.getByRole("button", { name: "Not now" }).click();
  await expect(prompt).toBeHidden();
  const exported = await api(page, owner.id, "/api/account/export");
  await expect
    .poll(
      async () =>
        (await api(page, owner.id, "/api/account/export")).exportSnapshots
          .length,
    )
    .toBe(0);
  expect(exported.applications).toEqual([]);

  await editorTool(page, "Match a job");
  await page.getByLabel("Target Job Title").fill("Data Analyst");
  await page.getByLabel("Company Name").fill("Example Analytics");
  await page
    .getByLabel("Job Description", { exact: true })
    .fill("Requirements:\nSQL\nDashboards");
  await page
    .getByRole("button", { name: "Save this job to applications" })
    .click();
  const form = page.getByRole("dialog", { name: "Save this job" });
  await expect(form.getByLabel("Company")).toHaveValue("Example Analytics");
  await expect(form.getByLabel("Role")).toHaveValue("Data Analyst");
  await expect(form.getByLabel("Job post", { exact: true })).toHaveValue(
    "Requirements:\nSQL\nDashboards",
  );
  await form.getByRole("button", { name: "Save to applications" }).click();
  await expect(page.getByRole("region", { name: /^Saved/ })).toContainText(
    "Example Analytics",
  );
  const [saved] = await api(page, owner.id, "/api/applications");
  const detail = await api(page, owner.id, `/api/applications/${saved.id}`);
  expect(detail.jobPost).toBe("Requirements:\nSQL\nDashboards");

  // "Match my CV" opens the editor's Match a job tab with the post filled in.
  await page
    .getByRole("button", { name: "Open Data Analyst at Example Analytics" })
    .click();
  await page.getByRole("button", { name: "Match my CV" }).click();
  await expect(page).toHaveURL(/\/builder/);
  await openFirstCv(page);
  await expect(page.getByLabel("Target Job Title")).toHaveValue("Data Analyst");
  await expect(page.getByLabel("Company Name")).toHaveValue(
    "Example Analytics",
  );
  await expect(page.getByLabel("Job Description", { exact: true })).toHaveValue(
    "Requirements:\nSQL\nDashboards",
  );
});

test("the cover letter tool attaches the edited letter to an existing application", async ({
  page,
}) => {
  await grantPaidPlan(page);
  const { owner } = await accountCv(page);
  const existing = await api(page, owner.id, "/api/applications", {
    requestId: randomUUID(),
    company: "Letter Co",
    role: "Writer",
  });
  await editorTool(page, "Cover letter");
  await page.getByRole("button", { name: /Quick draft \(template\)/ }).click();
  await page
    .locator(".letterhead-editable-body")
    .fill("My edited letter, as I will send it.");
  await page.getByRole("button", { name: "Attach to an application" }).click();
  const form = page.getByRole("dialog", { name: "Attach this cover letter" });
  await expect(form).toContainText("as edited");
  await form
    .getByLabel("Attach to")
    .selectOption({ label: "Writer at Letter Co" });
  await form.getByRole("button", { name: "Attach", exact: true }).click();
  const sent = page.getByRole("dialog", { name: "Did you send it?" });
  // No CV is attached yet, so it cannot be marked as sent from here.
  await expect(sent).toContainText("Attach the CV you sent");
  await sent.getByRole("button", { name: "Not yet" }).click();
  const detail = await api(page, owner.id, `/api/applications/${existing.id}`);
  expect(detail.documents).toHaveLength(1);
  expect(detail.documents[0].kind).toBe("cover_letter");
  expect(detail.submissions).toHaveLength(0);
  const frozen = await api(
    page,
    owner.id,
    `/api/applications/${existing.id}/documents/${detail.documents[0].id}`,
  );
  expect(frozen.content.text).toBe("My edited letter, as I will send it.");
});

test("signed-out visitors get a sign-in prompt that returns to the tracker", async ({
  page,
}) => {
  const email = `tracker-${randomUUID()}@example.test`;
  const other = await playwrightRequest.newContext({ baseURL: origin });
  const created = await other.post("/api/auth", {
    headers: {
      origin,
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: { action: "signup", email, password },
  });
  expect(created.status(), await created.text()).toBe(200);
  await verifyTestEmail(other, email);
  await other.dispose();

  // Its own client address, so this sign-in does not use the shared local
  // sign-in rate-limit budget that other specs rely on (as helpers.ts does).
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
  });
  await page.goto("/applications");
  await expect(
    page.getByRole("heading", { name: "Sign in to track applications" }),
  ).toBeVisible();
  expect((await page.request.get("/api/applications")).status()).toBe(401);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\?return=%2Fapplications$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page
    .locator(".account-form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(
    page.getByRole("button", { name: "Add a job" }),
  ).toBeVisible();
});

test("the tracker is usable with the keyboard alone", async ({ page }) => {
  await page.goto("/builder");
  await authenticateForExport(page);
  await page.goto("/applications");
  const add = page.getByRole("button", { name: "Add a job" });
  await expect(add).toBeVisible();
  // Tab from the page start to Add a job.
  for (
    let i = 0;
    i < 20 && !(await add.evaluate((el) => el === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(add).toBeFocused();
  await page.keyboard.press("Enter");
  const form = page.getByRole("dialog", { name: "Add a job" });
  await expect(form).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Close Add a job" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(form.getByLabel("Job post", { exact: true })).toBeFocused();
  await page.keyboard.type("Support Engineer at Keyboard Co");
  await page.keyboard.press("Tab"); // Link to the post
  await page.keyboard.press("Tab");
  await expect(form.getByRole("button", { name: "Read the post" })).toBeFocused();
  await page.keyboard.press("Enter");
  // Focus moves to the review; the next field is the role.
  await page.keyboard.press("Tab");
  await expect(form.getByLabel("Role", { exact: true })).toBeFocused();
  await expect(form.getByLabel("Role", { exact: true })).toHaveValue("Support Engineer");
  await expect(form.getByLabel("Company", { exact: true })).toHaveValue("Keyboard Co");
  await page.keyboard.press("Enter"); // Submits the form.
  await expect(form).toBeHidden();
  const open = page.getByRole("button", {
    name: "Open Support Engineer at Keyboard Co",
  });
  await expect(open).toBeVisible();
  // The stage selector changes with arrow keys.
  const stage = page.getByLabel("Stage for Support Engineer at Keyboard Co");
  await stage.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("region", { name: /^Applied/ })).toContainText(
    "Keyboard Co",
  );
  // Open the detail panel, then Escape returns focus to the list.
  const reopened = page.getByRole("button", {
    name: "Open Support Engineer at Keyboard Co",
  });
  await reopened.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", {
    name: "Support Engineer at Keyboard Co",
  });
  await expect(detail.getByLabel("Company")).toHaveValue("Keyboard Co");
  await detail.getByLabel("Notes").focus();
  await page.keyboard.type("Typed with the keyboard");
  for (let i = 0; i < 80; i++) {
    if (
      await detail
        .getByRole("button", { name: "Save changes" })
        .evaluate((el) => el === document.activeElement)
    )
      break;
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  await expect(detail.getByRole("status")).toHaveText("Changes saved.");
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(reopened).toBeFocused();
});

test("the tracker works at 375 px wide", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/builder");
  const owner = await authenticateForExport(page);
  const nextAction = await today(page);
  await api(page, owner.id, "/api/applications", {
    requestId: randomUUID(),
    company: "Narrow Screen Ltd",
    role: "Mobile Developer",
    stage: "applied",
    appliedAt: nextAction,
    nextActionAt: nextAction,
    nextAction: "Call back",
  });
  await page.goto("/applications");
  await expect(page.getByRole("region", { name: /^Due/ })).toContainText(
    "Call back",
  );
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  // Rows become cards with their labels.
  const row = page
    .getByRole("region", { name: /^Applied/ })
    .locator("tbody tr")
    .first();
  expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe(
    "block",
  );
  const box = await page
    .getByLabel("Stage for Mobile Developer at Narrow Screen Ltd")
    .boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await page
    .getByRole("button", { name: "Open Mobile Developer at Narrow Screen Ltd" })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Mobile Developer at Narrow Screen Ltd",
  });
  await expect(detail.getByLabel("Company")).toHaveValue("Narrow Screen Ltd");
  const card = await detail.locator(".modal-card").boundingBox();
  expect(card!.width).toBeLessThanOrEqual(375);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await detail.getByRole("button", { name: "Add contact" }).click();
  await detail.getByLabel("Name", { exact: true }).fill("Robin Recruiter");
  await detail.getByRole("button", { name: "Save changes" }).click();
  await expect(detail.getByRole("status")).toHaveText("Changes saved.");
  await expect(
    detail.getByRole("group", { name: "Robin Recruiter" }),
  ).toBeVisible();
});
