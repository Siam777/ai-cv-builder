import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { startSampleResume, verifyTestEmail } from "./helpers";

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const emailUnconfigured = process.env.E2E_EMAIL === "unconfigured";

async function signUp(page: Page, verify: boolean) {
  const email = `workspace-${randomUUID()}@example.test`;
  const response = await page.request.post("/api/auth", {
    headers: {
      origin,
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: {
      action: "signup",
      email,
      password: "Synthetic-account-password-42",
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  if (verify) await verifyTestEmail(page.request, email);
  return email;
}

test("signed-in users open their account even after choosing this browser once", async ({
  page,
}) => {
  test.skip(emailUnconfigured, "Needs the email test outbox.");
  await page.goto("/builder");
  await expect(page.locator(".save-status")).toHaveText(
    "Saved in this browser",
  );
  await expect(
    page.getByRole("button", { name: "Sign in to back up" }),
  ).toBeVisible();
  await signUp(page, true);
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "device"));

  // The device request applies to one load, and the way back is one click.
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved in this browser",
  );
  await expect(page.locator(".avatar")).toHaveText("W");
  await page.getByRole("button", { name: "Open my account CVs" }).click();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );

  await page.reload();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  await expect(
    page.getByRole("button", { name: "Open my account CVs" }),
  ).toHaveCount(0);
});

test("without an email service, a signed-in unverified user can download a PDF", async ({
  page,
}) => {
  test.skip(!emailUnconfigured, "Run with E2E_EMAIL=unconfigured.");
  await page.goto("/builder");
  await startSampleResume(page);
  await signUp(page, false);
  const account = await (await page.request.get("/api/account")).json();
  expect(account.emailDelivery).toBe("unconfigured");
  expect(account.user.emailVerified).toBe(false);
  expect(account.user.canExport).toBe(true);
  page.on("dialog", (dialog) => dialog.accept());
  const download = page.waitForEvent("download");
  await page.locator("summary").click();
  await page.getByRole("button", { name: "PDF Document (.pdf)" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.locator(".account-panel")).toHaveCount(0);
});
