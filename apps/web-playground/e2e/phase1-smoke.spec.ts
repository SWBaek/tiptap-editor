import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

interface JsonNode {
  type?: unknown;
  attrs?: {
    id?: unknown;
    assetId?: unknown;
    alt?: unknown;
    kind?: unknown;
    level?: unknown;
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

test("loads the Phase 2 playground and exercises preview/export basics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Phase 2 Playground")).toBeVisible();
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

  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Round Trip E2E.sdoc");
  await expect(page.getByLabel("Title")).toHaveValue("Round Trip E2E");
  await expect(page.getByLabel("Author")).toHaveValue("QA");
  await expect(page.getByLabel("Version")).toHaveValue("1.0");
  await expect(page.locator(".editor-surface")).toContainText("System Overview");

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  await expect(page.locator(".preview-output")).toContainText('"id": "blk_overview"');
  await expect(page.locator(".preview-output")).toContainText('"anchor": "overview"');
});

test("inserts an image figure and round-trips .sdoc assets", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  const imagePath = testInfo.outputPath("architecture-diagram.png");
  await writeFile(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  );

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.getByRole("button", { name: "Insert image" }).click();
  await page.getByLabel("Insert image file").setInputFiles(imagePath);

  await expect(page.locator(".status-note")).toContainText("Inserted image architecture-diagram.png");
  await expect(page.locator('.editor-surface figure[data-type="figure"] img')).toBeVisible();

  const insertedDocument = await readPreviewDocument(page);
  const insertedFigure = findFirstNodeByType(insertedDocument, "figure");
  expect(insertedFigure.attrs?.assetId).toEqual(expect.stringMatching(/^asset_[a-z0-9]+\.png$/));
  expect(insertedFigure.attrs?.alt).toBe("architecture diagram");
  expect(JSON.stringify(insertedDocument)).not.toContain("data:image/png");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".preview-output")).toContainText("_Figure: architecture diagram_");
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
  await expect(page.locator(".editor-surface")).toContainText("architecture diagram");

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedFigure = findFirstNodeByType(reopenedDocument, "figure");
  expect(reopenedFigure.attrs?.assetId).toBe(insertedFigure.attrs?.assetId);
  expect(JSON.stringify(reopenedDocument)).not.toContain("data:image/png");
  expectUniqueIds(collectBlockIds(reopenedDocument));
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

  await expect(page.getByText("Phase 2 Playground")).toBeVisible();
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

async function assertInlineToolbarCommands(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  await page.locator(".editor-surface p").first().click({ clickCount: 3 });
  for (const command of inlineToolbarCommands) {
    await page.getByRole("button", { name: command }).click();
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
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const text = `Toolbar ${toolbarCase.button}`;
  await createSingleParagraphDocument(page, text);
  await page.locator(".editor-surface p").first().click({ clickCount: 3 });
  await page.getByRole("button", { name: toolbarCase.button }).click();

  await expect.poll(async () => firstTopLevelNodeContainingText(await readPreviewDocument(page), text)?.type).toBe(toolbarCase.topType);

  const document = await readPreviewDocument(page);
  const transformed = firstTopLevelNodeContainingText(document, text);
  expect(transformed?.attrs).toMatchObject(toolbarCase.attrs ?? {});
  expectUniqueIds(collectBlockIds(document));
  await expect(page.getByText("Valid")).toBeVisible();
}

async function assertMoveToolbarActions(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  const initialIds = collectTopLevelIds(await readPreviewDocument(page));
  expect(initialIds.slice(0, 3)).toEqual(["blk_overview", "blk_intro", "blk_note"]);

  await page.locator(".editor-surface h1").click();
  await page.getByRole("button", { name: "Move block down" }).click();
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  await expect.poll(async () => collectTopLevelIds(await readPreviewDocument(page)).slice(0, 3).join("|")).toBe("blk_intro|blk_overview|blk_note");

  const movedIds = collectTopLevelIds(await readPreviewDocument(page));
  expect(movedIds).toEqual(expect.arrayContaining(initialIds));
  expectUniqueIds(collectBlockIds(await readPreviewDocument(page)));

  await page.locator(".editor-surface h1").click();
  await page.getByRole("button", { name: "Move block up" }).click();
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  await expect.poll(async () => collectTopLevelIds(await readPreviewDocument(page)).slice(0, initialIds.length).join("|")).toBe(initialIds.join("|"));
  await expect(page.getByText("Valid")).toBeVisible();
}

async function createSingleParagraphDocument(page: Page, text: string): Promise<void> {
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Untitled");
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
