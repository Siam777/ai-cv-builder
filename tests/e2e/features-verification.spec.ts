import { editorTool } from "./helpers";
import {
  startSampleResume,
  openFirstCv,
  authenticateForExport,
} from "./helpers";
import { test, expect } from "@playwright/test";

test.describe("Full Feature Verification: Role Analyzer, AI CV Generator, Cover Letter Studio & Templates", () => {
  test("verifies Role Analyzer, confirmed checklist review, AI Generator, and Cover Letter Studio", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/builder");

    await startSampleResume(page);

    // 1. Verify the toolbar: Design, Check, AI Assistant and Download
    for (const name of ["Design", "AI Assistant", "CV options"])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Check/ })).toBeVisible();
    await page.getByRole("button", { name: "AI Assistant", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Cover letter", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // 2. Open Role Benchmark & Gaps Audit Panel
    await editorTool(page, "Check");
    const atsModal = page.getByRole("complementary", {
      name: "Check my CV",
    });
    await expect(atsModal).toBeVisible();

    await atsModal
      .getByRole("tab", { name: "Compare with a role" })
      .click();
    // Role comparisons remain an explicit choice after content findings.
    await expect(
      atsModal.getByRole("tab", { name: "Compare with a role" }),
    ).toHaveAttribute("aria-selected", "true");

    // Switch to Solutions Architect
    await page
      .locator("#target-role-select")
      .selectOption("software-architect");
    await expect(page.locator(".role-section-head")).toHaveCount(0);
    await atsModal
      .getByRole("button", { name: "Review selected checklist" })
      .click();
    await expect(page.locator(".role-section-head").first()).toContainText(
      "Architect",
    );

    // Suggested terms must not mutate the resume.
    await expect(page.locator(".skill-pill.missing").first()).toBeVisible();
    await expect(page.locator(".add-skill-action-btn")).toHaveCount(0);
    await expect(atsModal).toContainText(
      "Only add a skill in the editor if your own experience supports it",
    );

    // Switch to Business Analyst
    await page.locator("#target-role-select").selectOption("business-analyst");
    await expect(page.locator(".role-section-head")).toHaveCount(0);
    await atsModal
      .getByRole("button", { name: "Review selected checklist" })
      .click();
    await expect(page.locator(".role-section-head").first()).toContainText(
      "Business Analyst",
    );
    await expect(page.getByText(/Role numeric patterns/i)).toBeVisible();

    // Close dialog
    await atsModal.getByRole("button", { name: "Close Check my CV" }).click();
    await expect(atsModal).not.toBeVisible();

    // 3. Open AI Quick-Start Generator
    await editorTool(page, "Create practice example");
    await expect(
      page.getByRole("dialog", { name: "Create fictional practice CV" }),
    ).toBeVisible();
    await expect(page.getByText(/Target Seniority Level/i)).toBeVisible();

    // Generate resume
    await page
      .getByRole("button", { name: /Create fictional practice CV/i })
      .click();

    // Wait for generation to complete and modal to close
    await expect(
      page.getByRole("dialog", { name: "Create fictional practice CV" }),
    ).not.toBeVisible({ timeout: 10000 });

    // 4. Open Tailored Cover Letter Studio
    await editorTool(page, "Cover letter");
    const clModal = page.getByRole("region", { name: "Cover letter" });
    await expect(clModal).toBeVisible();
    await clModal
      .getByRole("button", { name: /Generate Grounded Cover Letter/i })
      .click();
    await expect(clModal.locator(".cover-letter-sheet")).toBeVisible();
    await expect(clModal.locator(".letterhead-editable-body")).toBeVisible();
    await expect(
      clModal.getByRole("button", { name: "Copy to clipboard" }),
    ).toBeVisible();
    await expect(
      clModal.getByRole("button", { name: "Print / Save as PDF" }),
    ).toBeVisible();

    // Close Cover Letter Studio
    await page.getByRole("button", { name: "Close AI Assistant" }).click();
    await expect(clModal).toHaveCount(0);

    // 5. Open Design & Templates Modal (Confirm No Squished Live Preview & 8 Templates)
    await page.getByRole("button", { name: "Design", exact: true }).click();
    await expect(
      page.getByRole("complementary", { name: "Design" }),
    ).toBeVisible();
    await expect(page.locator(".design-modal-body")).toBeVisible();
    // Modal should NOT contain the redundant live document preview
    await expect(page.locator(".modal-live-preview")).not.toBeVisible();
    // Check template filter tabs
    await expect(page.getByRole("tab", { name: "ATS Classic" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Modern & Tech" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Executive" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Creative & Visual" }),
    ).toBeVisible();

    // Click Tech Startup template
    await page.getByRole("button", { name: /Tech Startup/i }).click();

    // Close the design panel
    await page.getByRole("button", { name: "Close Design" }).click();
    await expect(
      page.getByRole("complementary", { name: "Design" }),
    ).not.toBeVisible();
  });
});
