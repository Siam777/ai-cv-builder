import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import { bulletEvidence } from "../../src/lib/ai-proposals";
import { openFirstCv } from "./helpers";

// These flows walk several steps against a dev server.
test.describe.configure({ timeout: 90_000 });

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-AI-interview-password-42";

/** A real account (Go during the beta); AI reported as ready. Replies below are controlled test data. */
async function signUp(page: Page) {
  const signup = await page.request.post("/api/auth", {
    headers: {
      origin,
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: { action: "signup", email: `ai-interview-${randomUUID()}@example.test`, password },
  });
  expect(signup.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  await page.route("**/api/ai", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true, signedIn: true } })
      : route.fallback(),
  );
  return {
    headers,
    cleanup: () =>
      page.request.delete("/api/account", {
        headers,
        data: { password, confirmation: "DELETE MY ACCOUNT" },
      }),
  };
}

test("Build my CV with AI fills a new account CV step by step from the person's answers", async ({
  page,
}) => {
  const { headers, cleanup } = await signUp(page);
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/ai/entry-bullets", async (route) => {
    const body = route.request().postDataJSON();
    sent.push({ url: "entry-bullets", body });
    await route.fulfill({
      json: {
        requestId: body.requestId,
        message: "",
        title: "",
        bullets: [
          {
            id: "b1",
            text: "Handled customer tickets using Zendesk.",
            evidenceIds: ["note-1"],
            evidence: ["handled customer tickets with Zendesk"],
          },
        ],
        withheld: [],
        questions: ["How many tickets did you handle a week?"],
      },
    });
  });
  await page.route("**/api/ai/interview-step", async (route) => {
    const body = route.request().postDataJSON();
    sent.push({ url: "interview-step", body });
    await route.fulfill({
      json:
        body.step === "education"
          ? {
              requestId: body.requestId,
              step: "education",
              education: [
                { qualification: "BSc Business", institution: "University of Leeds", year: "2019" },
              ],
              skills: [],
              languages: [],
              certifications: [],
              dropped: 1,
            }
          : {
              requestId: body.requestId,
              step: "extras",
              education: [],
              skills: ["Excel", "SQL"],
              languages: [{ language: "Spanish", level: "fluent" }],
              certifications: [],
              dropped: 0,
            },
    });
  });
  try {
    // The real start route refuses until AI writing help is on.
    const refused = await page.request.post("/api/ai/interview", {
      headers,
      data: { documentId: "anything" },
    });
    expect(refused.status()).toBe(403);

    await page.goto("/builder");
    const start = page.locator(".start-screen");
    await start.getByRole("button", { name: "Build my CV with AI" }).click();
    const interview = page.locator(".ai-interview");
    await expect(interview.getByRole("heading", { name: "Build my CV with AI" })).toBeFocused();
    await interview.getByRole("button", { name: "Turn on AI writing help" }).click();
    // The start route is real: it records the interview (no AI request is made).
    await interview.getByRole("button", { name: "Start the interview" }).click();

    await expect(interview).toContainText("Step 1 of 5");
    await interview.getByLabel("Your name (optional, not sent to AI)").fill("Sam Rivera");
    await interview.getByLabel("What job are you aiming for?").fill("Customer support lead");
    await interview.getByRole("button", { name: "Next" }).click();
    // The preview fills in live.
    await expect(page.locator("#resume-preview-panel")).toContainText(
      "Customer support lead",
    );

    await expect(interview).toContainText("Step 2 of 5");
    await interview.getByLabel("Job title").fill("Support Agent");
    await interview.getByLabel("Organization").fill("Northwind");
    await interview.getByLabel("Start (YYYY or YYYY-MM)").fill("2021-04");
    await interview.getByLabel("I work here now").check();
    await interview.getByRole("button", { name: "Save this job" }).click();
    // Write with AI opens straight away for the saved job.
    const notes = interview.getByLabel("What did you do in this role? Rough notes are fine.");
    await expect(notes).toBeVisible();
    await notes.fill("handled customer tickets with Zendesk");
    await interview.getByRole("button", { name: "Write bullets" }).click();
    await expect(interview).toContainText("How many tickets did you handle a week?");
    await interview.getByLabel("Add suggestion 1").check();
    await interview.getByRole("button", { name: "Add ticked" }).click();
    await interview.getByRole("button", { name: "Next: education" }).click();

    await expect(interview).toContainText("Step 3 of 5");
    await interview
      .getByLabel("Your education: degree or course, school and year")
      .fill("BSc Business, University of Leeds, 2019");
    await interview.getByRole("button", { name: "Next" }).click();
    await expect(interview).toContainText("1 item was left out because it was not in your words.");
    await interview.getByRole("button", { name: "Add ticked and continue" }).click();

    await expect(interview).toContainText("Step 4 of 5");
    await interview
      .getByLabel("Tools and skills you use, languages you speak, and certificates")
      .fill("Excel and SQL. Spanish (fluent).");
    await interview.getByRole("button", { name: "Next" }).click();
    await interview.getByLabel("Skill: SQL").uncheck();
    await interview.getByRole("button", { name: "Add ticked and continue" }).click();

    await expect(interview).toContainText("Step 5 of 5");
    await interview.getByRole("button", { name: "Open the editor" }).click();
    await expect(interview).toHaveCount(0);

    // Only the person's answers and ticked items reach the CV, saved to the account.
    await expect(page.locator(".save-status")).toHaveText("Saved to your account");
    const list = await (await page.request.get("/api/resumes", { headers })).json();
    const saved = (Array.isArray(list) ? list : list.resumes ?? list.documents).find(
      (d: { name: string }) => d.name === "My CV (AI interview)",
    );
    const cv = await (await page.request.get(`/api/resumes/${saved.id}`, { headers })).json();
    expect(cv.contact).toMatchObject({ name: "Sam Rivera", headline: "Customer support lead" });
    const section = (type: string) =>
      cv.sections.find((s: { type: string }) => s.type === type).entries;
    expect(section("experience")[0]).toMatchObject({
      title: "Support Agent",
      organization: "Northwind",
      start: "2021-04",
      current: true,
    });
    expect(bulletEvidence(cv).map((b) => b.text)).toEqual(["Handled customer tickets using Zendesk."]);
    expect(section("education")[0]).toMatchObject({
      title: "BSc Business",
      organization: "University of Leeds",
      end: "2019",
    });
    expect(section("skills")[0].description).toBe("Excel");
    expect(section("languages")[0]).toMatchObject({ title: "Spanish", description: "fluent" });

    // Nothing but the answers was sent: no name, no contact details, no document.
    for (const request of sent) expect(JSON.stringify(request.body)).not.toContain("Sam Rivera");
    expect(sent.find((r) => r.url === "interview-step")!.body).toMatchObject({
      step: "education",
      answer: "BSc Business, University of Leeds, 2019",
    });
  } finally {
    await cleanup();
  }
});

test("Suggest skills with AI quotes evidence, keeps role skills unticked, groups in one Undo step, and is Go and Pro only", async ({
  page,
}) => {
  const { headers, cleanup } = await signUp(page);
  const fixture = createDocument(true);
  const created = await page.request.post("/api/resumes", {
    headers,
    data: { document: fixture, expectedRevision: null },
  });
  const doc = await created.json();
  const bullet = bulletEvidence(doc)[0];
  let calls = 0;
  await page.route("**/api/ai/skills", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        requestId: body.requestId,
        message: "",
        role: "Product designer",
        demonstrated: [
          { skill: "Stakeholder interviews", evidenceIds: [bullet.id], evidence: [bullet.text] },
        ],
        roleSuggestions: ["Usability testing"],
        groups: [
          { name: "Tools", skills: ["Figma"] },
          {
            name: "Methods",
            skills: ["Product strategy", "User research", "Interaction design", "Prototyping", "Design systems"],
          },
        ],
        withheld: 1,
      },
    });
  });
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await page.locator(".section-nav").getByRole("button", { name: /^Skills/ }).click();
    await page.getByRole("button", { name: "AI help for Skills" }).first().click();
    await page.getByRole("menuitem", { name: /^Suggest skills with AI/ }).click();
    const card = page.getByRole("group", { name: "AI help for Skills" }).first();
    await expect(card).toContainText("Sends your headline, jobs, bullets and listed skills");
    await card.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(card).toContainText("Shown in your CV");
    await expect(card).toContainText(`From your CV: “${bullet.text}”`);
    await expect(card).toContainText("Common for “Product designer”: add only if true");
    await expect(card).toContainText("1 suggestion was withheld");
    await expect(card.getByLabel("Usability testing")).not.toBeChecked();
    const add = card.getByRole("button", { name: "Add ticked" });
    await expect(add).toBeDisabled();
    await card.getByLabel("Stakeholder interviews").check();
    await card.getByLabel("Arrange your listed skills into groups").check();
    await add.click();
    await expect(card).toContainText("Added 1 skill and grouped your skills.");
    const titles = page.getByLabel("Title", { exact: true });
    await expect(titles).toHaveCount(3);
    await expect(titles.nth(0)).toHaveValue("Tools");
    await expect(page.locator(".skill-chip", { hasText: "Stakeholder interviews" })).toHaveCount(1);
    await page.getByRole("button", { name: "Undo", exact: false }).click();
    await expect(titles).toHaveCount(1);
    await expect(titles.nth(0)).toHaveValue("Design & research");
    await expect(page.locator(".skill-chip", { hasText: "Stakeholder interviews" })).toHaveCount(0);
    expect(calls).toBe(1);

    // On Free the action explains the plan instead of asking the AI.
    await page.route("**/api/billing/subscription", (route) =>
      route.fulfill({ json: { subscription: { planId: "free", status: "none" }, user: null } }),
    );
    await page.reload();
    await openFirstCv(page, "Practice copies");
    await page.locator(".section-nav").getByRole("button", { name: /^Skills/ }).click();
    await page.getByRole("button", { name: "AI help for Skills" }).first().click();
    await page.getByRole("menuitem", { name: /^Suggest skills with AI/ }).click();
    await expect(page.getByRole("group", { name: "AI help for Skills" }).first()).toContainText(
      "part of Go and Pro",
    );
    expect(calls).toBe(1);
  } finally {
    await cleanup();
  }
});
