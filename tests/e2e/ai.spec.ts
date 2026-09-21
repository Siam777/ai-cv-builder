import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import { bulletEvidence } from "../../src/lib/ai-proposals";

test("AI controls keep local data private and require account storage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await page
    .getByRole("button", { name: "AI bullet assistant", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "AI bullet assistant" }),
  ).toContainText("Local resumes are never uploaded automatically");
  await expect(
    page.getByRole("button", { name: "Suggest a rewrite" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close AI assistant" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
});

test("AI review accepts, rejects and undoes controlled suggestions; SQLite saves are real", async ({
  page,
}) => {
  const origin = "http://localhost:3000";
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
    await page.goto("/");
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByRole("button", { name: "Open account workspace" }).click();
    await page.getByRole("button", { name: "Close account settings" }).click();
    await page
      .getByRole("button", { name: "AI bullet assistant", exact: true })
      .click();
    const generate = page.getByRole("button", { name: "Suggest a rewrite" });
    await expect(generate).toBeDisabled();
    expect(providerRequests).toBe(0);
    await page
      .getByLabel("Send this evidence and instruction to OpenAI.")
      .check();
    await generate.click();
    await expect(page.locator(".ai-review")).toContainText(
      "Controlled test suggestion",
    );
    const accept = page.getByRole("button", { name: "Accept and save" });
    await expect(accept).toBeDisabled();
    await page.getByRole("button", { name: "Reject suggestion" }).click();
    expect(
      (
        await (
          await page.request.get(`/api/resumes/${doc.id}`, { headers })
        ).json()
      ).revision,
    ).toBe(0);
    await generate.click();
    await page
      .getByLabel(
        "I checked the wording and confirm it accurately describes my experience.",
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
    await expect(page.locator(".ai-panel")).toContainText("Suggestion saved");
    await page.getByRole("button", { name: "Close AI assistant" }).click();
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
