import { expect, test } from "@playwright/test";
import { startSampleResume } from "./helpers";

test("the address follows the open CV and step: Refresh keeps them, Back returns to the list", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await expect(page).toHaveURL(/\/builder\?cv=[^&]+$/);
  const cvUrl = new URL(page.url());
  const cvId = cvUrl.searchParams.get("cv");

  await page.locator(".section-nav").getByRole("button", { name: /^Experience/ }).click();
  await expect(page).toHaveURL(new RegExp(`cv=${cvId}&step=`));
  const stepUrl = page.url();

  await page.reload();
  await expect(page).toHaveURL(stepUrl);
  await expect(page.getByRole("heading", { name: "Experience", level: 2 })).toBeVisible();

  // Changing step replaced the entry, so one Back reaches the list.
  await page.goBack();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByRole("heading", { name: "My CVs", exact: true })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(stepUrl);
  await expect(page.getByRole("heading", { name: "Experience", level: 2 })).toBeVisible();
});

test("an address for a CV that is not in this workspace opens the list with a notice", async ({
  page,
}) => {
  await page.goto("/builder?cv=not-in-this-workspace");
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByText("That CV is not in this workspace.")).toBeVisible();
});
