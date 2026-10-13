import { test, expect, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { createDocument } from "../../src/lib/document";
import { authenticateForExport, startSampleResume, testEmail, openAccount } from "./helpers";

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const configured = process.env.E2E_GOOGLE === "1";
const password = "Synthetic-account-password-42";
let identity = 0;
test.beforeEach(async ({ page }) => {
  // Independent browser users must not share one proxy-IP rate-limit bucket.
  await page
    .context()
    .setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${++identity}` });
});
type Profile = {
  email: string;
  sub?: string;
  verified?: boolean;
  cancel?: boolean;
};

async function installGoogle(page: Page, profile: Profile) {
  await page
    .context()
    .unroute("https://accounts.google.com/o/oauth2/v2/auth**");
  await page
    .context()
    .route("https://accounts.google.com/o/oauth2/v2/auth**", async (route) => {
      const auth = new URL(route.request().url());
      expect(auth.searchParams.get("client_id")).toBe(
        "synthetic-google-client",
      );
      expect(auth.searchParams.get("prompt")).toBe("select_account");
      expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
      expect(new Set(auth.searchParams.get("scope")!.split(" "))).toEqual(
        new Set(["openid", "email", "profile"]),
      );
      const callback = new URL(auth.searchParams.get("redirect_uri")!);
      expect(callback.href).toBe(`${origin}/api/auth/callback/google`);
      callback.searchParams.set("state", auth.searchParams.get("state")!);
      if (profile.cancel) callback.searchParams.set("error", "access_denied");
      else
        callback.searchParams.set(
          "code",
          Buffer.from(
            JSON.stringify({
              email: profile.email,
              sub: profile.sub || profile.email,
              verified: profile.verified ?? true,
              challenge: auth.searchParams.get("code_challenge"),
              redirect: `${origin}/api/auth/callback/google`,
              nonce: auth.searchParams.get("nonce"),
            }),
          ).toString("base64url"),
        );
      await route.fulfill({
        contentType: "text/html",
        body: `<h1>Synthetic Google provider</h1><p>This is a local test fixture.</p><button id="finish">${profile.cancel ? "Cancel" : "Continue"}</button><script>document.getElementById('finish').onclick=()=>location.assign(${JSON.stringify(callback.href)});</script>`,
      });
    });
}
async function popup(page: Page, button: Locator, profile: Profile) {
  await installGoogle(page, profile);
  const opened = page.waitForEvent("popup");
  await button.click();
  const child = await opened;
  await expect(
    child.getByRole("heading", { name: "Synthetic Google provider" }),
  ).toBeVisible();
  return child;
}
async function google(page: Page, button: Locator, profile: Profile) {
  const child = await popup(page, button, profile);
  await child
    .getByRole("button", {
      name: profile.cancel ? "Cancel" : "Continue",
      exact: true,
    })
    .click();
  await expect.poll(() => child.isClosed()).toBe(true);
}
async function account(page: Page) {
  await openAccount(page);
  await expect(page.locator(".account-panel")).toBeVisible();
}
async function localDocuments(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any[]>((resolve, reject) => {
        const request = indexedDB.open("cv-builder", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("resumes", "readonly");
          const all = tx.objectStore("resumes").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(all.result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}
async function capture(page: Page, name: string) {
  await mkdir("test-results/google-auth", { recursive: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  const panel = page.locator(".account-panel");
  expect(
    await panel.evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: `test-results/google-auth/${name}.png`,
    fullPage: true,
  });
}

test("unconfigured Google is unavailable without exposing credentials or creating a session", async ({
  page,
}) => {
  test.skip(
    configured,
    "Runs against the server without Google configuration.",
  );
  await page.goto("/builder");
  await account(page);
  await expect(page.locator(".account-signin-options")).toContainText(
    "not configured",
  );
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  const response = await page.request.post("/api/auth/google", {
    headers: { origin },
    data: { action: "signin", flow: randomUUID() },
  });
  expect(response.status()).toBe(503);
  expect((await response.json()).error).toBe("GOOGLE_UNAVAILABLE");
  expect(
    (await (await page.request.get("/api/account")).json()).user,
  ).toBeNull();
});

test.describe("configured Google with a synthetic provider transport", () => {
  test.skip(
    !configured,
    "Run with E2E_GOOGLE=1; no live Google requests or credentials.",
  );
  for (const width of [360, 768, 1440]) {
    test(`Google popup at ${width}px preserves local draft, undo and pending export`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/builder");
      await startSampleResume(page);
      await page
        .getByLabel("Full name", { exact: true })
        .fill("Google draft — Zoë");
      await page.locator("summary").click();
      await page
        .getByRole("button", { name: "Backup (.json)", exact: true })
        .click();
      await expect(page.locator(".account-panel")).toBeVisible();
      await capture(page, `${width}-signin`);
      const before = page.url();
      page.on("dialog", (dialog) => dialog.accept());
      const downloading = page.waitForEvent("download");
      await google(
        page,
        page.getByRole("button", { name: "Continue with Google" }),
        { email: `google-${randomUUID()}@example.test` },
      );
      const download = await downloading;
      const exported = JSON.parse(
        await readFile((await download.path())!, "utf8"),
      );
      expect(exported.contact.name).toBe("Google draft — Zoë");
      expect(page.url()).toBe(before);
      await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Google draft — Zoë",
      );
      const session = await (await page.request.get("/api/account")).json();
      expect(session.googleLinked).toBe(true);
      expect(session.hasPassword).toBe(false);
      expect(session.user.emailVerified).toBe(true);
      expect(
        await (
          await page.request.get("/api/resumes", {
            headers: { "X-Workspace-User": session.user.id },
          })
        ).json(),
      ).toEqual([]);
      await expect
        .poll(async () => (await localDocuments(page))[0].contact.name)
        .toBe("Google draft — Zoë");
      await page.getByRole("button", { name: /Undo/ }).click();
      await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Alex Morgan",
      );
      await account(page);
      await capture(page, `${width}-google-account`);
      await expect(
        page.getByRole("button", { name: "Set a password by email" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Change password", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Close account settings" })
        .click();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Open CV", exact: true }),
      ).toHaveCount(1);
    });
  }

  test("blocked, closed, denied and unverified Google sign-in keep the draft and export boundary", async ({
    page,
  }) => {
    await page.addInitScript(
      `const original = window.open.bind(window); window.open = (...args) => window.blockGoogle ? null : original(...args);`,
    );
    await page.goto("/builder");
    await startSampleResume(page);
    await account(page);
    await page.evaluate(() => {
      (window as any).blockGoogle = true;
    });
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "Allow a sign-in window",
    );
    await page.evaluate(() => {
      (window as any).blockGoogle = false;
    });
    const child = await popup(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email: "closed@example.test" },
    );
    await child.close();
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "window closed",
    );
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email: "denied@example.test", cancel: true },
    );
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "cancelled",
    );
    expect(
      (await (await page.request.get("/api/account")).json()).user,
    ).toBeNull();
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      {
        email: `unverified-google-${randomUUID()}@example.test`,
        verified: false,
      },
    );
    const session = await (await page.request.get("/api/account")).json();
    expect(session.user.emailVerified).toBe(false);
    const refusedLink = await page.request.post("/api/auth/google", {
      headers: { origin, "X-Workspace-User": session.user.id },
      data: { action: "link", flow: randomUUID() },
    });
    expect(refusedLink.status()).toBe(403);
    const response = await page.request.post("/api/exports", {
      headers: { origin, "X-Workspace-User": session.user.id },
      data: {
        kind: "resume",
        format: "json",
        source: {
          storage: "device",
          document: createDocument(),
          processingConsent: true,
        },
      },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toBe("EMAIL_VERIFICATION_REQUIRED");
    await page.getByRole("button", { name: "Close account settings" }).click();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
      "Alex Morgan",
    );
    expect((await localDocuments(page)).length).toBe(1);
  });

  test("Google linking is explicit, requires the same verified email and preserves the account owner", async ({
    page,
  }) => {
    await page.goto("/builder");
    await startSampleResume(page);
    const user = await authenticateForExport(page);
    const doc = createDocument();
    doc.contact.name = "Original account CV";
    const headers = { origin, "X-Workspace-User": user.id };
    expect(
      (
        await page.request.post("/api/resumes", {
          headers,
          data: { document: doc, expectedRevision: null },
        })
      ).status(),
    ).toBe(200);
    const saved = await (
      await page.request.get("/api/resumes", { headers })
    ).json();
    await page.request.post("/api/auth", {
      headers: { origin },
      data: { action: "signout" },
    });
    await account(page);
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email: user.email },
    );
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "Link Google",
    );
    expect(
      (await (await page.request.get("/api/account")).json()).user,
    ).toBeNull();
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: { action: "signin", email: user.email, password },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await account(page);
    await google(
      page,
      page.getByRole("button", { name: "Link Google", exact: true }),
      { email: `wrong-${randomUUID()}@example.test` },
    );
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "same email",
    );
    expect(
      (await (await page.request.get("/api/account")).json()).googleLinked,
    ).toBe(false);
    await google(
      page,
      page.getByRole("button", { name: "Link Google", exact: true }),
      { email: user.email },
    );
    const linked = await (await page.request.get("/api/account")).json();
    expect(linked.user.id).toBe(user.id);
    expect(linked.googleLinked).toBe(true);
    expect(linked.hasPassword).toBe(true);
    expect(
      await (await page.request.get("/api/resumes", { headers })).json(),
    ).toEqual(saved);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email: user.email },
    );
    expect(
      (await (await page.request.get("/api/account")).json()).user.id,
    ).toBe(user.id);
    expect(
      await (await page.request.get("/api/resumes", { headers })).json(),
    ).toEqual(saved);
  });

  test("Google-only accounts can set a password without losing the Google link", async ({
    page,
  }) => {
    await page.goto("/builder");
    await account(page);
    const email = `google-recovery-${randomUUID()}@example.test`;
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email },
    );
    let session = await (await page.request.get("/api/account")).json();
    await page.getByRole("button", { name: "Set a password by email" }).click();
    const recovery = await testEmail(email, "recovery");
    const token = new URL(recovery.url).pathname.split("/").at(-1)!;
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: { action: "complete-reset", token, password },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await account(page);
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email },
    );
    session = await (await page.request.get("/api/account")).json();
    expect(session.googleLinked).toBe(true);
    expect(session.hasPassword).toBe(true);
    const headers = { origin, "X-Workspace-User": session.user.id };
    expect(
      (
        await page.request.delete("/api/account", {
          headers,
          data: { confirmation: "DELETE MY ACCOUNT" },
        })
      ).status(),
    ).toBe(400);
  });

  test("Google-only deletion requires a recent session and explicit confirmation", async ({
    page,
  }) => {
    await page.goto("/builder");
    await account(page);
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email: `google-delete-${randomUUID()}@example.test` },
    );
    const session = await (await page.request.get("/api/account")).json();
    const client = createClient({ url: "file:./data/e2e.db" });
    await client.execute({
      sql: "UPDATE session SET createdAt = ? WHERE userId = ?",
      args: [Date.now() - 660_000, session.user.id],
    });
    client.close();
    const deleteHeaders = { origin, "X-Workspace-User": session.user.id };
    const stale = await page.request.delete("/api/account", {
      headers: deleteHeaders,
      data: { confirmation: "DELETE MY ACCOUNT" },
    });
    expect(stale.status()).toBe(403);
    expect((await stale.json()).error).toBe("RECENT_SIGN_IN_REQUIRED");
    await google(
      page,
      page.getByRole("button", { name: "Sign in again with Google" }),
      { email: session.user.email },
    );
    await page
      .getByRole("button", {
        name: "Delete account and cloud resumes",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("No password is required", { exact: false }),
    ).toBeVisible();
    await page.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE MY ACCOUNT");
    await page
      .getByRole("button", { name: "Permanently delete account", exact: true })
      .click();
    expect(
      (await (await page.request.get("/api/account")).json()).user,
    ).toBeNull();
  });

  test("failed persistence blocks Google and changed Google identity pauses the original cloud draft", async ({
    page,
  }) => {
    await page.goto("/builder");
    await account(page);
    const originalEmail = `google-owner-${randomUUID()}@example.test`;
    await google(
      page,
      page.getByRole("button", { name: "Continue with Google" }),
      { email: originalEmail },
    );
    await page
      .getByRole("button", { name: "Open account workspace", exact: true })
      .click();
    await page.getByRole("button", { name: "Close account settings" }).click();
    await page
      .getByRole("button", { name: "Create my resume", exact: true })
      .click();
    await page.context().route("**/api/resumes", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: "SAVE_FAILED",
              message: "Synthetic save failure; your draft is kept.",
            }),
          })
        : route.continue(),
    );
    await page
      .getByLabel("Full name", { exact: true })
      .fill("Kept original Google draft");
    await account(page);
    const opened = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Sign in again with Google" })
      .click();
    const failed = await opened;
    await expect.poll(() => failed.isClosed()).toBe(true);
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "save failure",
    );
    await page.context().unroute("**/api/resumes");
    await google(
      page,
      page.getByRole("button", { name: "Sign in again with Google" }),
      { email: `google-other-${randomUUID()}@example.test` },
    );
    await expect(page.locator(".google-auth [role=alert]")).toContainText(
      "account changed",
    );
    await page.getByRole("button", { name: "Close account settings" }).click();
    await expect(
      page.getByText(
        "Account workspace paused. Your draft stays in this tab.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
      "Kept original Google draft",
    );
    const current = await (await page.request.get("/api/account")).json();
    expect(
      await (
        await page.request.get("/api/resumes", {
          headers: { "X-Workspace-User": current.user.id },
        })
      ).json(),
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Keep draft on this device", exact: true })
      .click();
    await expect(page.locator(".save-status")).toHaveText(
      "Saved in this browser",
    );
    expect((await localDocuments(page))[0].contact.name).toBe(
      "Kept original Google draft",
    );
  });

  test("Google sign-in starts retain Better Auth rate limiting", async ({
    page,
  }) => {
    await page.goto("/builder");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await page.request.post("/api/auth/google", {
        headers: { origin, "x-forwarded-for": "203.0.113.211" },
        data: { action: "signin", flow: randomUUID() },
      });
      statuses.push(response.status());
      expect(await response.text()).not.toContain("synthetic-google-secret");
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(
      (await (await page.request.get("/api/account")).json()).user,
    ).toBeNull();
  });

  test("OAuth state and link ownership are enforced; account navigation saves before leaving", async ({
    page,
  }) => {
    await page.goto("/builder");
    await startSampleResume(page);
    const untrusted = await page.request.post("/api/auth/google", {
      headers: { origin: "https://elsewhere.example" },
      data: { action: "signin", flow: randomUUID() },
    });
    expect(untrusted.status()).toBe(403);
    const link = await page.request.post("/api/auth/google", {
      headers: { origin },
      data: { action: "link", flow: randomUUID() },
    });
    expect(link.status()).toBe(401);
    const callback = await page.request.get(
      "/api/auth/callback/google?code=invalid&state=forged",
      { maxRedirects: 0 },
    );
    expect(callback.status()).toBe(302);
    expect(callback.headers().location).toContain("error=");
    expect(
      (await (await page.request.get("/api/account")).json()).user,
    ).toBeNull();
    const user = await authenticateForExport(page);
    const wrong = await page.request.post("/api/auth/google", {
      headers: { origin, "X-Workspace-User": "wrong-owner" },
      data: { action: "link", flow: randomUUID() },
    });
    expect(wrong.status()).toBe(409);
    const client = createClient({ url: "file:./data/e2e.db" });
    await client.execute({
      sql: "UPDATE session SET createdAt = ? WHERE userId = ?",
      args: [Date.now() - 660_000, user.id],
    });
    const oldLink = await page.request.post("/api/auth/google", {
      headers: { origin, "X-Workspace-User": user.id },
      data: { action: "link", flow: randomUUID() },
    });
    expect(oldLink.status()).toBe(403);
    expect((await oldLink.json()).error).toBe("RECENT_SIGN_IN_REQUIRED");
    await client.execute({
      sql: "UPDATE session SET createdAt = ? WHERE userId = ?",
      args: [Date.now(), user.id],
    });
    client.close();
    // Header navigation immediately after typing must flush autosave first.
    await page
      .getByLabel("Full name", { exact: true })
      .fill("Navigation keeps this edit");
    await page
      .locator(".header-nav")
      .getByRole("link", { name: "Profile", exact: true })
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    expect((await localDocuments(page))[0].contact.name).toBe(
      "Navigation keeps this edit",
    );
    await expect(
      page.getByRole("navigation", { name: "Account navigation" }),
    ).toContainText("Help");
    expect(user.id).toBeTruthy();
  });
});
