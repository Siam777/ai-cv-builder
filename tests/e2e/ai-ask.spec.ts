import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument, type ResumeDocument } from "../../src/lib/document";
import { bulletEvidence } from "../../src/lib/ai-proposals";
import { editorTool, openFirstCv } from "./helpers";

// These flows walk several steps against a dev server.
test.describe.configure({ timeout: 90_000 });

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-AI-phase-e-password-42";

test("Ask the AI answers with buttons that open the right tool, sends recent history, and never edits the CV", async ({
  page,
}) => {
  const signup = await page.request.post("/api/auth", {
    headers: { origin, "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}` },
    data: { action: "signup", email: `ai-e-${randomUUID()}@example.test`, password },
  });
  expect(signup.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const doc: ResumeDocument = await (
    await page.request.post("/api/resumes", { headers, data: { document: createDocument(true), expectedRevision: null } })
  ).json();
  const [b1] = bulletEvidence(doc);
  const skills = doc.sections.find((s) => s.type === "skills")!;
  // Controlled test data, not model output.
  const asked: Record<string, any>[] = [];
  await page.route("**/api/ai/ask", async (route) => {
    const body = route.request().postDataJSON();
    asked.push(body);
    await route.fulfill({
      json: {
        requestId: body.requestId,
        withheld: false,
        answer: `Answer ${asked.length}: lead with planning and delivery.`,
        actions: [
          { type: "improve-bullet", targetId: b1.id, label: "Improve the first bullet" },
          { type: "match-job", targetId: "", label: "Match a project manager post" },
          { type: "open-section", targetId: skills.id, label: "Open Skills" },
        ],
      },
    });
  });
  let rewrites = 0;
  await page.route("**/api/ai", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, signedIn: true } });
    rewrites++;
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        schemaVersion: 1,
        id: body.requestId,
        documentId: doc.id,
        baseRevision: body.revision,
        message: "Controlled improve suggestion",
        questions: [],
        operations: [
          { type: "replaceBullet", sectionId: b1.sectionId, entryId: b1.entryId, bulletId: b1.id, before: b1.text, text: "Led workspace design from discovery to launch.", evidenceIds: [b1.id] },
        ],
      },
    });
  });
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await editorTool(page, "Ask the AI");
    const panel = page.getByRole("complementary", { name: "AI Assistant" });
    const tab = panel.locator("#ai-tabpanel-ask");
    await tab.getByRole("button", { name: "How can I make my CV stronger for project manager roles?" }).click();
    await tab.getByRole("button", { name: "Ask", exact: true }).click();
    await tab.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(tab).toContainText("Answer 1: lead with planning and delivery.");
    expect(asked[0]).toMatchObject({ question: "How can I make my CV stronger for project manager roles?", history: [] });

    await tab.getByLabel("Your question", { exact: true }).fill("And what about my skills?");
    await tab.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(tab).toContainText("Answer 2");
    expect(asked[1].history).toEqual([
      { question: "How can I make my CV stronger for project manager roles?", answer: "Answer 1: lead with planning and delivery." },
    ]);

    // Buttons open tools; the chat itself changed nothing.
    expect((await (await page.request.get(`/api/resumes/${doc.id}`, { headers })).json()).revision).toBe(0);
    await tab.getByRole("button", { name: "Match a project manager post" }).first().click();
    await expect(panel.getByRole("tab", { name: "Match a job" })).toHaveAttribute("aria-selected", "true");
    await panel.getByRole("tab", { name: "Ask the AI" }).click();
    await expect(tab).toContainText("Answer 2");
    await tab.getByRole("button", { name: "Improve the first bullet" }).first().click();
    const card = page.locator(`[data-bullet-id="${b1.id}"]`).getByRole("group", { name: /^AI help for Bullet/ });
    await expect(card).toContainText("Controlled improve suggestion");
    expect(rewrites).toBe(1);
  } finally {
    await page.request.delete("/api/account", { headers, data: { password, confirmation: "DELETE MY ACCOUNT" } });
  }
});
