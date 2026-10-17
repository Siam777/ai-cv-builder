import { test, expect } from "@playwright/test";
import { createDocument } from "../../src/lib/document";
import { renderResumePdf } from "../../src/lib/server/pdf-generator";
import { startSampleResume } from "./helpers";

test("unsupported roles stay general and checklist changes require renewed confirmation", async ({
  page,
}) => {
  await page.goto("/builder");
  const doc = createDocument(true);
  doc.contact.headline = "Civil Engineer";
  await startSampleResume(page, doc);
  await page.getByRole("button", { name: /^Check/ }).click();
  // The panel is docked on wide screens and a sheet on phones; the id is stable.
  const dialog = page.locator("#side-panel");
  await expect(dialog).toHaveAccessibleName("Check my CV");
  await dialog
    .getByRole("tab", { name: "Compare with a role" })
    .click();
  await expect(dialog.getByLabel("Role checklist")).toHaveValue("general");
  await expect(dialog.locator(".role-section-head")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Review selected checklist" })
    .click();
  await expect(dialog).toContainText("No role-specific checklist is available");
  await dialog.getByLabel("Role checklist").selectOption("software-engineer");
  await expect(dialog.locator(".role-section-head")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Review selected checklist" })
    .click();
  await expect(dialog).toContainText("Software Engineer · Term observations");
  await expect(dialog.locator(".add-skill-action-btn")).toHaveCount(0);
  await dialog.getByRole("button", { name: /^Advanced/ }).click();
  await dialog.getByRole("button", { name: "Document text view" }).click();
  await expect(dialog).toContainText("Not checked");
  await expect(dialog).toContainText("not text extracted from a PDF");
  await page.setViewportSize({ width: 360, height: 800 });
  await dialog
    .getByRole("tab", { name: "Compare with a role" })
    .click();
  expect(
    await dialog
      .locator(".check-panel")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "test-results/analyzer-mobile.png" });
  await dialog.getByRole("button", { name: "Close Check my CV" }).click();
  await expect(page.getByLabel("Professional headline")).toHaveValue(
    "Civil Engineer",
  );
});

test("public uploads disclose processing and reports leave file checks unknown", async ({
  page,
  request,
}) => {
  await page.goto("/grader");
  await expect(page.locator(".file-hint")).toContainText(
    "sent to this application server",
  );
  await page.locator("#resume-file").setInputFiles({
    name: "candidate.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Alex Morgan\nalex@example.com\n\nEXPERIENCE\nEngineer | Company\n- Built internal reporting dashboards for customer support teams",
    ),
  });
  await page.getByRole("button", { name: "Review resume content" }).click();
  await expect(page.locator(".import-warnings")).toContainText(
    "Review the parsed content",
  );
  await expect(page.locator(".metric-mini-cards")).toContainText("Not checked");
  await expect(page.locator(".primary-score .score-number")).not.toContainText(
    "%",
  );
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/reviewer-mobile.png",
    fullPage: true,
  });
  const unsupported = await request.post("/api/resumes/import-file", {
    headers: { origin: process.env.E2E_ORIGIN || "http://localhost:3100" },
    multipart: {
      file: {
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from("{}"),
      },
    },
  });
  expect(unsupported.status()).toBe(415);
  const pdf = await request.post("/api/resumes/import-file", {
    headers: { origin: process.env.E2E_ORIGIN || "http://localhost:3100" },
    multipart: {
      file: {
        name: "fixture.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await renderResumePdf(createDocument(true))),
      },
    },
  });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect((await pdf.json()).warnings.join(" ")).toContain(
    "visual reading order and ATS acceptance are not verified",
  );
});
