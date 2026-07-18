import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

interface JsonNode {
  type?: unknown;
  attrs?: {
    id?: unknown;
    assetId?: unknown;
    alt?: unknown;
    kind?: unknown;
    latex?: unknown;
    level?: unknown;
    source?: unknown;
    sourceAssetId?: unknown;
    previewAssetId?: unknown;
    targetId?: unknown;
    textAlign?: unknown;
    checked?: unknown;
  };
  content?: JsonNode[];
  marks?: Array<{ type?: unknown }>;
  text?: unknown;
}

interface BlockToolbarCase {
  button: string;
  topType: string;
  attrs?: Record<string, unknown>;
}

const inlineToolbarCommands = ["Bold", "Italic", "Underline"] as const;
const blockToolbarCases: BlockToolbarCase[] = [
  { button: "Heading 1", topType: "heading", attrs: { level: 1 } },
  { button: "Heading 2", topType: "heading", attrs: { level: 2 } },
  { button: "Bullet list", topType: "bulletList" },
  { button: "Ordered list", topType: "orderedList" },
  { button: "Blockquote", topType: "blockquote" },
  { button: "Code block", topType: "codeBlock" },
  { button: "Note callout", topType: "callout", attrs: { kind: "note" } },
  { button: "Warning callout", topType: "callout", attrs: { kind: "warning" } }
];

test("loads the Phase 3 playground and exercises preview/export basics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Preview and debug output" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Files panel" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Document workflow" })).toContainText("Playground Document.sdoc");
  await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open .sdoc", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await page.getByRole("button", { name: "Files panel" }).click();
  await expect(page.getByRole("complementary", { name: "Files side panel" }).getByLabel("Current file")).toContainText("Playground Document.sdoc");
  await page.getByRole("button", { name: "Files panel" }).click();
  await expect(page.getByRole("complementary", { name: "Files side panel" })).toBeHidden();
  await page.getByRole("button", { name: "Outline panel" }).click();
  const outlinePanel = page.getByRole("complementary", { name: "Outline side panel" });
  await expect(outlinePanel.getByLabel("Document outline")).toContainText("System Overview");
  await page.getByRole("button", { name: "Settings panel" }).click();
  const settingsPanel = page.getByRole("complementary", { name: "Settings side panel" });
  await expect(settingsPanel).toBeVisible();
  await expect(settingsPanel.getByLabel("Document metadata")).toContainText("Metadata");
  await expect(settingsPanel.getByLabel("Schema status")).toContainText("Valid");
  await expect(settingsPanel).not.toContainText("Review");
  await expect(settingsPanel).not.toContainText("References");
  await expect(settingsPanel).not.toContainText("Current file");
  await expect(page.locator(".editor-surface")).toContainText("System Overview");
  await expect(page.getByRole("button", { name: "Heading 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Insert image" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Insert table" })).toBeVisible();
  await expect(page.getByLabel("More insert menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Insert Mermaid diagram" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Download .sdoc" })).toBeVisible();

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("# System Overview {#overview}");

  await page.getByLabel("Title", { exact: true }).fill("Smoke Spec");
  await selectPreviewTab(page, "Diff");
  await expect(page.locator(".diff-review-summary")).toContainText("Total");
  await expect(page.locator(".diff-review-summary")).toContainText("Metadata");
  const metadataSection = page.locator(".diff-review-section").filter({ hasText: "Metadata changes" });
  await expect(metadataSection).toContainText("Metadata changes");
  await expect(metadataSection.locator(".diff-review-list")).toContainText('Metadata title changed: "Playground Document" -> "Smoke Spec"');
  await expect(page.locator(".preview-output")).toContainText('Metadata title changed: "Playground Document" -> "Smoke Spec"');
  await expect(page.locator(".diff-review-summary")).toContainText("1");

  await page.getByRole("button", { name: "Mark saved" }).click();
  await expect(page.locator(".diff-empty")).toContainText("No changes");

  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  expect((await markdownDownload).suggestedFilename()).toBe("Smoke Spec.md");

  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.length).toBeGreaterThan(1_000);
});

test("shows authoring structure projections without changing heading text", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Outline panel" }).click();
  const outlinePanel = page.getByRole("complementary", { name: "Outline side panel" });
  await expect(outlinePanel.getByLabel("Document outline")).toContainText("1");
  await expect(outlinePanel.getByLabel("Document outline")).toContainText("System Overview");

  const headingNumberCss = page.locator("style[data-sdoc-heading-number-runtime]");
  await expect.poll(() => headingNumberCss.evaluate((node) => node.textContent ?? "")).toContain('content:"1. "');

  await page.getByRole("button", { name: "Settings panel" }).click();
  const settingsPanel = page.getByRole("complementary", { name: "Settings side panel" });
  await expect(settingsPanel.getByLabel("Authoring settings")).toContainText("Heading numbering");
  await settingsPanel.getByLabel("Heading numbering").uncheck();
  await expect(page.locator("style[data-sdoc-heading-number-runtime]")).toHaveCount(0);

  await selectPreviewTab(page, "JSON");
  const document = await readPreviewDocument(page);
  expect(document.content?.[0]?.content?.[0]?.text).toBe("System Overview");
});

test("applies selected text formatting through the bubble toolbar", async ({ page }) => {
  await page.goto("/");

  const firstParagraph = page.locator(".editor-surface p").first();
  await firstParagraph.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  const bubble = page.getByLabel("Selected text formatting");
  await expect(bubble).toBeVisible();
  await bubble.getByRole("button", { name: "Bold selection" }).click();
  await expect(bubble).toBeVisible();
  await bubble.getByRole("button", { name: "Strike selection" }).click();

  await selectPreviewTab(page, "JSON");
  const document = await readPreviewDocument(page);
  const paragraph = document.content?.find((node) => node.type === "paragraph");
  expect(JSON.stringify(paragraph)).toContain('"type":"bold"');
  expect(JSON.stringify(paragraph)).toContain('"type":"strike"');
  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("~~");
});

test("adds, edits, validates, and removes normal links separately from references", async ({ page }) => {
  await page.goto("/");
  const firstParagraph = page.locator(".editor-surface p").first();
  await firstParagraph.click({ clickCount: 3 });
  await page.getByLabel("Selected text formatting").getByRole("button", { name: "Edit link for selection" }).click();

  const dialog = page.getByRole("dialog", { name: "Add link" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("URL").fill("javascript:alert(1)");
  await expect(dialog.getByText("Use an http, https, or mailto URL")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Apply link" })).toBeDisabled();
  await dialog.getByLabel("URL").fill("https://example.com/spec");
  await dialog.getByRole("button", { name: "Apply link" }).click();
  await expect(page.locator(".status-note")).toContainText("Applied external link");

  let document = await readPreviewDocument(page);
  expect(JSON.stringify(document)).toContain('"type":"link","attrs":{"href":"https://example.com/spec"}');
  expect(JSON.stringify(document)).not.toContain("crossReference");
  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("](https://example.com/spec)");

  await firstParagraph.click({ clickCount: 3 });
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit link" });
  await expect(editDialog.getByLabel("URL")).toHaveValue("https://example.com/spec");
  await editDialog.getByLabel("URL").fill("https://example.com/revised");
  await editDialog.getByRole("button", { name: "Apply link" }).click();
  document = await readPreviewDocument(page);
  expect(JSON.stringify(document)).toContain("https://example.com/revised");

  await firstParagraph.click({ clickCount: 3 });
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByRole("dialog", { name: "Edit link" }).getByRole("button", { name: "Remove link" }).click();
  document = await readPreviewDocument(page);
  expect(JSON.stringify(document)).not.toContain('"type":"link"');
});

test("authors subscript and superscript as canonical technical marks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  const paragraph = page.locator(".editor-surface p").first();
  const editorSurface = page.locator(".editor-surface");
  await paragraph.click();
  await page.keyboard.type("H");
  await page.getByLabel("Text options menu").click();
  await page.getByRole("button", { name: "Subscript", exact: true }).click();
  await editorSurface.focus();
  await page.keyboard.type("2");
  await page.getByLabel("Text options menu").click();
  await page.getByRole("button", { name: "Superscript", exact: true }).click();
  await editorSurface.focus();
  await page.keyboard.type("3");
  await page.getByLabel("Text options menu").click();
  await page.getByRole("button", { name: "Superscript", exact: true }).click();
  await editorSurface.focus();
  await page.keyboard.type("O x");
  await page.getByLabel("Text options menu").click();
  await page.getByRole("button", { name: "Superscript", exact: true }).click();
  await editorSurface.focus();
  await page.keyboard.type("2");

  const document = await readPreviewDocument(page);
  const serialized = JSON.stringify(document);
  expect(serialized).toContain('"text":"2","marks":[{"type":"subscript"}]');
  expect(serialized).toContain('"text":"3","marks":[{"type":"superscript"}]');
  expect(serialized).toContain('"text":"2","marks":[{"type":"superscript"}]');
  expect(serialized).not.toContain('"type":"subscript"},{"type":"superscript"');
  expect(serialized).not.toContain("textStyle");
  expectUniqueIds(collectBlockIds(document));

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("H<sub>2</sub><sup>3</sup>O x<sup>2</sup>");
});

test("aligns paragraphs as a canonical text block attribute", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  const paragraph = page.locator(".editor-surface p").first();
  await paragraph.click();
  await page.keyboard.type("Centered requirement");

  await page.getByLabel("Text options menu").click();
  await page.getByRole("button", { name: "Align text center" }).click();

  const document = await readPreviewDocument(page);
  const alignedParagraph = document.content?.find((node) => node.type === "paragraph");
  expect(alignedParagraph?.attrs?.textAlign).toBe("center");
  expectUniqueIds(collectBlockIds(document));
  expect(JSON.stringify(document)).not.toContain("selection");
  await expect(paragraph).toHaveCSS("text-align", "center");
});

test("authors and checks a stable-id task list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  await page.getByRole("button", { name: "Task list" }).click();
  await page.keyboard.type("Verify converter limits");

  const checkbox = page.getByRole("checkbox", { name: /Task item checkbox/ });
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  const document = await readPreviewDocument(page);
  const taskList = document.content?.find((node) => node.type === "taskList");
  const taskItem = taskList?.content?.find((node) => node.type === "taskItem");
  expect(taskItem?.attrs?.checked).toBe(true);
  expectUniqueIds(collectBlockIds(document));

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("- [x] Verify converter limits");
});

test("changes heading depth with Tab without replacing block ids", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  await page.getByRole("button", { name: "Heading 2" }).click();
  await page.keyboard.type("Converter limits");

  let document = await readPreviewDocument(page);
  let heading = document.content?.find((node) => node.type === "heading");
  const headingId = heading?.attrs?.id;
  expect(heading?.attrs?.level).toBe(2);

  await page.locator(".editor-surface h2").click();
  await page.keyboard.press("Tab");
  document = await readPreviewDocument(page);
  heading = document.content?.find((node) => node.type === "heading");
  expect(heading?.attrs?.level).toBe(3);
  expect(heading?.attrs?.id).toBe(headingId);

  await page.locator(".editor-surface h3").click();
  await page.keyboard.press("Shift+Tab");
  document = await readPreviewDocument(page);
  heading = document.content?.find((node) => node.type === "heading");
  expect(heading?.attrs?.level).toBe(2);
  expect(heading?.attrs?.id).toBe(headingId);

  await page.locator(".editor-surface h2").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body paragraph");
  const paragraph = page.locator(".editor-surface p").last();
  const beforeParagraphTab = await readPreviewDocument(page);
  await paragraph.click();
  await page.keyboard.press("Tab");
  expect(await readPreviewDocument(page)).toEqual(beforeParagraphTab);
  expectUniqueIds(collectBlockIds(beforeParagraphTab));
});

test("uses viewport-safe runtime editor and table context menus", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");
  const beforeMenu = await readPreviewDocument(page);

  await page.locator(".editor-surface p").first().click({ button: "right" });
  const insertMenu = page.getByRole("menu", { name: "Insert context menu" });
  await expect(insertMenu).toBeVisible();
  const menuBox = await insertMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(menuBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(1280);
  expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(720);

  await page.keyboard.press("Escape");
  await expect(insertMenu).toBeHidden();
  expect(await readPreviewDocument(page)).toEqual(beforeMenu);

  await page.locator(".editor-surface p").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Insert table" }).click();
  const tableInsertDialog = page.getByRole("dialog", { name: "Insert table" });
  await expect(tableInsertDialog).toBeVisible();
  await tableInsertDialog.getByRole("button", { name: "Insert table" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted table");
  await expect(insertMenu).toBeHidden();

  await page.locator(".editor-surface th").first().click({ button: "right" });
  const tableMenu = page.getByRole("menu", { name: "Table context menu" });
  await expect(tableMenu).toBeVisible();
  await tableMenu.getByRole("menuitem", { name: "Add row after" }).click();
  await expect(page.locator(".status-note")).toContainText("Added table row");
  await expect(tableMenu).toBeHidden();

  const document = await readPreviewDocument(page);
  expect(findFirstNodeByType(document, "table").content).toHaveLength(4);
  expect(JSON.stringify(document)).not.toContain("contextMenu");
  expectUniqueIds(collectBlockIds(document));
});

test("uses the Review side panel for diff workflow controls", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Title", { exact: true }).fill("Review Panel Spec");
  await page.locator(".editor-surface p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Updated.");
  await selectPreviewTab(page, "JSON");
  const beforeReviewSelection = await readPreviewDocument(page);

  await page.getByRole("button", { name: "Review panel" }).click();
  const reviewPanel = page.getByRole("complementary", { name: "Review side panel" });
  await expect(reviewPanel).toBeVisible();
  await expect(reviewPanel.locator(".status-block").filter({ hasText: "Review" })).toContainText("2 changes");
  await expect(reviewPanel.locator(".status-block").filter({ hasText: "Base" })).toContainText("Saved baseline");
  await expect(reviewPanel.getByLabel("Review counts")).toContainText("Total");
  await expect(reviewPanel.getByLabel("Review counts")).toContainText("Metadata");
  await expect(reviewPanel.getByLabel("Review counts")).toContainText("2");
  await expect(reviewPanel.getByLabel("Review event filters")).toContainText("Modified");
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("Modified paragraph");
  await reviewPanel.getByText("Inline overlay").click();
  await expect.poll(() => page.locator("style[data-sdoc-diff-overlay-runtime]").evaluate((node) => node.textContent ?? "")).toContain('[data-id="blk_intro"]');
  await reviewPanel.getByLabel("Review event filters").getByRole("button", { name: /Modified/ }).click();
  await reviewPanel.locator(".review-event-list button").filter({ hasText: "Modified paragraph" }).click();
  await expect(page.locator(".status-note")).toContainText("Focused Modified paragraph");
  await expect(page.locator(".editor-node-highlight")).toHaveAttribute("data-highlighted-node-id", "blk_intro");
  await reviewPanel.getByRole("button", { name: "Show diff" }).click();
  const sideBySideDiff = page.getByLabel("Side-by-side document diff");
  await expect(sideBySideDiff).toContainText("Modified");
  await expect(sideBySideDiff).toContainText("This document describes the initial SDoc editor shell.");
  await expect(sideBySideDiff).toContainText("Updated.");
  await selectPreviewTab(page, "JSON");
  expect(await readPreviewDocument(page)).toEqual(beforeReviewSelection);

  const modifiedEvent = reviewPanel.locator(".review-event-list li").filter({ hasText: "Modified paragraph" });
  page.once("dialog", (dialog) => dialog.accept());
  await modifiedEvent.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.locator(".status-note")).toContainText("Accepted modified blk_intro");
  await selectPreviewTab(page, "JSON");
  expect(await readPreviewDocument(page)).toEqual(beforeReviewSelection);
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("No document events");

  await page.locator(".editor-surface p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Rejected.");
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("Modified paragraph");
  const rejectedEvent = reviewPanel.locator(".review-event-list li").filter({ hasText: "Modified paragraph" });
  page.once("dialog", (dialog) => dialog.accept());
  await rejectedEvent.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.locator(".status-note")).toContainText("Rejected modified blk_intro");
  await selectPreviewTab(page, "JSON");
  expect(await readPreviewDocument(page)).toEqual(beforeReviewSelection);
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("No document events");

  await page.locator(".editor-surface p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Batch accepted.");
  await selectPreviewTab(page, "JSON");
  const batchAcceptedDocument = await readPreviewDocument(page);
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("Modified paragraph");
  page.once("dialog", (dialog) => dialog.accept());
  await reviewPanel.getByRole("button", { name: "Accept visible" }).click();
  await expect(page.locator(".status-note")).toContainText("Accepted 1 review event.");
  await expect(reviewPanel.getByLabel("Review batch result")).toContainText("Batch accept complete");
  await expect(reviewPanel.getByLabel("Review batch result")).toContainText("Applied");
  await selectPreviewTab(page, "JSON");
  expect(await readPreviewDocument(page)).toEqual(batchAcceptedDocument);
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("No document events");

  await page.locator(".editor-surface p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Batch rejected.");
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("Modified paragraph");
  page.once("dialog", (dialog) => dialog.accept());
  await reviewPanel.getByRole("button", { name: "Reject visible" }).click();
  await expect(page.locator(".status-note")).toContainText("Rejected 1 review event.");
  await expect(reviewPanel.getByLabel("Review batch result")).toContainText("Batch reject complete");
  await expect(reviewPanel.getByLabel("Review batch result")).toContainText("Skipped");
  await selectPreviewTab(page, "JSON");
  expect(await readPreviewDocument(page)).toEqual(batchAcceptedDocument);
  await expect(reviewPanel.getByLabel("Semantic review events")).toContainText("No document events");

  await expect(reviewPanel.getByLabel("Git integration boundary")).toContainText("Git is optional");
  await reviewPanel.getByRole("button", { name: "Copy semantic diff command" }).click();
  await expect(page.locator(".status-note")).toContainText('npm run sdoc -- diff "old.document.json" "new.document.json"');

  await reviewPanel.getByRole("button", { name: "Show diff" }).click();
  await expect(page.locator(".diff-review-base")).toContainText("Saved baseline");
  await expect(page.locator(".diff-review-section").filter({ hasText: "Metadata changes" })).toContainText(
    'Metadata title changed: "Playground Document" -> "Review Panel Spec"'
  );

  await reviewPanel.getByRole("button", { name: "Mark saved" }).click();
  await expect(page.locator(".status-note")).toContainText("Marked current state as saved");
  await expect(reviewPanel.locator(".status-block").filter({ hasText: "Review" })).toContainText("No changes");
  await expect(page.locator(".diff-empty")).toContainText("No changes");
  await expect(page.locator("style[data-sdoc-diff-overlay-runtime]")).toBeHidden();
});

test("folds editor sections without storing runtime state in document.json", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");
  const beforeFold = await readPreviewDocument(page);

  await page.locator('.editor-surface [data-id="blk_overview"]').click();
  await openToolbarMenu(page, "Structure");
  await page.getByRole("button", { name: "Fold section", exact: true }).click();
  await expect(page.locator(".status-note")).toContainText("Folded section: System Overview");
  await expect(page.locator('.editor-surface [data-id="blk_intro"]')).toBeHidden();
  await expect(page.locator('.editor-surface [data-id="blk_overview"]')).toBeVisible();

  const afterFold = await readPreviewDocument(page);
  expect(afterFold).toEqual(beforeFold);
  expect(JSON.stringify(afterFold)).not.toContain("collapsed");
  expect(JSON.stringify(afterFold)).not.toContain("fold");

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("This document describes the initial SDoc editor shell.");

  await openToolbarMenu(page, "Structure");
  await page.getByRole("button", { name: "Unfold all sections", exact: true }).click();
  await expect(page.locator(".status-note")).toContainText("Unfolded all sections");
  await expect(page.locator("style[data-sdoc-fold-runtime]")).toHaveCount(0);
  await expect(page.locator('.editor-surface [data-id="blk_intro"]')).toBeVisible();
});

test("persists runtime-only editor zoom without changing document.json", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("sdoc-editor-zoom")) {
      window.localStorage.setItem("sdoc-editor-zoom", "130");
    }
  });
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  const beforeZoom = await readPreviewDocument(page);
  const zoomControls = page.getByLabel("Editor zoom controls");
  await expect(zoomControls).toBeVisible();
  await expect(zoomControls.locator("output")).toHaveText("130%");

  await zoomControls.getByLabel("Editor zoom").fill("170");
  await expect(zoomControls.locator("output")).toHaveText("170%");
  await expect.poll(() => page.locator(".editor-zoom-layer").evaluate((element) => getComputedStyle(element).zoom)).toBe("1.7");
  expect(await readPreviewDocument(page)).toEqual(beforeZoom);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("sdoc-editor-zoom"))).toBe("170");

  await page.reload();
  await expect(page.getByLabel("Editor zoom controls").locator("output")).toHaveText("170%");
  expect(await readPreviewDocument(page)).toEqual(beforeZoom);
  await page.getByLabel("Editor zoom controls").getByRole("button", { name: "Reset zoom" }).click();
  await expect(page.getByLabel("Editor zoom controls").locator("output")).toHaveText("100%");
  expect(await readPreviewDocument(page)).toEqual(beforeZoom);
});

test("navigates runtime-only cursor history with keyboard mouse and controls", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");
  const beforeNavigation = await readPreviewDocument(page);
  const selectionSnapshot = () => page.evaluate(() => {
    const selection = window.getSelection();
    return {
      anchorText: selection?.anchorNode?.textContent ?? "",
      anchorOffset: selection?.anchorOffset ?? -1,
      focusText: selection?.focusNode?.textContent ?? "",
      focusOffset: selection?.focusOffset ?? -1
    };
  });

  await page.locator(".editor-surface p").first().click();
  const firstLocation = await selectionSnapshot();
  await page.locator(".editor-surface pre").first().click();
  const secondLocation = await selectionSnapshot();
  expect(secondLocation).not.toEqual(firstLocation);

  const historyControls = page.getByLabel("Cursor history controls");
  await expect(historyControls.getByRole("button", { name: "Previous cursor position" })).toBeEnabled();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.locator(".status-note")).toContainText("Moved to previous cursor position");
  await expect.poll(selectionSnapshot).toEqual(firstLocation);

  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.locator(".status-note")).toContainText("Moved to next cursor position");
  await expect.poll(selectionSnapshot).toEqual(secondLocation);

  await page.locator(".editor-pane").dispatchEvent("mousedown", { button: 3, bubbles: true, cancelable: true });
  await expect(page.locator(".status-note")).toContainText("Moved to previous cursor position");
  await expect.poll(selectionSnapshot).toEqual(firstLocation);
  await historyControls.getByRole("button", { name: "Next cursor position" }).click();
  await expect.poll(selectionSnapshot).toEqual(secondLocation);

  expect(await readPreviewDocument(page)).toEqual(beforeNavigation);
  expect(JSON.stringify(await readPreviewDocument(page))).not.toContain("cursorHistory");
});

test("tracks browser recent files in the Files side panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Files panel" }).click();
  const filesPanel = page.getByRole("complementary", { name: "Files side panel" });
  await expect(filesPanel).toBeVisible();
  await expect(filesPanel.getByLabel("Current file")).toContainText("Playground Document.sdoc");
  await expect(filesPanel.getByLabel("Recent files")).toContainText("No recent browser activity");
  await expect(filesPanel.getByLabel("Workspace files")).toContainText("Desktop-only browsing");
  await expect(filesPanel.getByLabel("Unpacked folder workflow")).toContainText("advanced review/debug workflows");

  await page.getByRole("button", { name: "Settings panel" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Files Panel Spec");
  await page.getByRole("button", { name: "Files panel" }).click();
  await filesPanel.getByText("Developer workspace").click();
  await filesPanel.getByRole("button", { name: "Copy unpack command" }).click();
  await expect(page.locator(".status-note")).toContainText('npm run sdoc -- unpack "Files Panel Spec.sdoc" "Files Panel Spec.sdoc.d"');

  const sdocDownload = page.waitForEvent("download");
  await filesPanel.getByRole("button", { name: "Download .sdoc" }).click();
  expect((await sdocDownload).suggestedFilename()).toBe("Files Panel Spec.sdoc");
  await expect(filesPanel.getByLabel("Current file")).toContainText("Files Panel Spec.sdoc");
  await expect(filesPanel.getByLabel("Recent files")).toContainText("Files Panel Spec.sdoc");
  await expect(filesPanel.getByLabel("Recent files")).toContainText("saved Files Panel Spec");

  await page.reload();
  await page.getByRole("button", { name: "Files panel" }).click();
  const reloadedFilesPanel = page.getByRole("complementary", { name: "Files side panel" });
  await expect(reloadedFilesPanel.getByLabel("Recent files")).toContainText("Files Panel Spec.sdoc");
  await reloadedFilesPanel.getByRole("button", { name: /Files Panel Spec\.sdoc/ }).click();
  await expect(page.locator(".status-note")).toContainText("Recent file metadata only: reopen Files Panel Spec.sdoc");
});

test("shows a desktop start screen before opening a Tauri workspace document", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    (window as typeof window & { __SDOC_NATIVE_SAVE_BRIDGE__?: unknown }).__SDOC_NATIVE_SAVE_BRIDGE__ = {
      async saveSdoc() {
        return undefined;
      },
      async chooseSdocSavePath() {
        return "C:\\Docs\\new-document.sdoc";
      },
      async openSdoc() {
        return { path: "C:\\Docs\\opened.sdoc", bytes: new Uint8Array() };
      },
      async openSdocPath(path: string) {
        return { path, bytes: new Uint8Array() };
      },
      async chooseSdocWorkspaceDirectory() {
        return "C:\\Docs";
      },
      async listSdocWorkspaceEntries() {
        return [
          {
            name: "Guides",
            path: "C:\\Docs\\Guides",
            kind: "folder",
            children: [{ name: "nested.sdoc", path: "C:\\Docs\\Guides\\nested.sdoc", kind: "sdoc-file" }]
          },
          { name: "opened.sdoc", path: "C:\\Docs\\opened.sdoc", kind: "sdoc-file" }
        ];
      }
    };
  });

  await page.goto("/");
  const startScreen = page.getByLabel("Desktop start screen");
  await expect(startScreen).toBeVisible();
  await expect(startScreen.getByRole("button", { name: "Open Folder" })).toBeVisible();
  await expect(startScreen.getByRole("button", { name: "Open .sdoc" })).toBeVisible();
  await expect(startScreen.getByRole("button", { name: "New .sdoc" })).toBeVisible();
  await expect(startScreen.getByLabel("Recent Documents")).toContainText("No recent documents yet.");
  await expect(page.getByRole("region", { name: "Document workflow" })).toHaveCount(0);
  await expect(page.locator(".editor-surface")).toHaveCount(0);

  await startScreen.getByRole("button", { name: "Open Folder" }).click();
  await expect(page.getByRole("region", { name: "Document workflow" })).toBeVisible();
  await page.getByRole("button", { name: "Files panel" }).click();
  const filesPanel = page.getByRole("complementary", { name: "Files side panel" });
  await expect(filesPanel.getByLabel("Workspace files")).toContainText("Docs");
  await expect(filesPanel.getByLabel("Workspace files")).toContainText("opened.sdoc");
  await expect(filesPanel.getByRole("button", { name: /nested\.sdoc/ })).toHaveCount(0);
  await filesPanel.getByRole("button", { name: "Expand folder Guides" }).click();
  await expect(filesPanel.getByRole("button", { name: /nested\.sdoc/ })).toBeVisible();
  await filesPanel.getByRole("button", { name: "Collapse folder Guides" }).click();
  await expect(filesPanel.getByRole("button", { name: /nested\.sdoc/ })).toHaveCount(0);
  await filesPanel.getByRole("button", { name: /opened\.sdoc/ }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("opened");
  await expect(filesPanel.getByLabel("Current file")).toContainText("opened.sdoc");
  await expect(page.locator(".status-note")).toContainText("Initialized empty .sdoc");
});

test("exports deliverables and keeps developer outputs separate", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Title", { exact: true }).fill("Export Panel Spec");
  await page.getByRole("button", { name: "Export panel" }).click();
  const exportPanel = page.getByRole("complementary", { name: "Export side panel" });
  await expect(exportPanel).toBeVisible();
  await expect(exportPanel.getByLabel("Readable exports")).toContainText("Export Panel Spec.md");
  await expect(exportPanel.getByLabel("Readable exports")).toContainText("Export Panel Spec.html");
  await expect(exportPanel.getByLabel("PDF publishing boundary")).toContainText("CLI/Tauri PDF");
  await expect(exportPanel.getByLabel("PDF publishing boundary")).toContainText("Export Panel Spec.pdf");
  await expect(exportPanel.getByLabel("DOCX publishing boundary")).toContainText("CLI/Tauri DOCX");
  await expect(exportPanel).not.toContainText("document.json");
  await expect(exportPanel).not.toContainText("plain.md");
  await exportPanel.getByLabel("Publishing profile").selectOption("korean");

  const markdownDownload = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "Export Markdown" }).click();
  expect((await markdownDownload).suggestedFilename()).toBe("Export Panel Spec.md");
  await expect(page.locator(".status-note")).toContainText("Exported Markdown");

  const htmlDownload = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "Export HTML" }).click();
  const downloadedHtml = await htmlDownload;
  expect(downloadedHtml.suggestedFilename()).toBe("Export Panel Spec.html");
  const htmlPath = test.info().outputPath("Export Panel Spec.html");
  await downloadedHtml.saveAs(htmlPath);
  expect(await readFile(htmlPath, "utf8")).toContain('class="sdoc-profile-korean"');
  await expect(page.locator(".status-note")).toContainText("Exported HTML with korean profile");

  await exportPanel.getByRole("button", { name: "Copy PDF command" }).click();
  await expect(page.locator(".status-note")).toContainText('npm run sdoc -- export "Export Panel Spec.sdoc" --format pdf --profile korean -o "Export Panel Spec.pdf"');

  await exportPanel.getByRole("button", { name: "Copy DOCX command" }).click();
  await expect(page.locator(".status-note")).toContainText('npm run sdoc -- export "Export Panel Spec.sdoc" --format docx --template controlled -o "Export Panel Spec.docx"');

  await page.getByRole("button", { name: "Developer panel" }).click();
  const developerPanel = page.getByRole("complementary", { name: "Developer side panel" });
  await expect(developerPanel.getByLabel("Portable document exports")).toContainText("Export Panel Spec.sdoc");
  await expect(developerPanel.getByLabel("Portable document exports")).toContainText("document.json");
  await expect(developerPanel.getByLabel("AI/RAG exports")).toContainText("plain.md");
  await expect(developerPanel.getByLabel("AI/RAG exports")).toContainText("chunks.jsonl");
  await expect(developerPanel.getByLabel("AI/RAG exports")).toContainText("outline.json");
  await expect(developerPanel.getByLabel("AI/RAG exports")).toContainText("references.json");

  const plainDownload = page.waitForEvent("download");
  await developerPanel.getByRole("button", { name: "Export plain.md" }).click();
  expect((await plainDownload).suggestedFilename()).toBe("plain.md");
  await expect(page.locator(".status-note")).toContainText("Exported plain.md");

  const chunksDownload = page.waitForEvent("download");
  await developerPanel.getByRole("button", { name: "Export chunks.jsonl" }).click();
  expect((await chunksDownload).suggestedFilename()).toBe("chunks.jsonl");
  await expect(page.locator(".status-note")).toContainText("Exported chunks.jsonl");
});

test("stores local history snapshots and compares them with the current document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "History panel" }).click();
  await expect(page.getByRole("complementary", { name: "History side panel" })).toBeVisible();
  await expect(page.locator(".history-empty")).toContainText("No snapshots");

  await page.getByRole("button", { name: "Save history snapshot" }).click();
  await expect(page.locator(".status-note")).toContainText("Saved history snapshot: Playground Document");
  await expect(page.getByRole("button", { name: "History panel" })).toHaveAttribute("aria-pressed", "true");
  const historyItem = page.locator(".history-item");
  await expect(historyItem.getByLabel("Snapshot name")).toHaveValue("Playground Document");

  await historyItem.getByLabel("Snapshot name").fill("Review Baseline");
  await historyItem.getByLabel("Snapshot name").press("Enter");
  await expect(page.locator(".status-note")).toContainText("Renamed history snapshot: Review Baseline");
  await expect(historyItem.getByLabel("Snapshot name")).toHaveValue("Review Baseline");

  await page.getByRole("button", { name: "Settings panel" }).click();
  await page.getByLabel("Title", { exact: true }).fill("History Spec");
  await page.getByRole("button", { name: "History panel" }).click();
  const renamedHistoryItem = page.locator(".history-item");
  await expect(renamedHistoryItem.getByLabel("Snapshot name")).toHaveValue("Review Baseline");
  await renamedHistoryItem.getByRole("button", { name: "Compare" }).click();
  await expect(page.locator(".status-note")).toContainText("Comparing with history snapshot: Review Baseline");
  await expect(page.locator(".diff-review-base")).toContainText("History: Review Baseline");
  await expect(page.locator(".diff-review-summary")).toContainText("Total");
  await expect(page.locator(".diff-review-summary")).toContainText("1");
  await expect(page.locator(".diff-review-section").filter({ hasText: "Metadata changes" })).toContainText(
    'Metadata title changed: "Playground Document" -> "History Spec"'
  );

  await page.getByRole("button", { name: "Review panel" }).click();
  const historyReviewPanel = page.getByRole("complementary", { name: "Review side panel" });
  await expect(historyReviewPanel.locator(".status-block").filter({ hasText: "Base" })).toContainText("History: Review Baseline");
  await historyReviewPanel.getByRole("button", { name: "Use saved baseline" }).click();
  await expect(page.locator(".status-note")).toContainText("Comparing with saved baseline");
  await expect(historyReviewPanel.locator(".status-block").filter({ hasText: "Base" })).toContainText("Saved baseline");

  await page.getByRole("button", { name: "History panel" }).click();
  await page.getByRole("button", { name: "Delete history snapshot Review Baseline" }).click();
  await expect(page.locator(".status-note")).toContainText("Deleted history snapshot: Review Baseline");
  await expect(page.locator(".history-empty")).toContainText("No snapshots");

  await selectPreviewTab(page, "Diff");
  await expect(page.locator(".diff-review-base")).toContainText("Saved baseline");
  await expect(page.locator(".diff-review-summary")).toContainText("Total");
  await expect(page.locator(".diff-review-summary")).toContainText("1");

  await page.reload();
  await page.getByRole("button", { name: "History panel" }).click();
  await expect(page.locator(".history-empty")).toContainText("No snapshots");
});

test("persists local history snapshots across reloads", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "History panel" }).click();
  await page.getByRole("button", { name: "Save history snapshot" }).click();
  await page.locator(".history-item").getByLabel("Snapshot name").fill("Reload Baseline");
  await page.locator(".history-item").getByLabel("Snapshot name").press("Enter");

  await page.reload();
  await page.getByRole("button", { name: "History panel" }).click();
  await expect(page.locator(".history-item").getByLabel("Snapshot name")).toHaveValue("Reload Baseline");
});

test("inserts cross references from the target picker", async ({ page }) => {
  await page.goto("/");
  await page.locator(".editor-surface p").first().click();

  await openToolbarMenu(page, "More insert");
  await page.getByRole("button", { name: "Insert reference" }).click();
  await expect(page.locator(".status-note")).toContainText("Choose a reference target");
  await expect(page.getByRole("button", { name: "Diagnostics panel" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("complementary", { name: "Diagnostics side panel" })).toBeVisible();
  await page.getByLabel("Filter reference targets").fill("overview");
  const overviewTarget = page.locator(".reference-target-list li").filter({ hasText: "System Overview" });

  await overviewTarget.getByRole("button", { name: "Show" }).click();
  await expect(page.locator(".status-note")).toContainText("Focused target System Overview");
  await expect(page.locator('.editor-node-highlight[data-highlighted-node-id="blk_overview"]')).toBeVisible();

  await overviewTarget.getByRole("button", { name: "Insert reference to System Overview" }).click();

  await expect(page.locator(".status-note")).toContainText("Inserted reference to System Overview");
  await expect(page.locator(".reference-summary")).toContainText("References");
  await expect(page.locator(".reference-empty")).toContainText("All references resolve");

  await page.locator(".editor-surface h1").click({ clickCount: 3 });
  await page.keyboard.type("Platform Overview");
  await expect(page.locator(".reference-summary")).toContainText("Stale");
  await expect(page.locator(".reference-stale-list")).toContainText("System Overview");
  await expect(page.locator(".reference-stale-list")).toContainText("Platform Overview");

  await page.getByRole("button", { name: "Update label for System Overview" }).click();
  await expect(page.locator(".status-note")).toContainText("Updated reference label: Platform Overview");
  await expect(page.locator(".reference-empty")).toContainText("All references resolve");

  await selectPreviewTab(page, "JSON");
  const document = await readPreviewDocument(page);
  const reference = findFirstNodeByType(document, "crossReference");
  expect(reference.attrs?.targetId).toBe("blk_overview");
  expect(findTextNode(reference, "Platform Overview").text).toBe("Platform Overview");
  expectUniqueIds(collectBlockIds(document));
  await page.getByRole("button", { name: "Settings panel" }).click();
  await expect(page.getByRole("complementary", { name: "Settings side panel" }).getByLabel("Schema status")).toContainText("Valid");
});

test("sets requirement traceability IDs from the Diagnostics side panel", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");
  const beforeTag = await readPreviewDocument(page);

  await page.locator('.editor-surface [data-id="blk_intro"]').click();
  await page.getByRole("button", { name: "Diagnostics panel" }).click();
  const traceabilityPanel = page.getByRole("complementary", { name: "Diagnostics side panel" });
  await expect(traceabilityPanel).toBeVisible();
  await expect(traceabilityPanel.getByLabel("Requirement traceability summary")).toContainText("Tagged");
  await expect(traceabilityPanel.getByLabel("Requirement traceability summary")).toContainText("Gaps");
  await expect(traceabilityPanel).toContainText("System Overview");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Requirement ID");
    await dialog.accept("REQ-OBC-012");
  });
  await traceabilityPanel.getByRole("button", { name: "Set selected ID" }).click();
  await expect(page.locator(".status-note")).toContainText("Set requirement ID REQ-OBC-012 on blk_intro");
  await expect(traceabilityPanel).toContainText("REQ-OBC-012");

  const afterTag = await readPreviewDocument(page);
  expect(afterTag).not.toEqual(beforeTag);
  expect(JSON.stringify(afterTag)).toContain('"humanId":"REQ-OBC-012"');
  expect(JSON.stringify(afterTag)).not.toContain("traceabilityPanel");

  await traceabilityPanel.getByRole("button", { name: "Clear selected ID" }).click();
  await expect(page.locator(".status-note")).toContainText("Cleared requirement ID on blk_intro");
  const afterClear = await readPreviewDocument(page);
  expect(JSON.stringify(afterClear)).not.toContain("REQ-OBC-012");
});

test("detects broken cross references in the playground", async ({ page }, testInfo) => {
  await page.goto("/");

  const brokenReferencePath = testInfo.outputPath("broken-reference.document.json");
  await writeFile(
    brokenReferencePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        type: "doc",
        attrs: { id: "doc_broken_reference" },
        content: [
          { type: "heading", attrs: { id: "blk_overview", level: 1, anchor: "overview" }, content: [{ type: "text", text: "Overview" }] },
          {
            type: "paragraph",
            attrs: { id: "blk_ref" },
            content: [
              { type: "text", text: "See " },
              { type: "crossReference", attrs: { id: "ref_missing", targetId: "blk_missing" }, content: [{ type: "text", text: "Missing section" }] }
            ]
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  await page.getByLabel("Open document file").setInputFiles(brokenReferencePath);
  await expect(page.locator(".status-note")).toContainText("Opened broken-reference.document.json");
  await page.getByRole("button", { name: "Diagnostics panel" }).click();
  await expect(page.getByRole("complementary", { name: "Diagnostics side panel" })).toBeVisible();
  await expect(page.locator(".reference-summary")).toContainText("1");
  await expect(page.locator(".reference-summary")).toContainText("Broken");
  await expect(page.locator(".reference-issue-list")).toContainText("blk_missing");
  await expect(page.locator(".reference-target-list")).toContainText("blk_overview");
  await expect
    .poll(() => page.locator("style[data-sdoc-broken-reference-runtime]").evaluate((node) => node.textContent ?? ""))
    .toContain("missing blk_missing");
  await expect(page.locator('.editor-surface .sdoc-cross-reference[data-id="ref_missing"]')).toContainText("Missing section");

  const brokenItem = page.locator(".reference-issue-list li").filter({ hasText: "ref_missing" });
  await brokenItem.getByRole("button", { name: "Show" }).click();
  await expect(page.locator(".status-note")).toContainText("Focused reference Missing section");
  await expect(page.locator('.editor-node-highlight[data-highlighted-node-id="ref_missing"]')).toBeVisible();

  await selectPreviewTab(page, "JSON");
  const document = await readPreviewDocument(page);
  expect(findFirstNodeByType(document, "crossReference").attrs?.targetId).toBe("blk_missing");
  expectUniqueIds(collectBlockIds(document));

  await brokenItem.getByRole("button", { name: /Retarget.*Overview/ }).click();
  await expect(page.locator(".status-note")).toContainText("Retargeted reference to Overview");
  await expect(page.locator(".reference-empty")).toContainText("All references resolve");
  await selectPreviewTab(page, "JSON");
  const retargetedDocument = await readPreviewDocument(page);
  const retargetedReference = findFirstNodeByType(retargetedDocument, "crossReference");
  expect(retargetedReference.attrs?.targetId).toBe("blk_overview");
  expect(findTextNode(retargetedReference, "Overview").text).toBe("Overview");
  expect(JSON.stringify(retargetedDocument)).not.toContain("reference-repair");

  await page.getByLabel("Open document file").setInputFiles(brokenReferencePath);
  const reopenedBrokenItem = page.locator(".reference-issue-list li").filter({ hasText: "ref_missing" });
  await reopenedBrokenItem.getByRole("button", { name: "Remove reference" }).click();
  await expect(page.locator(".status-note")).toContainText("Removed broken reference: Missing section");
  await expect(page.locator(".reference-empty")).toContainText("All references resolve");
  await selectPreviewTab(page, "JSON");
  const removedDocument = await readPreviewDocument(page);
  expect(JSON.stringify(removedDocument)).not.toContain("ref_missing");
  expect(findFirstNodeByTypeOrNull(removedDocument, "crossReference")).toBeNull();

  await page.getByRole("button", { name: "Settings panel" }).click();
  await expect(page.getByRole("complementary", { name: "Settings side panel" }).getByLabel("Schema status")).toContainText("Valid");
});

test("round-trips a downloaded .sdoc through the browser open flow", async ({ page }, testInfo) => {
  await page.goto("/");

  await page.getByLabel("Title", { exact: true }).fill("Round Trip E2E");
  await page.getByLabel("Author", { exact: true }).fill("QA");
  await page.getByLabel("Version", { exact: true }).fill("1.0");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  expect(sdocDownload.suggestedFilename()).toBe("Round Trip E2E.sdoc");

  const sdocPath = testInfo.outputPath("Round Trip E2E.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Untitled");

  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Round Trip E2E.sdoc");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Round Trip E2E");
  await expect(page.getByLabel("Author", { exact: true })).toHaveValue("QA");
  await expect(page.getByLabel("Version", { exact: true })).toHaveValue("1.0");
  await page.getByRole("button", { name: "Settings panel" }).click();
  if ((await page.getByLabel("Metadata author").count()) === 0) {
    await page.getByRole("button", { name: "Settings panel" }).click();
  }
  await expect(page.getByLabel("Metadata author")).toHaveValue("QA");
  await expect(page.getByLabel("Metadata version")).toHaveValue("1.0");
  await expect(page.locator(".editor-surface")).toContainText("System Overview");

  await selectPreviewTab(page, "JSON");
  await expect(page.locator(".preview-output")).toContainText('"id": "blk_overview"');
  await expect(page.locator(".preview-output")).toContainText('"anchor": "overview"');
});

test("inserts an image figure and round-trips .sdoc assets", async ({ page }, testInfo) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  const imagePath = testInfo.outputPath("architecture-diagram.png");
  const replacementImagePath = testInfo.outputPath("reviewed-architecture.png");
  const imageBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
  await writeFile(
    imagePath,
    imageBytes
  );
  await writeFile(replacementImagePath, imageBytes);

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.getByRole("button", { name: "Insert image" }).click();
  await page.getByLabel("Insert image file").setInputFiles(imagePath);

  await expect(page.locator(".status-note")).toContainText("Inserted image architecture-diagram.png");
  await expect(page.locator('.editor-surface figure[data-type="figure"] img')).toBeVisible();
  await page.getByRole("button", { name: "Outline panel" }).click();
  const figureList = page.getByRole("complementary", { name: "Outline side panel" }).getByLabel("Figure list");
  await expect(figureList).toContainText("Figure 1");
  await expect(figureList).toContainText("architecture diagram");

  const insertedDocument = await readPreviewDocument(page);
  const insertedFigure = findFirstNodeByType(insertedDocument, "figure");
  const insertedFigureId = insertedFigure.attrs?.id;
  const insertedCaptionId = insertedFigure.content?.[0]?.attrs?.id;
  const insertedAssetId = insertedFigure.attrs?.assetId;
  expect(insertedFigure.attrs?.assetId).toEqual(expect.stringMatching(/^asset_[a-z0-9]+\.png$/));
  expect(insertedFigure.attrs?.alt).toBe("architecture diagram");
  expect(JSON.stringify(insertedDocument)).not.toContain("data:image/png");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await page.locator('.editor-surface figure[data-type="figure"] img').click({ button: "right" });
  const imageContextMenu = page.getByRole("menu", { name: "Image context menu" });
  await expect(imageContextMenu).toBeVisible();
  await imageContextMenu.getByRole("menuitem", { name: "Edit image" }).click();
  const imageDialog = page.getByRole("dialog", { name: "Edit image" });
  await imageDialog.getByLabel("Alt text").fill("");
  await expect(imageDialog.getByRole("button", { name: "Update image" })).toBeDisabled();
  await expect(imageDialog.getByText("Enter alt text")).toBeVisible();
  await imageDialog.getByLabel("Alt text").fill("Reviewed architecture alt");
  await imageDialog.getByLabel("Caption").fill("Reviewed system architecture");
  await imageDialog.getByLabel("Alignment").selectOption("right");
  await imageDialog.getByLabel("Replace image file").setInputFiles(replacementImagePath);
  await expect(imageDialog.getByText("Ready to replace with reviewed-architecture.png")).toBeVisible();
  await imageDialog.getByRole("button", { name: "Update image" }).click();
  await expect(page.locator(".status-note")).toContainText("Replaced image with reviewed-architecture.png");
  await expect(page.locator('.editor-surface figure[data-type="figure"]')).toHaveAttribute("data-align", "right");
  await expect(page.locator('.editor-surface figure[data-type="figure"] img')).toHaveAttribute("alt", "Reviewed architecture alt");
  await expect(page.locator('.editor-surface figure[data-type="figure"] figcaption')).toContainText("Reviewed system architecture");

  const editedDocument = await readPreviewDocument(page);
  const editedFigure = findFirstNodeByType(editedDocument, "figure");
  expect(editedFigure.attrs?.id).toBe(insertedFigureId);
  expect(editedFigure.content?.[0]?.attrs?.id).toBe(insertedCaptionId);
  expect(editedFigure.attrs?.assetId).not.toBe(insertedAssetId);
  expect(editedFigure.attrs?.alt).toBe("Reviewed architecture alt");
  expect(editedFigure.attrs?.align).toBe("right");
  expect(JSON.stringify(editedDocument)).not.toContain("data:image/png");
  expectUniqueIds(collectBlockIds(editedDocument));

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("![Reviewed architecture alt]");
  await expect(page.locator(".preview-output")).toContainText("_Figure: Reviewed system architecture_");
  await expect(page.locator(".preview-output")).toContainText("](assets/");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Figure Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Figure Round Trip.sdoc");
  await expect(page.locator('.editor-surface figure[data-type="figure"] img')).toBeVisible();
  await expect(page.locator(".editor-surface")).toContainText("Reviewed system architecture");

  await selectPreviewTab(page, "JSON");
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedFigure = findFirstNodeByType(reopenedDocument, "figure");
  expect(reopenedFigure.attrs?.id).toBe(insertedFigureId);
  expect(reopenedFigure.content?.[0]?.attrs?.id).toBe(insertedCaptionId);
  expect(reopenedFigure.attrs?.assetId).toBe(editedFigure.attrs?.assetId);
  expect(reopenedFigure.attrs?.align).toBe("right");
  expect(JSON.stringify(reopenedDocument)).not.toContain("data:image/png");
  expectUniqueIds(collectBlockIds(reopenedDocument));

  await page.locator('.editor-surface figure[data-type="figure"] img').click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit image" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Edit image" });
  await deleteDialog.getByRole("button", { name: "Delete image" }).click();
  await expect(deleteDialog.getByRole("button", { name: "Confirm delete" })).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.locator(".status-note")).toContainText("Deleted image");
  await expect(page.locator('.editor-surface figure[data-type="figure"]')).toHaveCount(0);
  expect(JSON.stringify(await readPreviewDocument(page))).not.toContain('"type":"figure"');
});

test("names and stores a pasted clipboard image through a dialog", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  await page.locator(".editor-surface").evaluate((surface, encoded) => {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "image.png", { type: "image/png" }));
    surface.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, pngBase64);

  const dialog = page.getByRole("dialog", { name: "Insert pasted image" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Image name").fill("converter-scope.png");
  await dialog.getByLabel("Caption and alt text").fill("Converter scope capture");
  await dialog.getByRole("button", { name: "Insert image" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted pasted image converter-scope.png");

  const insertedDocument = await readPreviewDocument(page);
  const insertedFigure = findFirstNodeByType(insertedDocument, "figure");
  expect(insertedFigure.attrs?.assetId).toEqual(expect.stringMatching(/^asset_[a-z0-9]+\.png$/));
  expect(insertedFigure.attrs?.alt).toBe("Converter scope capture");
  expect(JSON.stringify(insertedDocument)).not.toContain("data:image/png");
  expectUniqueIds(collectBlockIds(insertedDocument));

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocPath = testInfo.outputPath("Pasted Image Round Trip.sdoc");
  await (await downloadPromise).saveAs(sdocPath);
  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".editor-surface")).toContainText("Converter scope capture");
  const reopenedFigure = findFirstNodeByType(await readPreviewDocument(page), "figure");
  expect(reopenedFigure.attrs?.assetId).toBe(insertedFigure.attrs?.assetId);
});

test("inserts a data grid and round-trips .sdoc assets", async ({ page }, testInfo) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  const csvPath = testInfo.outputPath("pinout.csv");
  await writeFile(csvPath, "pin,signal\n1,VCC\n2,GND\n");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await openToolbarMenu(page, "More insert");
  await page.getByRole("button", { name: "Insert data grid" }).click();
  await page.getByLabel("Insert data grid file").setInputFiles(csvPath);

  await expect(page.locator(".status-note")).toContainText("Inserted data grid pinout.csv");
  await expect(page.locator('.editor-surface div[data-type="dataGrid"]')).toBeVisible();
  await expect(page.locator(".editor-surface")).toContainText("pinout");

  const insertedDocument = await readPreviewDocument(page);
  const insertedGrid = findFirstNodeByType(insertedDocument, "dataGrid");
  expect(insertedGrid.attrs?.sourceAssetId).toEqual(expect.stringMatching(/^asset_[a-z0-9]+\.csv$/));
  expect(insertedGrid.attrs?.format).toBe("csv");
  expect(insertedGrid.attrs?.title).toBe("pinout");
  expect(JSON.stringify(insertedDocument)).not.toContain("pin,signal");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await page.getByRole("button", { name: "Developer panel" }).click();
  const developerPanel = page.getByRole("complementary", { name: "Developer side panel" });
  const gridDiagnostics = developerPanel.getByLabel("Data grid diagnostics");
  await expect(gridDiagnostics).toContainText("Grids");
  await expect(gridDiagnostics).toContainText("Rows valid");
  await expect(gridDiagnostics).toContainText("2 rows");
  await expect(gridDiagnostics).toContainText("2 columns");

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("> Data grid: pinout");
  await expect(page.locator(".preview-output")).toContainText("> Source: assets/");
  await expect(page.locator(".preview-output")).not.toContainText("pin,signal");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Data Grid Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Data Grid Round Trip.sdoc");
  await expect(page.locator('.editor-surface div[data-type="dataGrid"]')).toBeVisible();

  await selectPreviewTab(page, "JSON");
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedGrid = findFirstNodeByType(reopenedDocument, "dataGrid");
  expect(reopenedGrid.attrs?.sourceAssetId).toBe(insertedGrid.attrs?.sourceAssetId);
  expect(JSON.stringify(reopenedDocument)).not.toContain("pin,signal");
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("inserts a simple table and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.getByRole("button", { name: "Insert table" }).click();
  const insertDialog = page.getByRole("dialog", { name: "Insert table" });
  await insertDialog.getByLabel("Rows").fill("1");
  await expect(insertDialog.getByRole("button", { name: "Insert table" })).toBeDisabled();
  await expect(insertDialog.getByText("Rows must be a whole number from 2 to 20")).toBeVisible();
  await insertDialog.getByLabel("Rows").fill("3");
  await insertDialog.getByLabel("Columns").fill("2");
  await insertDialog.getByLabel("Caption").fill("Initial readiness matrix");
  await insertDialog.getByRole("button", { name: "Insert table" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted table");
  await expect(page.locator(".editor-surface table")).toBeVisible();

  await fillTableCell(page, "th", 0, "Name");
  await fillTableCell(page, "th", 1, "Status");
  await fillTableCell(page, "td", 0, "API");
  await fillTableCell(page, "td", 1, "Ready");
  await openToolbarMenu(page, "Table tools");
  await page.getByRole("button", { name: "Edit table" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit table" });
  await expect(editDialog.getByLabel("Caption")).toHaveValue("Initial readiness matrix");
  await editDialog.getByLabel("Caption").fill("API readiness matrix");
  await editDialog.getByLabel("Use first row as header").uncheck();
  await editDialog.getByLabel("Selected cell alignment").selectOption("center");
  await editDialog.getByRole("button", { name: "Update table" }).click();
  await expect(page.locator(".status-note")).toContainText("Updated table");
  await expect(page.locator(".editor-surface table th")).toHaveCount(0);
  await openToolbarMenu(page, "Table tools");
  await page.getByRole("button", { name: "Edit table" }).click();
  const restoreHeaderDialog = page.getByRole("dialog", { name: "Edit table" });
  await restoreHeaderDialog.getByLabel("Use first row as header").check();
  await restoreHeaderDialog.getByRole("button", { name: "Update table" }).click();
  await expect(page.locator(".editor-surface table th")).toHaveCount(2);
  await expect(page.locator(".editor-surface table")).toHaveAttribute("data-caption", "API readiness matrix");

  await page.getByRole("button", { name: "Outline panel" }).click();
  const tableList = page.getByRole("complementary", { name: "Outline side panel" }).getByLabel("Table list");
  await expect(tableList).toContainText("Table 1");
  await expect(tableList).toContainText("API readiness matrix");

  await expect.poll(async () => findFirstNodeByType(await readPreviewDocument(page), "table").attrs?.id).toEqual(expect.any(String));
  const insertedDocument = await readPreviewDocument(page);
  expect(findFirstNodeByType(insertedDocument, "table").attrs?.caption).toBe("API readiness matrix");
  expect(JSON.stringify(findFirstNodeByType(insertedDocument, "table"))).toContain('"align":"center"');
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("| Name | Status |");
  await expect(page.locator(".preview-output")).toContainText("| API | Ready |");
  await expect(page.locator(".preview-output")).toContainText("_Table: API readiness matrix_");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Table Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Table Round Trip.sdoc");
  await expect(page.locator(".editor-surface table")).toBeVisible();
  await expect(page.locator(".editor-surface table")).toContainText("Ready");

  await selectPreviewTab(page, "JSON");
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedTable = findFirstNodeByType(reopenedDocument, "table");
  expect(reopenedTable.attrs?.id).toBe(findFirstNodeByType(insertedDocument, "table").attrs?.id);
  expect(reopenedTable.attrs?.caption).toBe("API readiness matrix");
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("uses advanced table controls without storing transient table UI state", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.getByRole("button", { name: "Insert table" }).click();
  await page.getByRole("dialog", { name: "Insert table" }).getByRole("button", { name: "Insert table" }).click();
  await fillTableCell(page, "th", 0, "Name");
  await fillTableCell(page, "th", 1, "Status");
  await fillTableCell(page, "td", 0, "API");
  await fillTableCell(page, "td", 1, "Ready");

  await openToolbarMenu(page, "Table tools");
  await page.getByRole("button", { name: "Align table cell center" }).click();
  await expect(page.locator(".status-note")).toContainText("Aligned table cell center");
  await openToolbarMenu(page, "Table tools");
  await page.getByRole("button", { name: "Add column after" }).click();
  await expect(page.locator(".status-note")).toContainText("Added table column");
  await openToolbarMenu(page, "Table tools");
  await page.getByRole("button", { name: "Add row after" }).click();
  await expect(page.locator(".status-note")).toContainText("Added table row");
  await openToolbarMenu(page, "Table tools");
  await page.getByRole("button", { name: "Toggle header column" }).click();
  await expect(page.locator(".status-note")).toContainText("Toggled header column");

  await expect.poll(async () => {
    const table = findFirstNodeByType(await readPreviewDocument(page), "table");
    return table.content?.length;
  }).toBe(4);

  const document = await readPreviewDocument(page);
  const table = findFirstNodeByType(document, "table");
  expect(table.content).toHaveLength(4);
  expect(table.content?.every((row: JsonNode) => row.content?.length === 3)).toBe(true);
  expect(JSON.stringify(table)).toContain('"align":"center"');
  expect(JSON.stringify(table)).not.toContain("colwidth");
  expect(JSON.stringify(table)).not.toContain("selectedCell");
  expectUniqueIds(collectBlockIds(document));

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText(":---:");
});

test("inserts inline and block equations and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.keyboard.type("Energy ");

  await openToolbarMenu(page, "More insert");
  await page.getByRole("button", { name: "Insert inline equation" }).click();
  const inlineDialog = page.getByRole("dialog", { name: "Insert inline equation" });
  await inlineDialog.getByLabel("LaTeX source").fill("\\notARealCommand{");
  await expect(inlineDialog.getByRole("button", { name: "Insert equation" })).toBeDisabled();
  await inlineDialog.getByLabel("LaTeX source").fill("E=mc^2");
  await expect(inlineDialog.getByLabel("Equation preview").locator(".katex")).toBeVisible();
  await inlineDialog.getByRole("button", { name: "Insert equation" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted inline equation");
  await expect(page.locator(".editor-surface .sdoc-inline-equation .katex")).toBeVisible();

  await openToolbarMenu(page, "More insert");
  await page.getByRole("button", { name: "Insert equation block" }).click();
  const blockDialog = page.getByRole("dialog", { name: "Insert block equation" });
  await blockDialog.getByLabel("LaTeX source").fill("a^2+b^2=c^2");
  await blockDialog.getByRole("button", { name: "Insert equation" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted equation block");
  await expect(page.locator(".editor-surface .sdoc-equation-block .katex")).toBeVisible();

  await page.locator(".editor-surface .sdoc-equation-block").dblclick();
  const editDialog = page.getByRole("dialog", { name: "Edit equation" });
  await expect(editDialog.getByLabel("LaTeX source")).toHaveValue("a^2+b^2=c^2");
  await editDialog.getByLabel("LaTeX source").fill("x^2+y^2=z^2");
  await editDialog.getByRole("button", { name: "Update equation" }).click();
  await expect(page.locator(".status-note")).toContainText("Updated equation");

  const insertedDocument = await readPreviewDocument(page);
  expect(findFirstNodeByType(insertedDocument, "equation").attrs?.latex).toBe("E=mc^2");
  expect(findFirstNodeByType(insertedDocument, "equationBlock").attrs?.latex).toBe("x^2+y^2=z^2");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("Energy $E=mc^2$");
  await expect(page.locator(".preview-output")).toContainText("$$\nx^2+y^2=z^2\n$$");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Equation Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Equation Round Trip.sdoc");
  await expect(page.locator(".editor-surface .sdoc-inline-equation .katex")).toBeVisible();
  await expect(page.locator(".editor-surface .sdoc-equation-block .katex")).toBeVisible();

  await selectPreviewTab(page, "JSON");
  const reopenedDocument = await readPreviewDocument(page);
  expect(findFirstNodeByType(reopenedDocument, "equation").attrs?.latex).toBe("E=mc^2");
  expect(findFirstNodeByType(reopenedDocument, "equationBlock").attrs?.latex).toBe("x^2+y^2=z^2");
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("inserts a Mermaid diagram and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();

  await openToolbarMenu(page, "More insert");
  await page.getByRole("button", { name: "Insert Mermaid diagram" }).click();
  const insertDialog = page.getByRole("dialog", { name: "Insert Mermaid diagram" });
  await expect(insertDialog).toBeVisible();
  await insertDialog.getByLabel("Mermaid source").fill("flowchart TD\nA[broken");
  await expect(insertDialog.getByRole("button", { name: "Insert diagram" })).toBeDisabled();
  await expect(insertDialog.locator(".dialog-validation")).not.toContainText("Valid Mermaid source");
  await insertDialog.getByLabel("Mermaid source").fill("flowchart TD\nA[Start] --> B[Done]");
  await expect(insertDialog.getByLabel("Mermaid preview").locator("svg")).toBeVisible();
  await expect(insertDialog.getByText("Valid Mermaid source")).toBeVisible();
  await insertDialog.getByRole("button", { name: "Insert diagram" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted Mermaid diagram");
  await expect(page.locator(".editor-surface .sdoc-diagram svg")).toBeVisible();

  const insertedDocument = await readPreviewDocument(page);
  const insertedDiagram = findFirstNodeByType(insertedDocument, "diagram");
  const insertedDiagramId = insertedDiagram.attrs?.id;
  expect(insertedDiagram.attrs?.kind).toBe("mermaid");
  expect(insertedDiagram.attrs?.source).toBe("flowchart TD\nA[Start] --> B[Done]");
  expect(JSON.stringify(insertedDocument)).not.toContain("<svg");
  expectUniqueIds(collectBlockIds(insertedDocument));

  await page.locator(".editor-surface .sdoc-diagram").click({ button: "right" });
  const mermaidContextMenu = page.getByRole("menu", { name: "Mermaid context menu" });
  await expect(mermaidContextMenu).toBeVisible();
  await mermaidContextMenu.getByRole("menuitem", { name: "Edit Mermaid diagram" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit Mermaid diagram" });
  await expect(editDialog.getByLabel("Mermaid source")).toHaveValue("flowchart TD\nA[Start] --> B[Done]");
  await editDialog.getByLabel("Mermaid source").fill("flowchart TD\nA[Start] --> B[Reviewed]");
  await expect(editDialog.getByLabel("Mermaid preview").locator("svg")).toBeVisible();
  await editDialog.getByRole("button", { name: "Update diagram" }).click();
  await expect(page.locator(".status-note")).toContainText("Updated Mermaid diagram");

  const editedDocument = await readPreviewDocument(page);
  const editedDiagram = findFirstNodeByType(editedDocument, "diagram");
  expect(editedDiagram.attrs?.id).toBe(insertedDiagramId);
  expect(editedDiagram.attrs?.source).toBe("flowchart TD\nA[Start] --> B[Reviewed]");
  expect(JSON.stringify(editedDocument)).not.toContain("<svg");

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("```mermaid");
  await expect(page.locator(".preview-output")).toContainText("A[Start] --> B[Reviewed]");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Diagram Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Diagram Round Trip.sdoc");
  await expect(page.locator(".editor-surface .sdoc-diagram svg")).toBeVisible();

  await selectPreviewTab(page, "JSON");
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedDiagram = findFirstNodeByType(reopenedDocument, "diagram");
  expect(reopenedDiagram.attrs?.id).toBe(insertedDiagramId);
  expect(reopenedDiagram.attrs?.source).toBe("flowchart TD\nA[Start] --> B[Reviewed]");
  expect(JSON.stringify(reopenedDocument)).not.toContain("<svg");
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("imports a Draw.io source asset and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();

  const sourcePath = testInfo.outputPath("architecture.drawio");
  await writeFile(sourcePath, '<mxfile><diagram id="d1" name="Page-1">diagram-source</diagram></mxfile>', "utf8");

  await page.getByLabel("Import Draw.io source file").setInputFiles(sourcePath);
  await expect(page.locator(".status-note")).toContainText("Inserted Draw.io diagram architecture.drawio");
  await expect(page.locator(".editor-surface .sdoc-diagram pre")).toContainText("Draw.io diagram source:");

  const insertedDocument = await readPreviewDocument(page);
  const insertedDiagram = findFirstNodeByType(insertedDocument, "diagram");
  expect(insertedDiagram.attrs?.kind).toBe("drawio");
  expect(String(insertedDiagram.attrs?.sourceAssetId)).toMatch(/^asset_[a-z0-9_]+\.drawio$/);
  expect(insertedDiagram.attrs?.previewAssetId).toBeUndefined();
  expect(JSON.stringify(insertedDocument)).not.toContain("diagram-source");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await selectPreviewTab(page, "Markdown");
  await expect(page.locator(".preview-output")).toContainText("Draw.io diagram: source asset");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Drawio Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Drawio Round Trip.sdoc");
  await expect(page.locator(".editor-surface .sdoc-diagram pre")).toContainText("Draw.io diagram source:");

  await selectPreviewTab(page, "JSON");
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedDiagram = findFirstNodeByType(reopenedDocument, "diagram");
  expect(reopenedDiagram.attrs?.kind).toBe("drawio");
  expect(reopenedDiagram.attrs?.sourceAssetId).toBe(insertedDiagram.attrs?.sourceAssetId);
  expect(JSON.stringify(reopenedDocument)).not.toContain("diagram-source");
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("creates a new Draw.io diagram as an asset-backed source", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Create a new Draw.io diagram?");
    await dialog.accept();
  });
  await openToolbarMenu(page, "More insert");
  await page.getByRole("button", { name: "Insert Draw.io diagram" }).click();
  await expect(page.locator(".status-note")).toContainText("Created Draw.io diagram");
  await expect(page.locator(".editor-surface .sdoc-diagram pre")).toContainText("Draw.io diagram source:");

  const document = await readPreviewDocument(page);
  const diagram = findFirstNodeByType(document, "diagram");
  expect(diagram.attrs?.kind).toBe("drawio");
  expect(String(diagram.attrs?.sourceAssetId)).toMatch(/^asset_[a-z0-9_]+\.drawio$/);
  expect(JSON.stringify(document)).not.toContain("<mxfile");
  expectUniqueIds(collectBlockIds(document));
});

test("resolves a Draw.io external edit conflict as a revision asset", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const editedSource = new TextEncoder().encode("<mxfile><diagram id=\"d1\">external-edit</diagram></mxfile>");
    (window as typeof window & { __drawioLaunches?: Array<{ sessionId: string; executablePath?: string }> }).__drawioLaunches = [];
    (window as typeof window & { __SDOC_NATIVE_SAVE_BRIDGE__?: unknown }).__SDOC_NATIVE_SAVE_BRIDGE__ = {
      async saveSdoc() {
        return undefined;
      },
      async checkoutDrawioSource(sourceAssetId: string) {
        return {
          sessionId: "drawio-test-session",
          sourceAssetId,
          tempPath: "C:/Temp/asset.drawio",
          originalSourceHash: "hash-original"
        };
      },
      async openDrawioExternalEditor(sessionId: string, executablePath?: string) {
        (window as typeof window & { __drawioLaunches?: Array<{ sessionId: string; executablePath?: string }> }).__drawioLaunches?.push({
          sessionId,
          executablePath
        });
        return { status: "opened", sessionId };
      },
      async readDrawioExternalEdit(sessionId: string) {
        return {
          status: "conflict",
          sessionId,
          sourceAssetId: "asset.drawio",
          sourceHash: "hash-edited",
          sourceBytes: editedSource,
          message: "Draw.io source changed during external editing."
        };
      },
      async closeDrawioExternalEdit(sessionId: string) {
        return { status: "closed", sessionId };
      }
    };
  });

  await page.goto("/");
  await selectPreviewTab(page, "JSON");
  await page.getByRole("button", { name: "Settings panel" }).click();
  await page.getByLabel("Draw.io executable").fill("C:\\Program Files\\draw.io\\draw.io.exe");
  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();

  const sourcePath = testInfo.outputPath("architecture.drawio");
  await writeFile(sourcePath, '<mxfile><diagram id="d1">current-source</diagram></mxfile>', "utf8");
  await page.getByLabel("Import Draw.io source file").setInputFiles(sourcePath);
  await expect(page.locator(".status-note")).toContainText("Inserted Draw.io diagram architecture.drawio");
  await page.locator(".editor-surface .sdoc-diagram").click();

  await openToolbarMenu(page, "Draw.io tools");
  await page.getByRole("button", { name: "Open Draw.io external editor" }).click();
  await expect(page.locator(".status-note")).toContainText("Opened Draw.io source");
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __drawioLaunches?: Array<{ sessionId: string; executablePath?: string }> }).__drawioLaunches)
    )
    .toEqual([{ sessionId: "drawio-test-session", executablePath: "C:\\Program Files\\draw.io\\draw.io.exe" }]);
  await openToolbarMenu(page, "Draw.io tools");
  await page.getByRole("button", { name: "Read Draw.io external edit" }).click();
  await expect(page.getByLabel("Draw.io external edit conflict")).toContainText("Draw.io external edit conflict");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Save as revision" }).click();
  await expect(page.locator(".status-note")).toContainText("Saved Draw.io external edit as");

  await selectPreviewTab(page, "JSON");
  const revisedDocument = await readPreviewDocument(page);
  const revisedDiagram = findFirstNodeByType(revisedDocument, "diagram");
  expect(revisedDiagram.attrs?.kind).toBe("drawio");
  expect(String(revisedDiagram.attrs?.sourceAssetId)).toMatch(/^asset_[a-z0-9_]+\.rev1\.drawio$/);
  expect(JSON.stringify(revisedDocument)).not.toContain("draw.io.exe");
  expect(JSON.stringify(revisedDocument)).not.toContain("external-edit");
  expect(JSON.stringify(revisedDocument)).not.toContain("current-source");
  expectUniqueIds(collectBlockIds(revisedDocument));
  await expect(page.getByLabel("Draw.io external edit conflict")).toHaveCount(0);

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  await sdocDownload.saveAs(testInfo.outputPath("Drawio Conflict Revision.sdoc"));
});

test("reports unsupported files without replacing the current document", async ({ page }, testInfo) => {
  await page.goto("/");

  const invalidPath = testInfo.outputPath("notes.txt");
  await writeFile(invalidPath, "not an sdoc document", "utf8");

  await page.getByLabel("Open document file").setInputFiles(invalidPath);

  await expect(page.locator(".status-note")).toContainText("Unsupported file type: notes.txt");
  await expect(page.locator(".editor-surface")).toContainText("System Overview");
  await expect(page.getByText("Valid")).toBeVisible();
});

test("preserves unique block ids across split undo and redo", async ({ page }) => {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

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

  await placeCursorAtEndOfFirstParagraph(page);
  await page.keyboard.press("Control+Z");
  await expect.poll(async () => collectBlockIds(await readPreviewDocument(page)).join("|")).toBe(initialIds.join("|"));

  await placeCursorAtEndOfFirstParagraph(page);
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
  await selectPreviewTab(page, "JSON");

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

test("applies inline mark toolbar commands to selected text", async ({ page }) => {
  await assertInlineToolbarCommands(page);
});

test("applies block toolbar commands to a selected paragraph", async ({ page }) => {
  for (const toolbarCase of blockToolbarCases) {
    await assertBlockToolbarCommand(page, toolbarCase);
  }
});

test("moves top-level blocks with toolbar buttons without changing ids", async ({ page }) => {
  await assertMoveToolbarActions(page);
});

test("applies editing toolbar commands on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertInlineToolbarCommands(page);

  for (const toolbarCase of blockToolbarCases) {
    await assertBlockToolbarCommand(page, toolbarCase);
  }

  await assertMoveToolbarActions(page);
});

test("keeps the playground usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("region", { name: "Document workflow" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open .sdoc", exact: true })).toBeVisible();
  await expect(page.locator(".editor-surface")).toContainText("System Overview");

  const fitsViewport = await page.evaluate(() => {
    const selectors = [".app-shell", ".toolbar", ".editor-surface"];
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

async function selectPreviewTab(page: Page, tab: "JSON" | "Markdown" | "Diff"): Promise<void> {
  if ((await page.locator(".tabs").count()) === 0) {
    await page.getByRole("button", { name: "Preview" }).click();
  }
  await page.locator(".tabs").getByRole("button", { name: tab }).click();
}

async function readPreviewDocument(page: Page): Promise<JsonNode> {
  await selectPreviewTab(page, "JSON");
  return JSON.parse(await page.locator(".preview-output").innerText()) as JsonNode;
}

async function fillTableCell(page: Page, selector: "th" | "td", index: number, text: string): Promise<void> {
  const cell = page.locator(`.editor-surface ${selector} p`).nth(index);
  await cell.click();
  await page.keyboard.type(text);
  await expect(cell).toContainText(text);
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

async function assertInlineToolbarCommands(page: Page): Promise<void> {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  await page.locator(".editor-surface p").first().click({ clickCount: 3 });
  for (const command of inlineToolbarCommands) {
    await page.getByRole("button", { name: command, exact: true }).click();
  }

  const document = await readPreviewDocument(page);
  const intro = findNodeById(document, "blk_intro");
  const textNode = findTextNode(intro, "This document describes the initial SDoc editor shell.");
  expect(markTypes(textNode)).toEqual(expect.arrayContaining([...inlineToolbarCommands.map((command) => command.toLowerCase())]));
  expectUniqueIds(collectBlockIds(document));
  await expect(page.getByText("Valid")).toBeVisible();
}

async function assertBlockToolbarCommand(page: Page, toolbarCase: BlockToolbarCase): Promise<void> {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");
  const text = `Toolbar ${toolbarCase.button}`;
  await createSingleParagraphDocument(page, text);
  await page.locator(".editor-surface p").first().click({ clickCount: 3 });
  if (["Blockquote", "Code block", "Note callout", "Warning callout"].includes(toolbarCase.button)) {
    await openToolbarMenu(page, "More insert");
  }
  await page.getByRole("button", { name: toolbarCase.button }).click();

  await expect.poll(async () => firstTopLevelNodeContainingText(await readPreviewDocument(page), text)?.type).toBe(toolbarCase.topType);

  const document = await readPreviewDocument(page);
  const transformed = firstTopLevelNodeContainingText(document, text);
  expect(transformed?.attrs).toMatchObject(toolbarCase.attrs ?? {});
  expectUniqueIds(collectBlockIds(document));
  await expect(page.getByText("Valid")).toBeVisible();
}

async function openToolbarMenu(page: Page, label: string): Promise<void> {
  const summary = page.getByLabel(`${label} menu`);
  await expect(summary).toBeVisible();
  const details = summary.locator("..");
  if ((await details.getAttribute("open")) === null) {
    await summary.click();
  }
  await expect(details).toHaveAttribute("open", "");
}

async function assertMoveToolbarActions(page: Page): Promise<void> {
  await page.goto("/");
  await selectPreviewTab(page, "JSON");

  const initialIds = collectTopLevelIds(await readPreviewDocument(page));
  expect(initialIds.slice(0, 3)).toEqual(["blk_overview", "blk_intro", "blk_note"]);

  await page.locator(".editor-surface h1").click();
  await openToolbarMenu(page, "Structure");
  await page.getByRole("button", { name: "Move block down" }).click();
  await selectPreviewTab(page, "JSON");
  await expect.poll(async () => collectTopLevelIds(await readPreviewDocument(page)).slice(0, 3).join("|")).toBe("blk_intro|blk_overview|blk_note");

  const movedIds = collectTopLevelIds(await readPreviewDocument(page));
  expect(movedIds).toEqual(expect.arrayContaining(initialIds));
  expectUniqueIds(collectBlockIds(await readPreviewDocument(page)));

  await page.locator(".editor-surface h1").click();
  await openToolbarMenu(page, "Structure");
  await page.getByRole("button", { name: "Move block up" }).click();
  await selectPreviewTab(page, "JSON");
  await expect.poll(async () => collectTopLevelIds(await readPreviewDocument(page)).slice(0, initialIds.length).join("|")).toBe(initialIds.join("|"));
  await expect(page.getByText("Valid")).toBeVisible();
}

async function createSingleParagraphDocument(page: Page, text: string): Promise<void> {
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Untitled");
  await page.locator(".editor-surface").click();
  await page.keyboard.type(text);
  await expect(page.locator(".editor-surface")).toContainText(text);
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

function collectTopLevelIds(node: JsonNode): string[] {
  return (node.content ?? []).flatMap((child) => (typeof child.attrs?.id === "string" ? [child.attrs.id] : []));
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

function findNodeById(node: JsonNode, id: string): JsonNode {
  if (node.attrs?.id === id) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findNodeByIdOrNull(child, id);
    if (match) {
      return match;
    }
  }

  throw new Error(`missing node id ${id}`);
}

function findNodeByIdOrNull(node: JsonNode, id: string): JsonNode | null {
  if (node.attrs?.id === id) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findNodeByIdOrNull(child, id);
    if (match) {
      return match;
    }
  }

  return null;
}

function findTextNode(node: JsonNode, text: string): JsonNode {
  if (node.text === text) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findTextNodeOrNull(child, text);
    if (match) {
      return match;
    }
  }

  throw new Error(`missing text node ${text}`);
}

function findTextNodeOrNull(node: JsonNode, text: string): JsonNode | null {
  if (node.text === text) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findTextNodeOrNull(child, text);
    if (match) {
      return match;
    }
  }

  return null;
}

function findFirstNodeByType(node: JsonNode, type: string): JsonNode {
  if (node.type === type) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findFirstNodeByTypeOrNull(child, type);
    if (match) {
      return match;
    }
  }

  throw new Error(`missing node type ${type}`);
}

function findFirstNodeByTypeOrNull(node: JsonNode, type: string): JsonNode | null {
  if (node.type === type) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findFirstNodeByTypeOrNull(child, type);
    if (match) {
      return match;
    }
  }

  return null;
}

function firstTopLevelNodeContainingText(node: JsonNode, text: string): JsonNode | null {
  return (node.content ?? []).find((child) => countTextMatches(child, text) > 0) ?? null;
}

function markTypes(node: JsonNode): string[] {
  return (node.marks ?? []).flatMap((mark) => (typeof mark.type === "string" ? [mark.type] : []));
}
