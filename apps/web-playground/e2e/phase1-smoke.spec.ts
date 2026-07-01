import { expect, test } from "@playwright/test";

test("loads the Phase 1 playground and exercises preview/export basics", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Phase 1 Playground")).toBeVisible();
  await expect(page.locator(".editor-surface")).toContainText("System Overview");
  await expect(page.getByRole("button", { name: "Heading 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download .sdoc" })).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".preview-output")).toContainText("# System Overview {#overview}");

  await page.getByLabel("Title").fill("Smoke Spec");
  await page.locator(".tabs").getByRole("button", { name: "Diff" }).click();
  await expect(page.locator(".preview-output")).toContainText('Metadata title changed: "Playground Document" -> "Smoke Spec"');

  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  expect((await markdownDownload).suggestedFilename()).toBe("Smoke Spec.md");

  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.length).toBeGreaterThan(1_000);
});
