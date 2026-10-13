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

// Reveal secondary editor actions through their user-facing disclosure.
export async function openEditorTools(page: Page) {
  const trigger = page.getByRole("button", { name: "More tools", exact: true });
  if (await trigger.isVisible() && await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.click();
  }
}
