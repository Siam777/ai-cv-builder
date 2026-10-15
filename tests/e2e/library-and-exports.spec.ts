import { editorTool } from "./helpers";
import { expect, test } from "@playwright/test";
import { createDocument } from "../../src/lib/document";
import { readFile } from "node:fs/promises";
import {
  authenticateForExport,
  openFirstCv,
  startSampleResume,
  verifyTestEmail,
} from "./helpers";

test("render failure preserves the draft without falling back to print", async ({ page }) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await authenticateForExport(page);
  await page.route("**/api/exports", route => route.fulfill({ status: 503, json: { error: "RENDER_FAILED", message: "Renderer unavailable. Retry export." } }));
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.locator(".export-menu summary").click();
  await page.getByRole("button", { name: "PDF Document (.pdf)" }).click();
  await expect(page.locator(".alert")).toContainText("Renderer unavailable");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Alex Morgan");
  await expect(page.locator('iframe[title="Authorized print preview"]')).toHaveCount(0);
  expect(downloads).toBe(0);
});

test("cover letter copy requires sign-in and Markdown uses reviewed edits", async ({ page }) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await editorTool(page, "Cover letter");
  await page.getByRole("button", { name: /Generate Grounded Cover Letter/ }).click();
  await page.locator(".letterhead-editable-body").fill("Reviewed letter with only my supported experience.");
  await page.getByRole("button", { name: "Copy to clipboard" }).click();
  await expect(page.locator(".account-panel")).toBeVisible();
  await page.getByRole("button", { name: "Close account settings" }).click();
  await authenticateForExport(page);
  await editorTool(page, "Cover letter");
  await page.getByRole("button", { name: /Generate Grounded Cover Letter/ }).click();
  await page.locator(".letterhead-editable-body").fill("Reviewed letter with only my supported experience.");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download.*md/ }).click();
  expect(await readFile((await (await downloading).path())!, "utf8")).toBe("Reviewed letter with only my supported experience.");
});

test("demo preview never saves; using its design creates a blank personal CV", async ({
  page,
}) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: "Browse example CVs" }).click();
  await page.locator(".demo-profile-card").first().getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("Read-only example");
  await page.getByRole("button", { name: "Close demo gallery" }).click();
  await expect(page.locator(".library-card")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await expect(page.locator(".library-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Browse example CVs" }).click();
  await page.locator(".demo-profile-card").first().getByRole("button").click();
  await page.getByRole("button", { name: "Use this design" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).not.toContainText("Siam");
  await page.getByLabel("Full name", { exact: true }).fill("My own identity");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My CVs" })
    .click();
  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(page.locator(".library-card")).toContainText("My own identity");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/library-mobile.png",
    fullPage: true,
  });
});

test("legacy records retain content and require explicit classification; practice duplicates stay separate", async ({
  page,
}) => {
  await page.goto("/builder");
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  const { provenance: _, ...legacy } = createDocument(true);
  legacy.contact.name = "Preserved legacy identity";
  await page.evaluate(async (document) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("cv-builder", 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("resumes", "readwrite");
        tx.objectStore("resumes").put(document);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, legacy);
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await expect(page.locator(".library-card")).toHaveCount(0);
  await page.getByRole("button", { name: /Review older drafts 1/ }).click();
  await expect(page.locator(".library-card")).toContainText(
    "Preserved legacy identity",
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Mark as my CV" }).click();
  await page
    .getByRole("navigation", { name: "Document collections" })
    .getByRole("button", { name: /On this device 1/ })
    .click();
  await openFirstCv(page);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    legacy.contact.name,
  );
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Northstar");
  await editorTool(page, "Create practice example");
  await page
    .getByRole("button", { name: "Create fictional practice CV" })
    .click();
  await expect(page.locator(".cv-kind")).toContainText("Practice");
  await editorTool(page, "Duplicate");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My CVs" })
    .click();
  await expect(page.locator(".library-card")).toHaveCount(1);
  await page.getByRole("button", { name: /Practice copies 2/ }).click();
  await expect(page.locator(".library-card")).toHaveCount(2);
});

test("signed-out export preserves edits and resumes chosen format after sign-in", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Draft kept through sign-in");
  await page.locator(".export-menu summary").click();
  await page
    .getByRole("button", { name: "Backup (.json)", exact: true })
    .click();
  await expect(page.locator(".account-panel")).toBeVisible();
  await page.getByRole("button", { name: "Create account instead" }).click();
  const email = `resume-${crypto.randomUUID()}@example.test`;
  await page
    .locator(".account-panel")
    .getByLabel("Email", { exact: true })
    .fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-account-password-42");
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Send verification email", exact: true })).toBeVisible();
  await verifyTestEmail(page.request, email);
  await page.getByRole("button", { name: "Refresh verification status" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Continue export" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Draft kept through sign-in",
  );
  await page.request.post("/api/auth", {
    headers: { origin: (process.env.E2E_ORIGIN || "http://localhost:3100") },
    data: { action: "signout" },
  });
  await page.locator(".export-menu summary").click();
  await page.getByRole("button", { name: "Plain text (.txt)" }).click();
  await expect(page.locator(".account-panel")).toBeVisible();
});

test("all export formats enforce sessions, ownership, consent and current revisions", async ({
  page,
  playwright,
}) => {
  test.setTimeout(90000);
  await page.goto("/builder");
  const user = await authenticateForExport(page);
  const headers = {
    origin: (process.env.E2E_ORIGIN || "http://localhost:3100"),
    "X-Workspace-User": user.id,
  };
  const doc = createDocument();
  doc.contact.name = "Authorized identity";
  const saved = await page.request.post("/api/resumes", {
    headers,
    data: { document: doc, expectedRevision: null },
  });
  expect(saved.status()).toBe(200);
  const source = { storage: "account", documentId: doc.id, revision: 0 };
  const requests = [
    ...["pdf", "docx", "html", "md", "txt", "json", "print"].map((format) => ({
      kind: "resume",
      source,
      format,
    })),
    ...["txt", "md", "copy", "print"].map((format) => ({
      kind: "letter",
      source,
      format,
      text: "Edited letter body",
      name: "My letter",
    })),
  ];
  const anon = await playwright.request.newContext({
    baseURL: (process.env.E2E_ORIGIN || "http://localhost:3100"),
  });
  const other = await playwright.request.newContext({ baseURL: (process.env.E2E_ORIGIN || "http://localhost:3100") });
  try {
    const signup = await other.post("/api/auth", { headers: { origin: headers.origin, "x-forwarded-for": "192.0.2.254" }, data: { action: "signup", email: `other-${crypto.randomUUID()}@example.test`, password: "Synthetic-account-password-42" } });
    expect(signup.status()).toBe(200);
    const otherUser = (await (await other.get("/api/account")).json()).user;
    await verifyTestEmail(other, otherUser.email);
    expect((await anon.get(`/api/billing/mock-success?user_id=${user.id}&plan_id=lifetime`)).status()).toBe(410);
    expect((await (await page.request.get("/api/billing/subscription")).json()).subscription.entitlements.watermark_free_export).toBe(false);
    for (const data of requests) {
      expect((await other.post("/api/exports", { headers: { ...headers, "X-Workspace-User": otherUser.id }, data })).status()).toBe(404);
      expect(
        (await anon.post("/api/exports", { headers, data })).status(),
      ).toBe(401);
      const response = await page.request.post("/api/exports", {
        headers,
        data,
      });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect((await response.body()).length).toBeGreaterThan(0);
      expect(
        (
          await page.request.post("/api/exports", {
            headers,
            data: {
              ...data,
              source: { ...source, documentId: "another-user-cv" },
            },
          })
        ).status(),
      ).toBe(404);
    }
    expect(
      (
        await anon.post("/api/resumes/export-pdf", {
          headers,
          data: requests[0],
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post("/api/exports", {
          headers: { ...headers, "X-Workspace-User": "another-user" },
          data: requests[1],
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.post("/api/exports", {
          headers,
          data: { ...requests[1], source: { ...source, revision: 99 } },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.post("/api/exports", {
          headers,
          data: {
            ...requests[1],
            source: { storage: "device", document: doc },
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post("/api/exports", {
          headers: { ...headers, origin: "https://untrusted.example" },
          data: requests[1],
        })
      ).status(),
    ).toBe(403);
    await page.request.post("/api/auth", {
      headers,
      data: { action: "signout" },
    });
    for (const data of requests)
      expect(
        (await page.request.post("/api/exports", { headers, data })).status(),
      ).toBe(401);
  } finally {
    await anon.dispose();
    await other.dispose();
  }
});
