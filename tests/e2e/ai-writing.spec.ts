import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import { accountTab, openAccount, openFirstCv, startSampleResume } from "./helpers";

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-AI-writing-password-42";

/** A real account with one saved sample CV; returns what the tests need. */
async function accountWithCv(page: Page) {
  const signup = await page.request.post("/api/auth", {
    headers: {
      origin,
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: { action: "signup", email: `ai-writing-${randomUUID()}@example.test`, password },
  });
  expect(signup.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const fixture = createDocument(true);
  const created = await page.request.post("/api/resumes", {
    headers,
    data: { document: fixture, expectedRevision: null },
  });
  expect(created.status()).toBe(200);
  const doc = await created.json();
  // The provider is not configured in e2e; report it as ready so the UI runs.
  // Every AI reply below is controlled test data, not model output.
  await page.route("**/api/ai", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true, signedIn: true } })
      : route.fallback(),
  );
  return {
    doc,
    headers,
    cleanup: () =>
      page.request.delete("/api/account", {
        headers,
        data: { password, confirmation: "DELETE MY ACCOUNT" },
      }),
  };
}

/** The text of every bullet in one entry, in order. */
function bulletValues(page: Page, entryId: string) {
  return page
    .locator(`[data-entry-id="${entryId}"] .bullet-list-flow textarea`)
    .evaluateAll((items) => items.map((item) => (item as HTMLTextAreaElement).value));
}

async function openExperience(page: Page) {
  await page.goto("/builder");
  await openFirstCv(page, "Practice copies");
  await page.locator(".section-nav").getByRole("button", { name: /^Experience/ }).click();
}

test("guests are offered Sign in to use AI, and signing in copies the open draft to the account", async ({
  page,
}) => {
  await page.goto("/builder");
  const start = page.locator(".start-screen");
  const offer = start.getByRole("region", { name: "AI writing help" });
  await expect(offer).toContainText("Sign in to use AI.");
  await expect(offer).toContainText("New accounts get Go free for 30 days");
  // Built-in helpers are not presented as AI.
  await expect(start.getByRole("button", { name: "Practice CV (fictional)" })).toBeVisible();

  await startSampleResume(page);
  await page.getByRole("button", { name: "Sign in to use AI" }).first().click();
  const panel = page.locator(".account-panel");
  await panel.getByRole("button", { name: "Create account instead" }).click();
  await panel.getByLabel("Email", { exact: true }).fill(`guest-ai-${randomUUID()}@example.test`);
  await panel.getByLabel("Password", { exact: true }).fill(password);
  await panel.getByRole("button", { name: "Create account", exact: true }).click();
  // One step: the account panel closes and the draft is now an account CV.
  await expect(page.locator(".save-status")).toHaveText("Saved to your account");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Alex Morgan");
  await expect(page.getByRole("button", { name: "Sign in to use AI" })).toHaveCount(0);
  const user = (await (await page.request.get("/api/account")).json()).user;
  await page.request.delete("/api/account", {
    headers: { origin, "X-Workspace-User": user.id },
    data: { password, confirmation: "DELETE MY ACCOUNT" },
  });
});

test("Write with AI turns notes into ticked bullets, shows withheld suggestions and questions, and Undo removes them", async ({
  page,
}) => {
  const { doc, headers, cleanup } = await accountWithCv(page);
  const job = doc.sections.find((s: { type: string }) => s.type === "experience").entries[0];
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/ai/entry-bullets", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    // Long enough to see the loader.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      json: {
        requestId: body.requestId,
        message: "Built from your notes.",
        title: "",
        bullets: [
          {
            id: "b1",
            text: "Handled customer tickets using Zendesk.",
            evidenceIds: ["note-1"],
            evidence: ["handled customer tickets, trained 3 new staff, used Zendesk"],
          },
          {
            id: "b2",
            text: "Trained 3 new staff members.",
            evidenceIds: ["note-1"],
            evidence: ["handled customer tickets, trained 3 new staff, used Zendesk"],
          },
        ],
        withheld: [{ reason: "A suggestion added a number that is not in your notes, so it was withheld." }],
        questions: ["How many tickets did you handle a week?"],
      },
    });
  });
  try {
    // The real endpoint refuses until AI writing help is on, before any provider call.
    const refused = await page.request.post("/api/ai/entry-bullets", {
      headers,
      data: {
        requestId: randomUUID(),
        documentId: doc.id,
        revision: doc.revision,
        sectionId: doc.sections.find((s: { type: string }) => s.type === "experience").id,
        entryId: job.id,
        notes: "handled tickets",
      },
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error).toBe("AI_CONSENT_REQUIRED");

    await openExperience(page);
    const entry = page.locator(`[data-entry-ai="${job.id}"]`);
    await entry.getByRole("button", { name: `Write with AI: ${job.title}` }).click();
    const card = entry.getByRole("group", { name: `AI help for ${job.title}` });
    await card.getByRole("button", { name: "Turn on AI writing help" }).click();
    const notes = card.getByLabel("What did you do in this role? Rough notes are fine.");
    await expect(notes).toBeFocused();
    await notes.fill("handled customer tickets, trained 3 new staff, used Zendesk");
    await card.getByRole("button", { name: "Write bullets" }).click();
    await expect(card.getByRole("status").filter({ hasText: "Writing bullets from your notes" })).toBeVisible();
    await expect(card).toContainText("Checking each bullet against your notes");

    await expect(card).toContainText("2 bullets written from your notes");
    await expect(card).toContainText("1 more suggestion was left out");
    await expect(card).toContainText("Added a number that is not in your notes.");
    await expect(card).toContainText("How many tickets did you handle a week?");
    await expect(card).toContainText("From your notes:");
    // Written bullets start ticked; the button says how many will be added.
    await expect(card.getByLabel("Add bullet 1")).toBeChecked();
    await expect(card.getByRole("button", { name: "Add 2 bullets" })).toBeEnabled();
    expect(sent).toHaveLength(1);
    expect(sent[0].notes).toBe("handled customer tickets, trained 3 new staff, used Zendesk");
    expect(JSON.stringify(sent[0])).not.toContain("alex@example.com");

    await card.getByLabel("Add bullet 1").uncheck();
    await card.getByRole("textbox", { name: "Suggestion 2" }).fill("Trained 3 new support staff members.");
    await card.getByRole("button", { name: "Add 1 bullet" }).click();
    await expect(card).toContainText("Added 1 bullet. Undo removes it.");
    await expect
      .poll(() => bulletValues(page, job.id))
      .toEqual([...job.bullets.map((b: { text: string }) => b.text), "Trained 3 new support staff members."]);

    await page.getByRole("button", { name: "Undo", exact: false }).click();
    await expect
      .poll(() => bulletValues(page, job.id))
      .toEqual(job.bullets.map((b: { text: string }) => b.text));
  } finally {
    await cleanup();
  }
});

test("examples for a job title stay disabled until every blank is filled, then add as the person's own text", async ({
  page,
}) => {
  const { doc, headers, cleanup } = await accountWithCv(page);
  const job = doc.sections.find((s: { type: string }) => s.type === "experience").entries[0];
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/ai/starters", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({
      json: {
        requestId: body.requestId,
        jobTitle: body.jobTitle,
        seniority: body.seniority ?? null,
        cached: false,
        bullets: [
          "Led [number] design reviews a month with [team].",
          "Shipped [feature] used by [number] customers.",
        ],
        summary: "Product designer with [years] years of experience in [industry].",
        // "Figma" is already listed, so it is not offered again.
        skills: ["Accessibility audits", "Usability testing", "Figma"],
      },
    });
  });
  try {
    await openExperience(page);
    const entry = page.locator(`[data-entry-ai="${job.id}"]`);
    await entry.getByRole("button", { name: `Show examples for “${job.title}”` }).click();
    const card = entry.getByRole("group", { name: `AI help for ${job.title}` });
    await expect(card).toContainText("sends only the job title");
    await card.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(card).toContainText("Examples — make them yours");
    expect(requests[0]).toMatchObject({ jobTitle: job.title, section: "experience" });
    expect(Object.keys(requests[0]).sort()).toEqual(["jobTitle", "requestId", "section"]);

    const add = card.getByRole("button", { name: /^Add \d* ?to this job$/ });
    await expect(add).toBeDisabled();
    // Each blank is its own field; typing in one picks the example.
    await card.getByLabel("Example 1: number").fill("4");
    await expect(card.getByLabel("Use example 1")).toBeChecked();
    await expect(card).toContainText("1 of 2 blanks filled");
    await expect(card).toContainText("Fill or remove every blank");
    await expect(add).toBeDisabled();
    await card.getByLabel("Example 1: team").fill("the product team");
    await expect(card).toContainText("Ready to add");
    await expect(add).toBeEnabled();
    // Choosing a level asks again for that level.
    await card.getByLabel("Level").selectOption("senior");
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toMatchObject({ seniority: "senior" });
    // The whole sentence can also be rewritten; leftover [blanks] still block adding.
    await card.getByRole("button", { name: "Edit the whole sentence" }).first().click();
    const sentence = card.getByLabel("Example 1", { exact: true });
    await expect(sentence).toHaveValue("Led [number] design reviews a month with [team].");
    await sentence.fill("Led 4 design reviews a month with [team].");
    await card.getByLabel("Use example 1").check();
    await expect(add).toBeDisabled();
    await sentence.fill("Led 4 design reviews a month with the product team.");
    await add.click();
    await expect(card).toContainText("Added 1 bullet.");
    await expect
      .poll(() => bulletValues(page, job.id))
      .toEqual([...job.bullets.map((b: { text: string }) => b.text), "Led 4 design reviews a month with the product team."]);
    await page.getByRole("button", { name: "Undo", exact: false }).click();
    await expect
      .poll(() => bulletValues(page, job.id))
      .toEqual(job.bullets.map((b: { text: string }) => b.text));

    // Summary examples: one labelled example, Accept only with no blanks left.
    await page.locator(".section-nav").getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("button", { name: "AI help for Professional summary" }).click();
    await page.getByRole("menuitem", { name: /^Show examples/ }).click();
    const summary = page.getByRole("group", { name: "AI help for Professional summary" });
    await expect(summary).toContainText("Example — make it yours");
    const use = summary.getByRole("button", { name: "Use my edited summary" });
    await expect(use).toBeDisabled();
    await summary.getByLabel("Example summary: years").fill("6");
    await expect(use).toBeDisabled();
    await summary.getByLabel("Example summary: industry").fill("fintech");
    await use.click();
    await expect(page.getByRole("textbox", { name: "Professional summary" })).toHaveValue(
      "Product designer with 6 years of experience in fintech.",
    );

    // Skills examples are unticked until the person ticks what is true.
    await page.locator(".section-nav").getByRole("button", { name: /^Skills/ }).click();
    await page.getByRole("button", { name: "AI help for Skills" }).first().click();
    await page.getByRole("menuitem", { name: /^Show examples/ }).click();
    const skills = page.getByRole("group", { name: "AI help for Skills" }).first();
    await expect(skills).toContainText("add only if true");
    const addSkills = skills.getByRole("button", { name: "Add ticked skills" });
    await expect(addSkills).toBeDisabled();
    await expect(skills.getByLabel("Figma")).toHaveCount(0);
    await skills.getByLabel("Usability testing").check();
    await addSkills.click();
    await expect(page.locator(".skill-chip", { hasText: "Usability testing" })).toHaveCount(1);
    await expect(page.locator(".skill-chip", { hasText: "Accessibility audits" })).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test("AI writing help can be switched off in Data & privacy, and AI asks again before sending", async ({
  page,
}) => {
  const { doc, headers, cleanup } = await accountWithCv(page);
  const job = doc.sections.find((s: { type: string }) => s.type === "experience").entries[0];
  try {
    expect(
      (
        await page.request.patch("/api/account", {
          headers,
          data: { aiWritingHelp: true },
        })
      ).status(),
    ).toBe(200);
    // With consent on, the real route still checks the provider before any call.
    const unconfigured = await page.request.post("/api/ai/starters", {
      headers,
      data: { requestId: randomUUID(), jobTitle: "Product designer", section: "experience" },
    });
    expect(unconfigured.status()).toBe(503);

    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await openAccount(page);
    await accountTab(page, "Data & privacy");
    const toggle = page.getByRole("switch", { name: "Use AI writing help" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(page.locator(".account-panel")).toContainText("AI writing help is off");
    expect((await (await page.request.get("/api/account")).json()).aiWritingHelp).toBe(false);
    await page.getByRole("button", { name: "Close account settings" }).click();

    await page.locator(".section-nav").getByRole("button", { name: /^Experience/ }).click();
    const entry = page.locator(`[data-entry-ai="${job.id}"]`);
    await entry.getByRole("button", { name: `Write with AI: ${job.title}` }).click();
    await expect(
      entry.getByRole("button", { name: "Turn on AI writing help" }),
    ).toBeVisible();
    await entry.getByRole("button", { name: "Not now" }).click();
    await expect(entry.getByRole("group")).toHaveCount(0);
  } finally {
    await cleanup();
  }
});
