import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument, type ResumeDocument } from "../../src/lib/document";

// Editor fixtures are explicitly imported, never obtained by browsing public demos.
export async function startSampleResume(
  page: Page,
  fixture: ResumeDocument = createDocument(true),
) {
  fixture.provenance = { purpose: "personal", origin: "import" };
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page
    .getByRole("button", { name: "Restore as new", exact: true })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    fixture.contact.name,
  );
}

export async function openFirstCv(
  page: Page,
  collection?: "Practice copies" | "Review older drafts",
) {
  // A reload keeps the open CV (?cv= in the address); go to the list in the
  // same workspace (a new page load could switch workspace).
  if (new URL(page.url()).searchParams.has("cv")) {
    await expect(page.locator(".save-status")).not.toHaveText("Loading");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "My CVs" })
      .click();
  }
  if (collection)
    await page
      .getByRole("navigation", { name: "Document collections" })
      .getByRole("button", { name: new RegExp(collection) })
      .click();
  await page
    .getByRole("button", { name: "Open CV", exact: true })
    .first()
    .click();
}

export async function authenticateForExport(page: Page) {
  const email = `export-${randomUUID()}@example.test`;
  const response = await page.request.post("/api/auth", {
    headers: {
      origin: process.env.E2E_ORIGIN || "http://localhost:3100",
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: {
      action: "signup",
      email,
      password: "Synthetic-account-password-42",
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  await verifyTestEmail(page.request, email);
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "device"));
  page.on("dialog", (dialog) => dialog.accept());
  return (await (await page.request.get("/api/account")).json()).user as {
    id: string;
    email: string;
  };
}

export async function testEmail(
  email: string,
  kind: "verification" | "recovery",
  previousUrl?: string,
) {
  let found: { to: string; url: string; kind: string } | undefined;
  await expect
    .poll(async () => {
      const files = await readdir("data/auth-email-outbox").catch(() => []);
      for (const file of files.sort().reverse()) {
        const message = JSON.parse(
          await readFile(`data/auth-email-outbox/${file}`, "utf8"),
        );
        if (
          message.to === email &&
          message.kind === kind &&
          message.url !== previousUrl
        ) {
          found = message;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  return found!;
}

export async function verifyTestEmail(
  client: APIRequestContext,
  email: string,
) {
  const message = await testEmail(email, "verification");
  const response = await client.get(message.url);
  expect(response.ok()).toBe(true);
  expect(
    (await (await client.get("/api/account")).json()).user.emailVerified,
  ).toBe(true);
}

const CV_MENU = [
  "New",
  "Duplicate",
  "Import JSON",
  "History",
  "Mark as my CV",
  "Demo examples",
  "Practice CV (fictional)",
  "Delete this CV",
];
// The AI Assistant is one panel with four tabs.
const AI_TABS: Record<string, string> = {
  "Writing help": "Help me finish",
  "Match a job": "Match a job",
  "Cover letter": "Cover letter",
  "Ask the AI": "Ask the AI",
};

// Run an editor toolbar action, opening its menu first when it lives in one.
export async function editorTool(page: Page, name: string) {
  if (name === "Check") {
    await page.getByRole("button", { name: /^Check/ }).click();
    return;
  }
  if (name in AI_TABS) {
    const toggle = page.getByRole("button", {
      name: "AI Assistant",
      exact: true,
    });
    if ((await toggle.getAttribute("aria-pressed")) !== "true")
      await toggle.click();
    await page
      .getByRole("tab", { name: AI_TABS[name], exact: true })
      .click();
    return;
  }
  const menu = CV_MENU.includes(name) ? "CV options" : null;
  if (!menu) {
    await page.getByRole("button", { name, exact: true }).click();
    return;
  }
  await page.getByRole("button", { name: menu, exact: true }).click();
  await page
    .getByRole("menuitem", {
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    })
    .first()
    .click();
}

// How many CVs share the open CV's collection (the open one plus the switch list).
export async function cvCount(page: Page) {
  await page.getByRole("button", { name: "CV options", exact: true }).click();
  const count = await page.locator(".menu-item.cv-switch").count();
  await page.keyboard.press("Escape");
  return count + 1;
}

// Open account settings (or sign-in) from the account menu.
export async function openAccount(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page
    .getByRole("menuitem", { name: /^(Account settings|Sign in)/ })
    .click();
}

// Switch the account settings panel to one of its tabs.
export async function accountTab(
  page: Page,
  name: "Profile" | "Sign-in & security" | "Data & privacy" | "Billing",
) {
  await page
    .getByRole("tablist", { name: "Account sections" })
    .getByRole("tab", { name, exact: true })
    .click();
}

// Give a real test account Pro in the isolated e2e database, so server-side
// plan checks (such as AI job coaching) pass.
export async function grantProAccount(userId: string) {
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: "file:./data/e2e.db" });
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, created_at, updated_at)
          VALUES (?, ?, ?, NULL, 'pro', 'active', NULL, 0, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET plan_id = 'pro', status = 'active'`,
    args: [`sub_${randomUUID()}`, userId, `cus_e2e_${userId}`, now, now],
  });
  client.close();
}

// Show the free plan's locked states by default, and a paid plan on request.
export async function grantPaidPlan(page: Page) {
  await page.route("**/api/billing/subscription", (route) =>
    route.fulfill({
      json: {
        subscription: { planId: "pro", status: "active" },
        user: null,
      },
    }),
  );
}
