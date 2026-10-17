import { test, expect } from "@playwright/test";
import { randomUUID, createHmac } from "node:crypto";
import { createClient } from "@libsql/client";
import { createDocument } from "../../src/lib/document";
import {
  authenticateForExport,
  openFirstCv,
  startSampleResume,
  testEmail,
  verifyTestEmail,
} from "./helpers";

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-account-password-42";

test("unverified accounts can edit and access account data but every CV/letter export requires verification", async ({
  page,
}) => {
  const email = `unverified-${randomUUID()}@example.test`;
  expect(
    (
      await page.request.post("/api/auth", {
        headers: { origin },
        data: { action: "signup", email, password },
      })
    ).status(),
  ).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  expect(user.emailVerified).toBe(false);
  const headers = { origin, "X-Workspace-User": user.id };
  const doc = createDocument(true);
  expect(
    (
      await page.request.post("/api/resumes", {
        headers,
        data: { document: doc, expectedRevision: null },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await page.request.get("/api/account/export", { headers })).status(),
  ).toBe(200);
  for (const format of ["pdf", "docx", "html", "md", "txt", "json", "print"]) {
    const response = await page.request.post("/api/exports", {
      headers,
      data: {
        kind: "resume",
        format,
        source: { storage: "device", document: doc, processingConsent: true },
      },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toBe("EMAIL_VERIFICATION_REQUIRED");
  }
  for (const format of ["txt", "md", "copy", "print"]) {
    expect(
      (
        await page.request.post("/api/exports", {
          headers,
          data: {
            kind: "letter",
            format,
            text: "Reviewed letter",
            name: "Letter",
            source: { storage: "account", documentId: doc.id, revision: 0 },
          },
        })
      ).status(),
    ).toBe(403);
  }
  expect(
    (
      await page.request.post("/api/resumes/export-pdf", { headers, data: {} })
    ).status(),
  ).toBe(403);
  await verifyTestEmail(page.request, email);
  expect(
    (
      await page.request.post("/api/exports", {
        headers,
        data: {
          kind: "resume",
          format: "json",
          source: { storage: "account", documentId: doc.id, revision: 0 },
        },
      })
    ).status(),
  ).toBe(200);
});

test("verification rejects expired/tampered links and untrusted origins; resend uses the session email", async ({
  page,
}) => {
  const email = `verify-${randomUUID()}@example.test`;
  await page.request.post("/api/auth", {
    headers: { origin },
    data: { action: "signup", email, password },
  });
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const payload = `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")}.${Buffer.from(JSON.stringify({ email, exp: 1 })).toString("base64url")}`;
  const expired = `${payload}.${createHmac("sha256", "Synthetic-e2e-secret-for-local-tests-only-42").update(payload).digest("base64url")}`;
  const expiredResponse = await page.request.get(
    `/api/auth/verify-email?token=${expired}&callbackURL=${encodeURIComponent(origin + "/auth/complete")}`,
    { maxRedirects: 0 },
  );
  expect(expiredResponse.headers().location).toContain("error=TOKEN_EXPIRED");
  expect(
    (await page.request.get("/api/auth/verify-email?token=invalid")).status(),
  ).toBe(401);
  expect(
    (await (await page.request.get("/api/account")).json()).user.emailVerified,
  ).toBe(false);
  expect(
    (
      await page.request.post("/api/auth", {
        headers: { ...headers, origin: "https://foreign.example" },
        data: { action: "verify" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/auth", {
        headers,
        data: { action: "verify", email: "foreign@example.test" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/auth", {
        headers,
        data: { action: "verify" },
      })
    ).status(),
  ).toBe(200);
  await verifyTestEmail(page.request, email);
});

test("password recovery uses a single-use expiring token and revokes every session", async ({
  page,
  playwright,
}) => {
  await page.goto("/builder");
  const user = await authenticateForExport(page);
  const headers = { origin, "X-Workspace-User": user.id };
  const other = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-forwarded-for": "192.0.2.246" },
  });
  try {
    expect(
      (
        await other.post("/api/auth", {
          headers: { origin },
          data: { action: "signin", email: user.email, password },
        })
      ).status(),
    ).toBe(200);
    const unknown = await page.request.post("/api/auth", {
      headers: { origin },
      data: { action: "reset", email: `unknown-${randomUUID()}@example.test` },
    });
    const known = await page.request.post("/api/auth", {
      headers: { origin },
      data: { action: "reset", email: user.email },
    });
    expect(await known.json()).toEqual(await unknown.json());
    const message = await testEmail(user.email, "recovery");
    await page.goto(message.url);
    await expect(
      page.getByLabel("New password", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: "test-results/recovery-mobile.png",
      fullPage: true,
    });
    expect(page.url()).not.toContain("token=");
    const token = new URL(message.url).pathname.split("/").at(-1)!;
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: { action: "complete-reset", token, password: "short" },
        })
      ).status(),
    ).toBe(400);
    const nextPassword = "Replacement-password-for-recovery-42";
    await page.getByLabel("New password", { exact: true }).fill(nextPassword);
    await page.getByLabel("Confirm password").fill(nextPassword);
    await page
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Password reset");
    expect(
      (await page.request.get("/api/account/export", { headers })).status(),
    ).toBe(401);
    expect((await other.get("/api/account/export", { headers })).status()).toBe(
      401,
    );
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: { action: "complete-reset", token, password: nextPassword },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: { action: "signin", email: user.email, password },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: { action: "signin", email: user.email, password: nextPassword },
        })
      ).status(),
    ).toBe(200);
    await page.request.post("/api/auth", {
      headers: { origin },
      data: { action: "reset", email: user.email },
    });
    const expiredMessage = await testEmail(user.email, "recovery", message.url);
    const expiredToken = new URL(expiredMessage.url).pathname
      .split("/")
      .at(-1)!;
    const db = createClient({ url: "file:./data/e2e.db" });
    try {
      const result = await db.execute({
        sql: "UPDATE verification SET expiresAt = 0 WHERE identifier = ?",
        args: [`reset-password:${expiredToken}`],
      });
      expect(result.rowsAffected).toBe(1);
    } finally {
      db.close();
    }
    expect(
      (
        await page.request.post("/api/auth", {
          headers: { origin },
          data: {
            action: "complete-reset",
            token: expiredToken,
            password: nextPassword,
          },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await other.dispose();
  }
});

test("cross-tab account changes pause the workspace and preserve a dirty draft for device recovery", async ({
  page,
  context,
}) => {
  await page.goto("/builder");
  const user = await authenticateForExport(page);
  await page
    .evaluate(() => sessionStorage.setItem("cv-workspace", "account"))
    .catch(() => {});
  const doc = createDocument(true);
  doc.provenance = { purpose: "personal", origin: "import" };
  await page.request.post("/api/resumes", {
    headers: { origin, "X-Workspace-User": user.id },
    data: { document: doc, expectedRevision: null },
  });
  await page.goto("/builder");
  await openFirstCv(page);
  await page.route("**/api/resumes", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Draft kept after another tab signs out");
  await expect(page.locator(".save-status")).toHaveText("Save failed");
  const other = await context.newPage();
  await other.goto("/profile");
  await other.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep draft on this device" }),
  ).toBeVisible();
  await other.getByRole("button", { name: "Create account instead" }).click();
  await other
    .getByLabel("Email", { exact: true })
    .fill(`changed-${randomUUID()}@example.test`);
  await other.getByLabel("Password", { exact: true }).fill(password);
  await other
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(other.locator(".account-email")).toBeVisible();
  const changed = (await (await other.request.get("/api/account")).json()).user;
  expect(changed.id).not.toBe(user.id);
  expect(
    await (
      await other.request.get("/api/resumes", {
        headers: { "X-Workspace-User": changed.id },
      })
    ).json(),
  ).toEqual([]);
  expect(
    (
      await page.request.post("/api/resumes", {
        headers: { origin, "X-Workspace-User": user.id },
        data: { document: doc, expectedRevision: 0 },
      })
    ).status(),
  ).toBe(409);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Draft kept after another tab signs out",
  );
  await page.getByRole("button", { name: "Keep draft on this device" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Draft kept after another tab signs out",
  );
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await page.reload();
  await openFirstCv(page);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Draft kept after another tab signs out",
  );
});

test("an expired session keeps the draft and original-account sign-in can retry saving", async ({
  page,
}) => {
  await page.goto("/builder");
  const user = await authenticateForExport(page);
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "account"));
  const doc = createDocument(true);
  doc.provenance = { purpose: "personal", origin: "import" };
  await page.request.post("/api/resumes", {
    headers: { origin, "X-Workspace-User": user.id },
    data: { document: doc, expectedRevision: null },
  });
  await page.reload();
  await openFirstCv(page);
  await page.route("**/api/resumes", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Draft kept while session expires");
  await expect(page.locator(".save-status")).toHaveText("Save failed");
  const db = createClient({ url: "file:./data/e2e.db" });
  try {
    await db.execute({
      sql: "UPDATE session SET expiresAt=0 WHERE userId=?",
      args: [user.id],
    });
  } finally {
    db.close();
  }
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Restore account session" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore account session" }).click();
  await page
    .locator(".account-panel")
    .getByLabel("Email", { exact: true })
    .fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".account-email")).toHaveText(user.email);
  await page.getByRole("button", { name: "Close account settings" }).click();
  await page.unroute("**/api/resumes");
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Draft kept while session expires",
  );
  await page.reload();
  await openFirstCv(page);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Draft kept while session expires",
  );
});
