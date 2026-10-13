import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createDocument } from "../../src/lib/document";
import { exportToDocx } from "../../src/lib/exporters/docx-exporter";
import { startSampleResume, authenticateForExport } from "./helpers";
const origin = process.env.E2E_ORIGIN || "http://localhost:3100";

test("editor compares an authorized PDF and DOCX without changing the CV; upload requires consent", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/builder");
  const doc = createDocument(true);
  doc.presentation.template = "creative";
  await startSampleResume(page, doc);
  const owner = await authenticateForExport(page);
  const exports: { name: string; mimeType: string; buffer: Buffer }[] = [];
  for (const format of ["pdf", "docx"]) {
    const response = await page.request.post("/api/exports", {
      headers: { origin, "X-Workspace-User": owner.id },
      data: {
        kind: "resume",
        source: { storage: "device", document: doc, processingConsent: true },
        format,
      },
    });
    expect(response.status()).toBe(200);
    exports.push({
      name: `resume.${format}`,
      mimeType:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: await response.body(),
    });
  }
  await page.getByRole("button", { name: /^Check/ }).click();
  // The panel is docked on wide screens and a sheet on phones; the id is stable.
  const dialog = page.locator("#side-panel");
  await expect(dialog).toHaveAccessibleName("Check my CV");
  await dialog
    .getByRole("button", { name: "File diagnostics", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Check this file" }),
  ).toBeDisabled();
  await dialog.getByLabel("File to check").setInputFiles(exports[0]);
  await expect(
    dialog.getByRole("button", { name: "Check this file" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Send this file and the current CV for comparison")
    .check();
  for (const fixture of exports) {
    await dialog.getByLabel("File to check").setInputFiles(fixture);
    await dialog.getByRole("button", { name: "Check this file" }).click();
    const result = dialog.getByRole("region", {
      name: "File diagnostic results",
    });
    await expect(result).toContainText("0 missing, 0 out of sequence");
    await expect(result).toContainText(
      "Visual layout and font rendering · Not checked",
    );
    await expect(result.getByLabel("Extracted file text")).toHaveValue(
      new RegExp(doc.contact.name),
    );
    await result.getByText("File and analysis record", { exact: true }).click();
    await expect(result).toContainText("2026-10-11.q4.1");
  }
  await dialog
    .getByRole("heading", { name: "Actual file observations" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/file-diagnostics-desktop.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  await dialog
    .getByRole("heading", { name: "Actual file observations" })
    .scrollIntoViewIfNeeded();
  expect(
    await dialog
      .locator(".ats-content")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "test-results/file-diagnostics-mobile.png" });
  await dialog.getByRole("button", { name: "Close Check my CV" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    doc.contact.name,
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    doc.contact.email,
  );
});

test("public DOCX review previews actual text and leaves source comparison unchecked", async ({
  page,
}) => {
  const doc = createDocument(true);
  doc.contact.name = "Fictional Diagnostic Candidate";
  await page.goto("/grader");
  await page.locator("#resume-file").setInputFiles({
    name: "candidate.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(exportToDocx(doc)),
  });
  await page.getByRole("button", { name: "Review resume content" }).click();
  const result = page.getByRole("region", { name: "File diagnostic results" });
  await expect(result).toContainText("Source text and order · Not checked");
  await expect(result.getByLabel("Extracted file text")).toContainText(
    doc.contact.name,
  );
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/file-reviewer-mobile.png",
    fullPage: true,
  });
});

test("diagnostic API enforces consent, origin, type and limits; empty PDFs never become successful imports", async ({
  request,
}) => {
  const doc = createDocument(true);
  const headers = { origin, "x-forwarded-for": "198.51.100.221" };
  const fixture = {
    name: "candidate.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Candidate\nCandidate@example.com"),
  };
  const noConsent = await request.post("/api/diagnostics/file", {
    headers,
    multipart: { file: fixture, expectedDocument: JSON.stringify(doc) },
  });
  expect(noConsent.status()).toBe(400);
  expect((await noConsent.json()).error).toBe("CONSENT_REQUIRED");
  const cross = await request.post("/api/diagnostics/file", {
    headers: { origin: "https://untrusted.example" },
    multipart: { file: fixture },
  });
  expect(cross.status()).toBe(403);
  const crossImport = await request.post("/api/resumes/import-file", {
    headers: { origin: "https://untrusted.example" },
    multipart: { file: fixture },
  });
  expect(crossImport.status()).toBe(403);
  const wrong = await request.post("/api/diagnostics/file", {
    headers,
    multipart: { file: { ...fixture, name: "fake.pdf" } },
  });
  expect(wrong.status()).toBe(422);
  const invalid = await request.post("/api/diagnostics/file", {
    headers,
    multipart: {
      file: fixture,
      expectedDocument: "{}",
      processingConsent: "true",
    },
  });
  expect(invalid.status()).toBe(400);
  const large = await request.post("/api/diagnostics/file", {
    headers,
    multipart: { file: { ...fixture, buffer: Buffer.alloc(5_000_001) } },
  });
  expect(large.status()).toBe(413);
  const emptyFile = {
    name: "empty.pdf",
    mimeType: "application/pdf",
    buffer: await readFile("tests/fixtures/diagnostics-empty.pdf"),
  };
  const empty = await request.post("/api/diagnostics/file", {
    headers,
    multipart: { file: emptyFile },
  });
  expect(empty.status()).toBe(200);
  expect(empty.headers()["cache-control"]).toContain("no-store");
  const report = await empty.json();
  expect(report.text).toBe("");
  expect(
    report.checks.find((c: { id: string }) => c.id === "text").status,
  ).toBe("issue");
  const imported = await request.post("/api/resumes/import-file", {
    headers,
    multipart: { file: emptyFile },
  });
  expect(imported.status()).toBe(422);
  const encrypted = await request.post("/api/diagnostics/file", {
    headers,
    multipart: {
      file: {
        ...emptyFile,
        name: "encrypted.pdf",
        buffer: await readFile("tests/fixtures/diagnostics-encrypted.pdf"),
      },
    },
  });
  expect(encrypted.status()).toBe(422);
  expect((await encrypted.json()).error).toBe("ENCRYPTED");
});
