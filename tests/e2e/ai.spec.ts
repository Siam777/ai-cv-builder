import { editorTool } from "./helpers";
import { startSampleResume, openFirstCv, authenticateForExport } from "./helpers";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import { bulletEvidence } from "../../src/lib/ai-proposals";

test("AI controls keep local data private and require account storage", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await page.getByRole("button", { name: /Experience/ }).click();
  await page
    .getByRole("button", { name: "AI help for Bullet 1", exact: true })
    .first()
    .click();
  // The AI options are shown with the reason they need an account, not hidden.
  await expect(
    page.getByRole("menuitem", { name: /^Improve wording/ }),
  ).toContainText("Needs your account");
  await page.getByRole("menuitem", { name: /^Improve wording/ }).click();
  const card = page.getByRole("group", { name: "AI help for Bullet 1" });
  await expect(card).toContainText("works on CVs saved to your account");
  await expect(
    page.getByRole("button", { name: "Suggest a rewrite" }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Close" }).click();

  await editorTool(page, "Writing help");
  const panel = page.getByRole("complementary", { name: "AI Assistant" });
  await expect(panel.getByRole("status").first()).toContainText(
    "works on CVs saved to your account",
  );
  await page.getByRole("button", { name: "Close AI Assistant" }).click();
  await expect(page.getByLabel("Bullet 1", { exact: true }).first()).toBeVisible();
});

test("AI review accepts, rejects and undoes controlled suggestions; SQLite saves are real", async ({
  page,
}) => {
  const origin = (process.env.E2E_ORIGIN || "http://localhost:3100");
  const password = "Synthetic-AI-password-42";
  const signup = await page.request.post("/api/auth", {
    headers: {
      origin,
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: {
      action: "signup",
      email: `ai-${randomUUID()}@example.test`,
      password,
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const created = await page.request.post("/api/resumes", {
    headers,
    data: { document: createDocument(true), expectedRevision: null },
  });
  const doc = await created.json();
  const source = bulletEvidence(doc)[0];
  let proposal: any;
  let providerRequests = 0;
  // These routes deliberately emulate AI output; no model quality claim is made.
  await page.route("**/api/ai", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, signedIn: true } });
    const body = route.request().postDataJSON();
    providerRequests++;
    expect(body.consent).toBe(true);
    expect(body.document).toBeUndefined();
    proposal = {
      schemaVersion: 1,
      id: body.requestId,
      documentId: doc.id,
      baseRevision: body.revision,
      message: "Controlled test suggestion",
      questions: [],
      operations: [
        {
          type: "replaceBullet",
          sectionId: source.sectionId,
          entryId: source.entryId,
          bulletId: source.id,
          before: source.text,
          text: "Led discovery for a small business workspace.",
          evidenceIds: [source.id],
        },
      ],
    };
    await route.fulfill({ json: proposal });
  });
  await page.route("**/api/ai/*", async (route) => {
    const body = route.request().postDataJSON();
    if (body.decision === "reject")
      return route.fulfill({ json: { rejected: true } });
    const current = await (
      await page.request.get(`/api/resumes/${doc.id}`, { headers })
    ).json();
    const bullet = current.sections
      .flatMap((s: any) => s.entries)
      .flatMap((e: any) => e.bullets)
      .find((b: any) => b.id === source.id);
    bullet.text = proposal.operations[0].text;
    const saved = await page.request.post("/api/resumes", {
      headers,
      data: { document: current, expectedRevision: proposal.baseRevision },
    });
    await route.fulfill({
      json: { document: await saved.json(), alreadyApplied: false },
    });
  });
  try {
    // Real endpoints still enforce account ownership before checking provider configuration.
    expect(
      (
        await page.request.post("/api/ai", {
          headers,
          data: {
            requestId: randomUUID(),
            documentId: "foreign-document",
            revision: 0,
            bulletId: source.id,
            instruction: "Rewrite",
            consent: true,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/ai/foreign-proposal", {
          headers,
          data: { decision: "accept", confirmed: true },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/ai", {
          headers: { ...headers, origin: "https://untrusted.example" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await page.getByRole("button", { name: /Experience/ }).click();
    const field = page.locator(`[data-bullet-id="${source.id}"]`);
    const openImprove = async () => {
      await field.getByRole("button", { name: /^AI help for Bullet/ }).click();
      await page.getByRole("menuitem", { name: /^Improve wording/ }).click();
    };
    const card = field.getByRole("group", { name: /^AI help for Bullet/ });
    await openImprove();
    const generate = card.getByRole("button", { name: "Suggest a rewrite" });
    await expect(generate).toBeDisabled();
    expect(providerRequests).toBe(0);
    await card.getByLabel("Send this to OpenAI").check();
    await generate.click();
    await expect(card).toContainText("Controlled test suggestion");
    // The inline view shows the change: removed words struck, added words marked.
    await expect(card.locator(".field-ai-text ins").first()).toBeVisible();
    const accept = card.getByRole("button", { name: "Accept" });
    await expect(accept).toBeDisabled();
    // Try again asks for a fresh suggestion; Keep mine rejects the proposal.
    await card.getByRole("button", { name: "Try again" }).click();
    await expect(card).toContainText("Controlled test suggestion");
    expect(providerRequests).toBe(2);
    await card.getByRole("button", { name: "Keep mine" }).click();
    await expect(card).toHaveCount(0);
    expect(
      (
        await (
          await page.request.get(`/api/resumes/${doc.id}`, { headers })
        ).json()
      ).revision,
    ).toBe(0);
    await openImprove();
    await card.getByLabel("Send this to OpenAI").check();
    await card.getByRole("button", { name: "Suggest a rewrite" }).click();
    await card
      .getByLabel(
        "I checked the wording and it accurately describes my experience.",
      )
      .check();
    await page.screenshot({
      path: "test-results/ai-review-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/ai-review-mobile.png",
      fullPage: true,
    });
    await accept.click();
    await expect(card).toContainText("Applied");
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole("button", { name: "Undo", exact: false }).click();
    await expect(page.locator(".save-status")).toHaveText(
      "Saved to your account",
    );
    const restored = await (
      await page.request.get(`/api/resumes/${doc.id}`, { headers })
    ).json();
    expect(bulletEvidence(restored)[0].text).toBe(source.text);
    expect(restored.revision).toBe(2);
  } finally {
    await page.request.delete("/api/account", {
      headers,
      data: { password, confirmation: "DELETE MY ACCOUNT" },
    });
  }
});
