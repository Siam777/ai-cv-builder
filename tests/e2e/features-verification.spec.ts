import { test, expect } from "@playwright/test";

test.describe("Full Feature Verification: Role Analyzer, AI CV Generator, Cover Letter Studio & Templates", () => {
  test("verifies Role Analyzer, 1-Click Skill Addition, AI Generator, and Cover Letter Studio", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("http://localhost:3000");

    // If on cold start screen, load example first or test cold start AI generator
    const exampleBtn = page.getByRole("button", { name: "Explore an example" });
    if (await exampleBtn.isVisible()) {
      await exampleBtn.click();
    }

    // 1. Verify Toolbar Buttons
    await expect(page.getByRole("button", { name: "✨ AI Quick-Start" })).toBeVisible();
    await expect(page.getByRole("button", { name: "📊 Role Benchmark & Gaps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "✉️ Cover letter" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Design & templates" })).toBeVisible();

    // 2. Open Role Benchmark & Gaps Audit Panel
    await page.getByRole("button", { name: "📊 Role Benchmark & Gaps" }).click();
    const atsModal = page.getByRole("dialog", { name: "ATS Readiness Audit" });
    await expect(atsModal).toBeVisible();

    // Verify Role Benchmark tab is present and selected
    await expect(atsModal.getByRole("button", { name: /🎯 Role Benchmark/i })).toHaveClass(/active/);

    // Switch to Solutions Architect
    await page.locator("#target-role-select").selectOption("software-architect");
    await expect(page.locator(".role-section-head").first()).toContainText("Architect");

    // Verify missing skills section and click "+ Add to Skills" on a missing skill
    const addSkillBtn = page.locator(".add-skill-action-btn").first();
    if (await addSkillBtn.isVisible()) {
      const initialMatchedCount = await page.locator(".skill-pill.matched").count();
      await addSkillBtn.click();
      await expect(page.locator(".skill-pill.matched")).toHaveCount(initialMatchedCount + 1);
    }

    // Switch to Business Analyst
    await page.locator("#target-role-select").selectOption("business-analyst");
    await expect(page.locator(".role-section-head").first()).toContainText("Business Analyst");
    await expect(page.getByText(/Role Metric Benchmarks/i)).toBeVisible();

    // Close dialog
    await atsModal.getByRole("button", { name: "Done" }).click();
    await expect(atsModal).not.toBeVisible();

    // 3. Open AI Quick-Start Generator
    await page.getByRole("button", { name: "✨ AI Quick-Start" }).click();
    await expect(page.getByRole("dialog", { name: "Generate CV with AI" })).toBeVisible();
    await expect(page.getByText(/Target Seniority Level/i)).toBeVisible();

    // Generate resume
    await page.getByRole("button", { name: /Generate Full AI Resume Draft/i }).click();

    // Wait for generation to complete and modal to close
    await expect(page.getByRole("dialog", { name: "Generate CV with AI" })).not.toBeVisible({ timeout: 10000 });

    // 4. Open Tailored Cover Letter Studio
    await page.getByRole("button", { name: "✉️ Cover letter" }).click();
    const clModal = page.getByRole("dialog", { name: "Tailored Cover Letter Generator" });
    await expect(clModal).toBeVisible();
    await clModal.getByRole("button", { name: /Generate Grounded Cover Letter/i }).click();
    await expect(clModal.locator(".cover-letter-sheet")).toBeVisible();
    await expect(clModal.locator(".letterhead-editable-body")).toBeVisible();
    await expect(clModal.getByRole("button", { name: "📋 Copy to Clipboard" })).toBeVisible();
    await expect(clModal.getByRole("button", { name: "🖨️ Print / Save as PDF" })).toBeVisible();

    // Close Cover Letter Studio
    await clModal.getByRole("button", { name: "Done" }).click();
    await expect(clModal).not.toBeVisible();

    // 5. Open Design & Templates Modal (Confirm No Squished Live Preview & 8 Templates)
    await page.getByRole("button", { name: "Design & templates" }).click();
    await expect(page.getByRole("dialog", { name: "Design & Templates" })).toBeVisible();
    await expect(page.locator(".design-modal-body")).toBeVisible();
    // Modal should NOT contain the redundant live document preview
    await expect(page.locator(".modal-live-preview")).not.toBeVisible();
    // Check template filter tabs
    await expect(page.getByRole("tab", { name: "ATS Classic" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Modern & Tech" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Executive" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Creative & Visual" })).toBeVisible();

    // Click Tech Startup template
    await page.getByRole("button", { name: /Tech Startup/i }).click();

    // Close design modal
    await page.getByRole("button", { name: "Done & Return to Editor" }).click();
    await expect(page.getByRole("dialog", { name: "Design & Templates" })).not.toBeVisible();
  });
});
