import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

interface JsonNode {
  attrs?: {
    id?: unknown;
  };
  content?: JsonNode[];
  text?: unknown;
}

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

test("preserves unique block ids across split undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  const initialIds = collectBlockIds(await readPreviewDocument(page));
  expect(initialIds).toContain("blk_intro");

  await placeCursorAtEndOfFirstParagraph(page);
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => collectBlockIds(await readPreviewDocument(page)).length)
    .toBe(initialIds.length + 1);

  const splitIds = collectBlockIds(await readPreviewDocument(page));
  expectUniqueIds(splitIds);
  expect(splitIds).toEqual(expect.arrayContaining(initialIds));

  await page.keyboard.press("Control+Z");
  await expect.poll(async () => collectBlockIds(await readPreviewDocument(page)).join("|")).toBe(initialIds.join("|"));

  await page.keyboard.press("Control+Y");
  await expect
    .poll(async () => collectBlockIds(await readPreviewDocument(page)).length)
    .toBe(initialIds.length + 1);

  const redoIds = collectBlockIds(await readPreviewDocument(page));
  expectUniqueIds(redoIds);
  expect(redoIds).toEqual(expect.arrayContaining(initialIds));
  await expect(page.getByText("Valid")).toBeVisible();
});

test("repairs duplicate block ids from pasted editor HTML", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:6280" });
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  const initialIds = collectBlockIds(await readPreviewDocument(page));
  expect(initialIds).toContain("blk_intro");

  const pastedText = "This document describes the initial SDoc editor shell.";
  await page.locator(".editor-surface p").first().click({ clickCount: 3 });
  await page.keyboard.press("Control+C");
  expect(await readClipboardHtml(page)).toContain('data-id="blk_intro"');

  await placeCursorAtEndOfFirstParagraph(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+V");

  await expect(page.locator(".editor-surface")).toContainText(pastedText);
  await expect
    .poll(async () => countTextMatches(await readPreviewDocument(page), pastedText))
    .toBeGreaterThan(1);

  const pastedIds = collectBlockIds(await readPreviewDocument(page));
  expectUniqueIds(pastedIds);
  expect(pastedIds.filter((id) => id === "blk_intro")).toHaveLength(1);
  expect(pastedIds).toEqual(expect.arrayContaining(initialIds));
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

async function readPreviewDocument(page: Page): Promise<JsonNode> {
  return JSON.parse(await page.locator(".preview-output").innerText()) as JsonNode;
}

async function placeCursorAtEndOfFirstParagraph(page: Page): Promise<void> {
  await page.locator(".editor-surface").evaluate((surface) => {
    const paragraph = surface.querySelector("p");
    const textNode = paragraph?.firstChild;
    if (!paragraph || !textNode) {
      throw new Error("missing editable paragraph");
    }

    const range = document.createRange();
    range.setStart(textNode, textNode.textContent?.length ?? 0);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (surface as HTMLElement).focus();
  });
}

async function readClipboardHtml(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes("text/html")) {
        return (await item.getType("text/html")).text();
      }
    }
    return "";
  });
}

function collectBlockIds(node: JsonNode): string[] {
  const ids: string[] = [];

  function visit(current: JsonNode): void {
    if (typeof current.attrs?.id === "string") {
      ids.push(current.attrs.id);
    }
    current.content?.forEach(visit);
  }

  node.content?.forEach(visit);
  return ids;
}

function expectUniqueIds(ids: string[]): void {
  expect(new Set(ids).size).toBe(ids.length);
}

function countTextMatches(node: JsonNode, text: string): number {
  let count = 0;

  function visit(current: JsonNode): void {
    if (current.text === text) {
      count += 1;
    }
    current.content?.forEach(visit);
  }

  visit(node);
  return count;
}
