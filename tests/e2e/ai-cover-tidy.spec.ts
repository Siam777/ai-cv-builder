import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument, newEntry, type ResumeDocument } from "../../src/lib/document";
import { editorTool, openFirstCv } from "./helpers";

// These flows walk several steps against a dev server.
test.describe.configure({ timeout: 90_000 });

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-AI-phase-d-password-42";

/** A real account (Go during the beta) with one saved CV; AI reported as ready. */
async function accountWithCv(page: Page) {
  const signup = await page.request.post("/api/auth", {
    headers: { origin, "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}` },
    data: { action: "signup", email: `ai-d-${randomUUID()}@example.test`, password },
  });
  expect(signup.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const doc: ResumeDocument = await (
    await page.request.post("/api/resumes", { headers, data: { document: createDocument(true), expectedRevision: null } })
  ).json();
  await page.route("**/api/ai", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true, signedIn: true } })
      : route.fallback(),
  );
  return {
    doc,
    headers,
    cleanup: () =>
      page.request.delete("/api/account", { headers, data: { password, confirmation: "DELETE MY ACCOUNT" } }),
  };
}

test("Write with AI fills the editable cover letter from the CV and the person's note; the template stays a quick draft", async ({
  page,
}) => {
  const { cleanup } = await accountWithCv(page);
  const sent: Record<string, unknown>[] = [];
  // Controlled test data, not model output.
  await page.route("**/api/ai/cover-letter", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    await route.fulfill({
      json: {
        requestId: body.requestId,
        message: "",
        withheld: 1,
        paragraphs: [
          "I am applying for the Product Designer role at Contoso, whose planning app I use every week.",
          "At Northstar Studio I built a shared component library with engineering.",
          "Thank you for considering my application.",
        ],
      },
    });
  });
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await editorTool(page, "Cover letter");
    const panel = page.getByRole("complementary", { name: "AI Assistant" });
    await panel.getByLabel("Target Role Title").fill("Product Designer");
    await panel.getByLabel("Company Name").fill("Contoso");
    await panel.getByLabel("Why do you want this job? (optional, in your words)").fill(
      "I use their planning app every week.",
    );
    await expect(panel.getByRole("button", { name: "Quick draft (template)" })).toBeVisible();
    await panel.getByRole("button", { name: "Write with AI" }).click();
    await panel.getByRole("button", { name: "Turn on AI writing help" }).click();
    const body = panel.locator(".letterhead-editable-body");
    await expect(body).toHaveValue(/^Dear Hiring Team,\n\nI am applying for the Product Designer role at Contoso/);
    await expect(body).toHaveValue(/shared component library/);
    await expect(panel).toContainText("Written by AI from your CV and your note. Check every claim before you send it.");
    await expect(panel).toContainText("1 paragraph was withheld");
    expect(sent[0]).toMatchObject({
      job: { title: "Product Designer", company: "Contoso" },
      note: "I use their planning app every week.",
    });
    expect(JSON.stringify(sent[0])).not.toContain("alex@example.com");
    // The letter is editable before export.
    await body.fill("Dear Hiring Team,\n\nMy own words.");
    await expect(body).toHaveValue("Dear Hiring Team,\n\nMy own words.");
  } finally {
    await cleanup();
  }
});

test("Tidy with AI moves, splits and dates an import without changing its words; Undo tidy restores it", async ({
  page,
}) => {
  const { headers, cleanup } = await accountWithCv(page);
  // A messy import: a degree under Experience, a run-on bullet, dates only in the text.
  const messy = createDocument();
  messy.name = "Imported CV";
  messy.provenance = { purpose: "personal", origin: "import" };
  messy.contact.name = "Sam Rivera";
  const jobs = messy.sections.find((s) => s.type === "experience")!;
  const job = newEntry();
  job.title = "Support Agent";
  job.organization = "Northwind";
  job.description = "March 2021 - Present";
  const runOn = "Answered customer emails in Zendesk and trained new staff on the ticket queue";
  job.bullets = [{ id: "run-on", text: runOn }];
  const degree = newEntry();
  degree.title = "BSc Business";
  degree.organization = "University of Leeds";
  jobs.entries = [job, degree];
  const sent: Record<string, any>[] = [];
  await page.route("**/api/ai/import-tidy", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    await route.fulfill({
      json: {
        requestId: body.requestId,
        dropped: 1,
        ops: [
          { type: "move", entryId: degree.id, toType: "education" },
          { type: "split", bulletId: "run-on", parts: ["Answered customer emails in Zendesk", "and trained new staff on the ticket queue"] },
          { type: "dates", entryId: job.id, start: "2021-03", end: "", current: true },
        ],
      },
    });
  });
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await page.getByLabel("Import JSON backup").setInputFiles({
      name: "messy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(messy)),
    });
    const review = page.getByRole("dialog", { name: "Review imported resume" });
    await expect(review).toContainText("Tidy with AI");
    await review.getByRole("button", { name: "Tidy with AI" }).click();
    await review.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(review).toContainText("What moved");
    await expect(review).toContainText("Moved “BSc Business at University of Leeds” from Experience to Education.");
    await expect(review).toContainText("Split a long bullet in “Support Agent at Northwind” into 2.");
    await expect(review).toContainText("1 suggested change was left out");
    await expect(review.locator(".extracted-section-list")).toContainText("Education: 1 entry");
    expect(sent[0].document.contact.photoUrl).toBeUndefined();

    await review.getByRole("button", { name: "Undo tidy" }).click();
    await expect(review.locator(".extracted-section-list")).not.toContainText("Education");

    await review.getByRole("button", { name: "Tidy with AI" }).click();
    await expect(review).toContainText("What moved");
    await review.getByRole("button", { name: "Restore as new", exact: true }).click();
    await expect(review).toHaveCount(0);
    await expect(page.locator(".save-status")).toHaveText("Saved to your account");
    const list = await (await page.request.get("/api/resumes", { headers })).json();
    const saved = (Array.isArray(list) ? list : list.resumes ?? list.documents).find(
      (d: { name: string }) => d.name === "Imported CV",
    );
    const cv = await (await page.request.get(`/api/resumes/${saved.id}`, { headers })).json();
    const section = (type: string) => cv.sections.find((s: { type: string }) => s.type === type).entries;
    expect(section("education").map((e: { title: string }) => e.title)).toEqual(["BSc Business"]);
    const tidied = section("experience")[0];
    expect(tidied.bullets.map((b: { text: string }) => b.text).join(" ")).toBe(runOn);
    expect([tidied.start, tidied.current]).toEqual(["2021-03", true]);
  } finally {
    await cleanup();
  }
});
