import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createDocument } from "../../src/lib/document";

test("creation, save/reload, independent variants, undo, imports and exports", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await expect(
    page.getByRole("article", { name: "Resume preview" }),
  ).toContainText("Alex Morgan");
  await page.getByLabel("Full name", { exact: true }).fill("নাদিয়া Morgan");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "নাদিয়া Morgan",
  );
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Variant Name");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "নাদিয়া Morgan",
  );
  await page.getByLabel("Full name", { exact: true }).fill("Variant Name");
  await page
    .getByLabel("RESUME", { exact: true })
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
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
  await page.getByLabel("Full name", { exact: true }).fill("First writer");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await other.getByLabel("Full name", { exact: true }).fill("Stale writer");
  await expect(other.locator(".alert")).toContainText("another tab");
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "First writer",
  );
});

test("blank editor supports all sections, ordering, replacement undo and long exports", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
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
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
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
