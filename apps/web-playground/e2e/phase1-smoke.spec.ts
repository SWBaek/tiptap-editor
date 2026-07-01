import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

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

test("round-trips a downloaded .sdoc through the browser open flow", async ({ page }, testInfo) => {
  await page.goto("/");

  await page.getByLabel("Title").fill("Round Trip E2E");
  await page.getByLabel("Author").fill("QA");
  await page.getByLabel("Version").fill("1.0");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  expect(sdocDownload.suggestedFilename()).toBe("Round Trip E2E.sdoc");

  const sdocPath = testInfo.outputPath("Round Trip E2E.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Untitled");

  await page.locator("input[type='file']").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Round Trip E2E.sdoc");
  await expect(page.getByLabel("Title")).toHaveValue("Round Trip E2E");
  await expect(page.getByLabel("Author")).toHaveValue("QA");
  await expect(page.getByLabel("Version")).toHaveValue("1.0");
  await expect(page.locator(".editor-surface")).toContainText("System Overview");

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  await expect(page.locator(".preview-output")).toContainText('"id": "blk_overview"');
  await expect(page.locator(".preview-output")).toContainText('"anchor": "overview"');
});

test("reports unsupported files without replacing the current document", async ({ page }, testInfo) => {
  await page.goto("/");

  const invalidPath = testInfo.outputPath("notes.txt");
  await writeFile(invalidPath, "not an sdoc document", "utf8");

  await page.locator("input[type='file']").setInputFiles(invalidPath);

  await expect(page.locator(".status-note")).toContainText("Unsupported file type: notes.txt");
  await expect(page.locator(".editor-surface")).toContainText("System Overview");
  await expect(page.getByText("Valid")).toBeVisible();
});

test("keeps the playground usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByText("Phase 1 Playground")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open .sdoc or document.json" })).toBeVisible();
  await expect(page.locator(".editor-surface")).toContainText("System Overview");

  const fitsViewport = await page.evaluate(() => {
    const selectors = [".app-shell", ".toolbar", ".editor-surface", ".preview-pane"];
    return selectors.every((selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= window.innerWidth + 1;
    });
  });
  expect(fitsViewport).toBe(true);

  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.length).toBeGreaterThan(1_000);
});
