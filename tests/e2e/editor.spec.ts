import { openEditorTools } from "./helpers";
import { getDemoResume } from "../../src/lib/demo-resumes";
import {
  startSampleResume,
  openFirstCv,
  authenticateForExport,
} from "./helpers";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createDocument } from "../../src/lib/document";

test("creation, save/reload, independent variants, undo, imports and exports", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Alex Morgan");
  await page.getByLabel("Full name", { exact: true }).fill("নাদিয়া Morgan");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await openFirstCv(page);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "নাদিয়া Morgan",
  );
  await openEditorTools(page);
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Variant Name");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "নাদিয়া Morgan",
  );
  await page.getByLabel("Full name", { exact: true }).fill("Variant Name");
  await page
    .getByLabel("Resume", { exact: true })
    .selectOption({ label: "Alex Morgan · Product designer" });
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "নাদিয়া Morgan",
  );
  await page.getByRole("button", { name: /03 Experience/ }).click();
  await page.getByLabel("Show in resume").uncheck();
  await expect(page.getByRole("article")).not.toContainText("Northstar");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("article")).toContainText("Northstar");
  await page.getByLabel("Page size").selectOption("Letter");
  await page.locator("summary").click();
  await authenticateForExport(page);
  const backupDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Backup (.json)", exact: true })
    .click();
  const backup = await backupDownload;
  const path = await backup.path();
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(page.locator(".alert")).toContainText("not a supported");
  await expect(page.getByRole("article")).toContainText("নাদিয়া Morgan");
  await page.getByLabel("Import JSON backup").setInputFiles(path!);
  await page.getByRole("button", { name: "Restore as new" }).click();
  await expect(page.locator("#resume-select option")).toHaveCount(3);
  await expect(page.getByLabel("Page size")).toHaveValue("Letter");
  await page.screenshot({
    path: "test-results/studio-desktop.png",
    fullPage: true,
  });
  await page.pdf({
    path: "test-results/resume-letter.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.getByLabel("Page size").selectOption("A4");
  await page.pdf({
    path: "test-results/resume-a4.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Preview resume" }).click();
  await expect(page.getByRole("article")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/studio-mobile.png",
    fullPage: true,
  });
});

test("concurrent tab edits cannot overwrite saved content", async ({
  page,
  context,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  const other = await context.newPage();
  await other.goto("/builder");
  await openFirstCv(other);
  await expect(other.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
  await page.getByLabel("Full name", { exact: true }).fill("First writer");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await other.getByLabel("Full name", { exact: true }).fill("Stale writer");
  await expect(other.locator(".alert")).toContainText("another tab");
  await page.reload();
  await openFirstCv(page);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "First writer",
  );
});

test("blank editor supports all sections, ordering, replacement undo and long exports", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/builder");
  await page.getByRole("button", { name: "Create my resume" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Zoë Example");
  for (const name of [
    "Profile",
    "Experience",
    "Education",
    "Skills",
    "Projects",
    "Certifications",
    "Languages",
  ]) {
    await page
      .locator(".section-nav")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await page
      .getByRole("button", { name: /^\+ Add (entry|experience)$/ })
      .click();
    if (name === "Profile")
      await page
        .getByLabel("Professional summary")
        .fill("A careful introduction.");
    else {
      await page
        .getByLabel(
          name === "Experience"
            ? "Job title"
            : name === "Education"
              ? "Degree or qualification"
              : "Title",
          { exact: true },
        )
        .fill(`${name} evidence`);
      await page
        .getByLabel("Description", { exact: true })
        .fill(`Details for ${name}.`);
    }
  }
  await page.getByLabel("Section heading").fill("Spoken languages");
  await page
    .getByRole("button", { name: "Move section up", exact: true })
    .click();
  await expect(page.getByRole("article").locator("h2").nth(5)).toHaveText(
    "Spoken languages",
  );
  await page.getByRole("button", { name: "Remove entry", exact: true }).click();
  await expect(page.getByRole("article")).not.toContainText(
    "Languages evidence",
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("article")).toContainText("Languages evidence");
  await page.locator("summary").click();
  await authenticateForExport(page);
  const textDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Plain text (.txt)" }).click();
  expect(
    await readFile((await (await textDownload).path())!, "utf8"),
  ).toContain("Zoë Example");
  const replacement = createDocument(true);
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await page.getByRole("button", { name: "Replace active content" }).click();
  await expect(page.getByRole("article")).toContainText("Alex Morgan");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("article")).toContainText("Zoë Example");
  const longText = Array.from(
    { length: 55 },
    (_, i) =>
      `Research note ${i + 1}: Collaborated with the team to document workflows and explain design decisions clearly.`,
  ).join("\n");
  await page
    .locator(".section-nav")
    .getByRole("button", { name: /Experience/ })
    .click();
  await page.getByLabel("Description", { exact: true }).fill(longText);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.pdf({
    path: "test-results/resume-long-a4.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.getByLabel("Page size").selectOption("Letter");
  await page.pdf({
    path: "test-results/resume-long-letter.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test("reviewed job evidence creates an isolated fact-preserving variant and supports undo", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await openEditorTools(page);
  await page.getByRole("button", { name: "🎯 Tailor for job" }).click();
  await page.getByLabel("Target Job Title").fill("Senior Product Designer");
  await page.getByLabel("Company Name").fill("Acme Corp");
  await page
    .getByLabel("Job Description", { exact: true })
    .fill(
      "Requirements:\n• Experience with prototyping\n• Proficiency in Figma\n• Required: Kubernetes",
    );
  await expect(
    page.getByRole("button", { name: /Analyze & Match Evidence/ }),
  ).toBeDisabled();
  await page.getByLabel("Use this target role, seniority and language").check();
  await page.getByRole("button", { name: /Analyze & Match Evidence/ }).click();
  await expect(
    page.getByRole("region", { name: "Requirement coverage" }),
  ).toContainText("1 direct");
  await expect(
    page.getByRole("region", { name: "Job criteria and CV excerpts" }),
  ).toContainText("Not found in this CV");
  await expect(
    page.getByRole("button", { name: "Create reviewed variant" }),
  ).toBeDisabled();
  await page
    .getByLabel("Accept ordering for Product Designer", { exact: true })
    .check();
  await page
    .getByLabel(
      "I reviewed the job priorities and CV excerpts supporting the selected changes",
    )
    .check();
  await page.getByRole("button", { name: "Create reviewed variant" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#resume-select option")).toHaveCount(2);
  await expect(page.getByLabel("Resume", { exact: true })).toContainText(
    "Tailored",
  );
  await page
    .getByRole("button", { name: "Undo reviewed variant creation" })
    .click();
  await expect(page.locator("#resume-select option")).toHaveCount(1);
  await expect(page.getByLabel("Resume", { exact: true })).not.toContainText(
    "Tailored",
  );
});

test("ATS readiness inspector audits content, displays metrics, and previews plain-text stream", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Check that ATS pill is visible in header
  const atsPill = page.getByRole("button", { name: "Review writing" });
  await expect(atsPill).toBeVisible();
  await atsPill.click();

  // Audit modal opens
  await expect(
    page.getByRole("dialog", { name: "Resume content review" }),
  ).toBeVisible();
  // The review opens on the explained score; findings are one tab away.
  await expect(page.locator(".score-report")).toBeVisible();
  await page.getByRole("button", { name: /Writing findings/ }).click();
  await expect(page.locator(".big-score")).toBeVisible();
  await expect(page.locator(".ats-metrics-breakdown")).toContainText(
    "Not checked",
  );
  await expect(page.locator(".big-score")).not.toContainText("%");
  await expect(page.locator(".ats-metrics-breakdown")).toContainText(
    "Vague openings",
  );

  // Applied role banner calibrates to candidate's applied role (Product Designer)
  await page
    .getByRole("button", { name: "Role checklist", exact: true })
    .click();
  await expect(page.locator(".applied-role-banner")).toBeVisible();
  await expect(page.locator(".applied-role-name")).toContainText(
    /Product|Designer/i,
  );
  await expect(page.locator(".role-chip-btn.applied-chip")).toBeVisible();

  // Switch to plain text robot view
  await page.getByRole("button", { name: "Document text view" }).click();
  await expect(page.locator(".plaintext-terminal")).toContainText(
    "ALEX MORGAN",
  );
  await expect(page.locator(".plaintext-terminal")).toContainText("EXPERIENCE");

  // Close modal
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("CV Analyzer calibrates strictly to CV applied role (Digital Growth & Marketing Lead)", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page, getDemoResume("sharya-singh")!);

  // Open Role Benchmark & Gaps
  await openEditorTools(page);
  await page.getByRole("button", { name: "Role Benchmark & Gaps" }).click();
  await expect(
    page.getByRole("dialog", { name: "Resume content review" }),
  ).toBeVisible();

  // Applied CV role banner must explicitly display candidate's applied role
  await page
    .getByRole("button", { name: "Role checklist", exact: true })
    .click();
  const appliedBanner = page.locator(".applied-role-banner");
  await expect(appliedBanner).toBeVisible();
  await expect(appliedBanner.locator(".applied-role-name")).toHaveText(
    "Digital Growth & Web Marketing Lead",
  );

  // Benchmark dropdown must automatically calibrate to marketing-lead
  const roleSelect = page.locator("#target-role-select");
  await expect(roleSelect).toHaveValue("marketing-lead");

  // Applied role chip must be active
  await expect(page.locator(".role-chip-btn.applied-chip")).toHaveClass(
    /active/,
  );

  await expect(page.locator(".role-section-head")).toHaveCount(0);
  await page.getByRole("button", { name: "Review selected checklist" }).click();
  // Confirm the suggested checklist before displaying term observations.
  await expect(page.locator(".role-analyzer-stage")).toContainText(
    "Digital Growth & Marketing Lead · Term observations",
  );
  await expect(page.locator(".role-analyzer-stage")).not.toContainText(
    "Software Engineer Fit",
  );

  // Take screenshot for visual audit
  await page.screenshot({
    path: "test-results/cv_analyzer_applied_role_calibrated.png",
  });

  // Close modal
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Pricing modal displays commercial tiers, entitlement benefits, and initiates checkout", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Click Upgrade pill in header
  const upgradeBtn = page.getByRole("button", { name: /Upgrade/ });
  await expect(upgradeBtn).toBeVisible();
  await upgradeBtn.click();

  // Pricing dialog should open
  const dialog = page.getByRole("dialog", { name: "Subscription Pricing" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Free / Local");
  await expect(dialog).toContainText("Monthly Pass");
  await expect(dialog).toContainText("Power Pass");

  // Clicking an upgrade button while in local mode redirects to account sign in
  await page
    .getByRole("button", { name: /Upgrade to Job Hunter Pass/ })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Account and storage" }),
  ).toBeVisible();

  // Close account modal
  await page.getByRole("button", { name: "Close account settings" }).click();
  await expect(
    page.getByRole("region", { name: "Account and storage" }),
  ).toHaveCount(0);
});

test("Public ATS Grader lead magnet audits resume, displays matches, and transfers to studio", async ({
  page,
}) => {
  await page.goto("/grader");
  await expect(
    page.getByRole("heading", { name: "How good is your resume?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.locator(".resume-textarea")).toContainText("Alex Morgan");
  await expect(page.locator(".job-textarea")).toContainText(
    "Staff Full-Stack Engineer",
  );

  // Run the review
  await page.getByRole("button", { name: /Review resume content/ }).click();

  // Score, benchmarks and gap analysis lead the report
  await expect(page.locator(".report-top-banner")).toContainText("Alex Morgan");
  await expect(page.locator(".score-dial").first()).toContainText("/100");
  await expect(page.locator(".score-fixes")).toContainText("Fix these first");
  await expect(page.locator(".score-benchmarks")).toContainText(
    "How you compare",
  );
  await expect(page.locator(".gap-report")).toContainText("Gap analysis");
  await expect(page.locator(".gap-report")).toContainText("What to do next");
  // Skills are not reported as short accomplishment bullets
  await expect(page.locator(".issue-list")).not.toContainText(
    "Bullet is very short (1 words)",
  );

  // Detailed observations remain available
  await expect(page.locator(".primary-score .score-number")).toHaveText(
    /^[0-9]+$/,
  );
  await expect(page.locator(".metric-mini-cards")).toContainText("Not checked");
  await expect(page.locator(".plain-text-terminal")).toContainText(
    "ALEX MORGAN",
  );

  // Transfer to studio
  await page.getByRole("button", { name: /Open in Resume Studio/ }).click();

  // Should navigate to /builder and load Alex Morgan in the editor
  await expect(page).toHaveURL("/builder");
  await expect(
    page.getByRole("heading", { name: "Your CVs, clearly organized." }),
  ).toBeVisible();
  await openFirstCv(page, "Practice copies");
  await expect(page.locator("#resume-select")).toContainText("Alex Morgan");
});

test("Expanded exporters (HTML, DOCX, Markdown, PDF, TXT, JSON) generate valid export files", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  await authenticateForExport(page);
  // Test Direct PDF download
  await page.locator("summary").click();
  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF Document (.pdf)" }).click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(pdfDownload.suggestedFilename()).not.toMatch(/^[0-9a-f-]{36}$/i); // Must not be raw UUID without extension

  // Test HTML download
  await page.locator("summary").click();
  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Standalone HTML (.html)" }).click();
  const htmlDownload = await htmlDownloadPromise;
  expect(htmlDownload.suggestedFilename()).toMatch(/\.html$/i);

  // Test DOCX download
  await page.locator("summary").click();
  const docxDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Word Document (.docx)" }).click();
  const docxDownload = await docxDownloadPromise;
  expect(docxDownload.suggestedFilename()).toMatch(/\.docx$/i);

  // Test Markdown download
  await page.locator("summary").click();
  const mdDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown (.md)" }).click();
  const mdDownload = await mdDownloadPromise;
  expect(mdDownload.suggestedFilename()).toMatch(/\.md$/i);

  // Test Plain Text download
  await page.locator("summary").click();
  const txtDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Plain text (.txt)" }).click();
  const txtDownload = await txtDownloadPromise;
  expect(txtDownload.suggestedFilename()).toMatch(/\.txt$/i);

  // Test Backup JSON download
  await page.locator("summary").click();
  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup (.json)" }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/i);
});

test("Automated Cover Letter Generator creates grounded letter with 1-click export", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Click Cover Letter button in toolbar
  await openEditorTools(page);
  const coverLetterBtn = page.getByRole("button", { name: "✉️ Cover letter" });
  await expect(coverLetterBtn).toBeVisible();
  await coverLetterBtn.click();

  // Dialog should open
  const modal = page.getByRole("dialog", {
    name: "Tailored Cover Letter Generator",
  });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Tailored Cover Letter Generator");

  // Fill in target role and company
  await modal
    .getByPlaceholder(/Staff Software Engineer/)
    .fill("Lead Product Designer");
  await modal.getByPlaceholder(/Stripe/).fill("Acme Corp");

  // Click Generate
  await modal
    .getByRole("button", { name: /Generate Grounded Cover Letter/ })
    .click();

  // Verify generated preview
  await expect(modal).toContainText(
    "Letter for Lead Product Designer at Acme Corp",
  );
  const textarea = modal.locator("textarea");
  await expect(textarea).toBeVisible();
  const letterContent = await textarea.inputValue();
  expect(letterContent).toContain("Acme Corp");
  expect(letterContent).toContain("Lead Product Designer");
  expect(letterContent).toContain("Alex Morgan");

  await authenticateForExport(page);
  // Test download .txt from modal
  const txtDownloadPromise = page.waitForEvent("download");
  await modal.getByRole("button", { name: "Download .txt" }).click();
  const txtDownload = await txtDownloadPromise;
  expect(txtDownload.suggestedFilename()).toMatch(/\.txt$/i);

  // Close modal
  await modal.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Preview zoom controls adjust scale and support fit to width", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Verify zoom controls bar
  const zoomBar = page.locator(".preview-zoom-bar");
  await expect(zoomBar).toBeVisible();

  const percentageSpan = zoomBar.locator(".zoom-percentage");
  const initialPercentText = await percentageSpan.innerText();

  // Click Zoom In (+)
  await zoomBar.getByRole("button", { name: "Zoom in" }).click();
  const zoomedInText = await percentageSpan.innerText();
  expect(parseInt(zoomedInText)).toBeGreaterThanOrEqual(
    parseInt(initialPercentText),
  );

  // Click Fit button
  const fitBtn = zoomBar.getByRole("button", { name: "Fit" });
  await expect(fitBtn).toBeVisible();
  await fitBtn.click();
  await expect(fitBtn).toHaveCount(0);
});

test("Version history modal creates checkpoints and forks variants", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Click History button
  await openEditorTools(page);
  const historyBtn = page.getByRole("button", { name: /History/ });
  await expect(historyBtn).toBeVisible();
  await historyBtn.click();

  // Dialog opens
  const historyDialog = page.getByRole("dialog", {
    name: "Resume Version History",
  });
  await expect(historyDialog).toBeVisible();

  // Save a new checkpoint
  await historyDialog
    .getByPlaceholder(/Name this checkpoint/)
    .fill("Milestone Checkpoint A");
  await historyDialog
    .getByRole("button", { name: "+ Save Checkpoint" })
    .click();

  // Verify checkpoint appears in timeline
  await expect(historyDialog.locator(".snapshots-list")).toContainText(
    "Milestone Checkpoint A",
  );

  // Fork as variant
  await historyDialog
    .getByRole("button", { name: "Fork Variant" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Selector should now include the forked variant
  await expect(page.locator("#resume-select")).toContainText("Restored from");
});

test("Cold-start dropzone ingests and parses LinkedIn Positions.csv", async ({
  page,
}) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: "Import my CV" }).click();
  const linkedInPositionsCsv = `Company Name,Title,Location,Started On,Finished On,Description\n"Vercel, Inc.","Principal Engineer","Remote","Jan 2022",,"• Architected Next.js performance optimizations\n• Shipped edge runtime features"`;

  await page.getByLabel("Upload existing resume").setInputFiles({
    name: "Positions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(linkedInPositionsCsv),
  });

  // Import Review modal should open
  const reviewModal = page.locator(".import-review");
  await expect(reviewModal).toBeVisible();
  await expect(reviewModal).toContainText("Positions");

  // Confirm import
  await page.getByRole("button", { name: "Restore as new" }).click();
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Principal Engineer");
});

test("Custom sections: add preset section, edit entry, save to library, preview, and undo removal", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Click "+ Add section" in sidebar
  const addSecBtn = page.getByRole("button", { name: /Add section/ });
  await expect(addSecBtn).toBeVisible();
  await addSecBtn.click();

  // Modal opens
  const addSecModal = page.getByRole("dialog", {
    name: "Add Section to Resume",
  });
  await expect(addSecModal).toBeVisible();

  // Pick "Speaking & Conferences" preset
  const speakingCard = addSecModal
    .locator(".preset-card")
    .filter({ hasText: "Speaking & Conferences" });
  await expect(speakingCard).toBeVisible();
  await speakingCard.getByRole("button").click();

  // Modal should close and editor should display the new section
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".panel-heading h2")).toHaveText(
    "Speaking & Conferences",
  );

  // Starter example should be populated
  await expect(page.locator("input[value*='Keynote Speaker']")).toBeVisible();

  // Click Save to Library
  const saveLibraryBtn = page.getByRole("button", {
    name: "Save section to library",
  });
  await saveLibraryBtn.click();
  await expect(
    page.getByRole("button", { name: "Saved to library" }),
  ).toBeVisible();

  // Live preview should render Speaking & Conferences
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Speaking & Conferences");
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Zero-Downtime Microservices");

  // Remove section
  page.on("dialog", (dialog) => dialog.accept());
  const removeSecBtn = page.getByRole("button", { name: "Remove section" });
  await removeSecBtn.click();

  // Section should be removed from preview
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).not.toContainText("Speaking & Conferences");

  // Click Undo to restore section
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Speaking & Conferences");
});

test("Skills taxonomy: autocomplete search, tag chips, category filters, and live preview sync", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Navigate to Skills section
  await page
    .locator(".section-nav")
    .getByRole("button", { name: /Skills/ })
    .click();

  await expect(page.locator(".skill-entry-editor")).toBeVisible();

  // Check existing skills chips
  const chipsCloud = page.locator(".skill-chips-cloud");
  await expect(chipsCloud).toBeVisible();
  await expect(chipsCloud).toContainText("Product strategy");
  await expect(chipsCloud).toContainText("Figma");

  // Filter by Backend & Systems category
  await page
    .locator(".skill-category-pill")
    .filter({ hasText: "Backend & Systems" })
    .click();

  // Search for PostgreSQL
  const searchInput = page.getByRole("textbox", { name: "Search skills" });
  await searchInput.fill("postg");

  // Autocomplete dropdown opens
  const dropdown = page.locator(".skill-autocomplete-dropdown");
  await expect(dropdown).toBeVisible();
  await expect(dropdown).toContainText("PostgreSQL");

  // Click PostgreSQL option to add it
  await dropdown
    .locator(".skill-dropdown-item")
    .filter({ hasText: "PostgreSQL" })
    .click();

  // Chip should now appear in added skills
  await expect(chipsCloud).toContainText("PostgreSQL");

  // Live preview should render PostgreSQL
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("PostgreSQL");

  // Add a recommended skill from suggestions
  const suggestedBtn = page
    .locator(".suggested-chip-btn")
    .filter({ hasText: "Node.js" })
    .first();
  if (await suggestedBtn.isVisible()) {
    await suggestedBtn.click();
    await expect(chipsCloud).toContainText("Node.js");
    await expect(
      page.getByRole("article", { name: "Resume preview" }),
    ).toContainText("Node.js");
  }

  // Remove a skill chip (e.g. PostgreSQL)
  const postgresChip = chipsCloud
    .locator(".skill-chip")
    .filter({ hasText: "PostgreSQL" });
  await postgresChip.locator(".skill-chip-remove").click();

  // PostgreSQL should be gone from chips and preview
  await expect(chipsCloud).not.toContainText("PostgreSQL");
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).not.toContainText("PostgreSQL");
});

test("Contextual AI Assistant: summary drafting, impact interview, and skill discovery", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Open AI assistant
  await openEditorTools(page);
  await page
    .getByRole("button", { name: "AI bullet assistant", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "AI bullet assistant" }),
  ).toBeVisible();

  // Switch to Summary Drafter tab
  await page.getByRole("tab", { name: "Write a summary" }).click();
  await expect(page.locator(".ai-summary-drafter")).toBeVisible();
  await expect(page.locator(".ai-summary-card")).toHaveCount(3);
  await expect(page.locator(".ai-summary-card").first()).toContainText(
    "Results from your CV",
  );

  // Click Review this draft on the first card
  await page
    .locator(".ai-summary-card")
    .first()
    .getByRole("button", { name: "Review this draft" })
    .click();
  await page
    .getByLabel("I checked this summary against my own experience.")
    .check();
  await page.getByRole("button", { name: "Use this summary" }).click();
  await expect(page.locator(".account-message")).toContainText(
    "Summary added to Profile",
  );

  // Switch to Impact Interview tab
  await page.getByRole("tab", { name: "Add a real result" }).click();
  await expect(page.locator(".ai-interview-container")).toBeVisible();

  // If there are interview questions, test answering one
  const questionCards = page.locator(".ai-interview-card");
  if ((await questionCards.count()) > 0) {
    const firstQ = questionCards.first();
    await firstQ
      .getByLabel("Your documented result")
      .fill("The team reused the report for its weekly review.");
    await firstQ
      .getByRole("button", { name: "Preview updated bullet" })
      .click();
    await expect(firstQ.locator(".ai-interview-diff")).toBeVisible();
    await firstQ
      .getByLabel("This result is accurate and belongs to this work.")
      .check();
    await firstQ.getByRole("button", { name: "Use this bullet" }).click();
  }

  // Switch to Skill Discovery tab
  await page.getByRole("tab", { name: "Find skills" }).click();
  await expect(page.locator(".ai-skills-discovery")).toBeVisible();

  // Close AI assistant modal
  await page.getByRole("button", { name: "Close AI assistant" }).click();
  await expect(
    page.getByRole("region", { name: "AI bullet assistant" }),
  ).toHaveCount(0);

  // Resume preview should reflect the applied summary
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Experience:");
});

test("Studio Accessibility: global keyboard shortcuts (?, Esc, Ctrl+Z) and shortcuts cheat sheet", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");

  // Open shortcuts modal via header pill button
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  await expect(
    page.getByRole("dialog", { name: "Keyboard Navigation & Actions" }),
  ).toBeVisible();
  await expect(page.locator(".shortcuts-content")).toContainText(
    "Bullet List Flow",
  );

  // Close shortcuts modal via Escape key
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Keyboard Navigation & Actions" }),
  ).toHaveCount(0);

  // Open shortcuts modal via '?' key
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: "Keyboard Navigation & Actions" }),
  ).toBeVisible();

  // Close shortcuts modal via 'Got it' button
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(
    page.getByRole("dialog", { name: "Keyboard Navigation & Actions" }),
  ).toHaveCount(0);

  // Test global Undo (Ctrl+Z)
  const nameInput = page.getByLabel("Full name", { exact: true });
  await nameInput.fill("Taylor Morgan");
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Taylor Morgan");

  // Blur input so focus is not active inside an input
  await nameInput.blur();

  // Press Ctrl+Z to undo
  await page.keyboard.press("Control+z");
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Alex Morgan");
});
