import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

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
    targetId?: unknown;
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
  await expect(page.getByText("Phase 3 Playground")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings panel" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Files panel" }).click();
  await expect(page.getByRole("complementary", { name: "Files side panel" })).toContainText("Current file");
  await page.getByRole("button", { name: "Files panel" }).click();
  await expect(page.getByRole("complementary", { name: "Files side panel" })).toBeHidden();
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
  await expect(page.getByRole("button", { name: "Download .sdoc" })).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".preview-output")).toContainText("# System Overview {#overview}");

  await page.getByLabel("Title").fill("Smoke Spec");
  await page.locator(".tabs").getByRole("button", { name: "Diff" }).click();
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

test("uses the Review side panel for diff workflow controls", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Title").fill("Review Panel Spec");

  await page.getByRole("button", { name: "Review panel" }).click();
  const reviewPanel = page.getByRole("complementary", { name: "Review side panel" });
  await expect(reviewPanel).toBeVisible();
  await expect(reviewPanel.locator(".status-block").filter({ hasText: "Review" })).toContainText("1 change");
  await expect(reviewPanel.locator(".status-block").filter({ hasText: "Base" })).toContainText("Saved baseline");
  await expect(reviewPanel.getByLabel("Review counts")).toContainText("Total");
  await expect(reviewPanel.getByLabel("Review counts")).toContainText("Metadata");
  await expect(reviewPanel.getByLabel("Review counts")).toContainText("1");
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
});

test("tracks browser recent files in the Files side panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Files panel" }).click();
  const filesPanel = page.getByRole("complementary", { name: "Files side panel" });
  await expect(filesPanel).toBeVisible();
  await expect(filesPanel.getByLabel("Recent files")).toContainText("No recent browser activity");
  await expect(filesPanel.getByLabel("Unpacked folder workflow")).toContainText("CLI/Tauri-only");

  await page.getByRole("button", { name: "Settings panel" }).click();
  await page.getByLabel("Title").fill("Files Panel Spec");
  await page.getByRole("button", { name: "Files panel" }).click();
  await filesPanel.getByRole("button", { name: "Copy unpack command" }).click();
  await expect(page.locator(".status-note")).toContainText('npm run sdoc -- unpack "Files Panel Spec.sdoc" "Files Panel Spec.sdoc.d"');

  const sdocDownload = page.waitForEvent("download");
  await filesPanel.getByRole("button", { name: "Save .sdoc" }).click();
  expect((await sdocDownload).suggestedFilename()).toBe("Files Panel Spec.sdoc");
  await expect(filesPanel.getByLabel("Recent files")).toContainText("Files Panel Spec.sdoc");
  await expect(filesPanel.getByLabel("Recent files")).toContainText("saved Files Panel Spec");

  await page.reload();
  await page.getByRole("button", { name: "Files panel" }).click();
  const reloadedFilesPanel = page.getByRole("complementary", { name: "Files side panel" });
  await expect(reloadedFilesPanel.getByLabel("Recent files")).toContainText("Files Panel Spec.sdoc");
  await reloadedFilesPanel.getByRole("button", { name: /Files Panel Spec\.sdoc/ }).click();
  await expect(page.locator(".status-note")).toContainText("Recent file metadata only: reopen Files Panel Spec.sdoc");
});

test("exports readable and AI/RAG outputs from the Export side panel", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Title").fill("Export Panel Spec");
  await page.getByRole("button", { name: "Export panel" }).click();
  const exportPanel = page.getByRole("complementary", { name: "Export side panel" });
  await expect(exportPanel).toBeVisible();
  await expect(exportPanel.getByLabel("Portable document exports")).toContainText("Export Panel Spec.sdoc");
  await expect(exportPanel.getByLabel("Readable exports")).toContainText("Export Panel Spec.md");
  await expect(exportPanel.getByLabel("AI/RAG exports")).toContainText("plain.md");
  await expect(exportPanel.getByLabel("AI/RAG exports")).toContainText("chunks.jsonl");
  await expect(exportPanel.getByLabel("AI/RAG exports")).toContainText("outline.json");
  await expect(exportPanel.getByLabel("AI/RAG exports")).toContainText("references.json");

  const markdownDownload = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "Export Markdown" }).click();
  expect((await markdownDownload).suggestedFilename()).toBe("Export Panel Spec.md");
  await expect(page.locator(".status-note")).toContainText("Exported Markdown");

  const plainDownload = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "Export plain.md" }).click();
  expect((await plainDownload).suggestedFilename()).toBe("plain.md");
  await expect(page.locator(".status-note")).toContainText("Exported plain.md");

  const chunksDownload = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "Export chunks.jsonl" }).click();
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
  await page.getByLabel("Title").fill("History Spec");
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

  await page.locator(".tabs").getByRole("button", { name: "Diff" }).click();
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

  await page.getByRole("button", { name: "Insert reference" }).click();
  await expect(page.locator(".status-note")).toContainText("Choose a reference target");
  await expect(page.getByRole("button", { name: "References panel" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("complementary", { name: "References side panel" })).toBeVisible();
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

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const document = await readPreviewDocument(page);
  const reference = findFirstNodeByType(document, "crossReference");
  expect(reference.attrs?.targetId).toBe("blk_overview");
  expect(findTextNode(reference, "Platform Overview").text).toBe("Platform Overview");
  expectUniqueIds(collectBlockIds(document));
  await page.getByRole("button", { name: "Settings panel" }).click();
  await expect(page.getByRole("complementary", { name: "Settings side panel" }).getByLabel("Schema status")).toContainText("Valid");
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
  await page.getByRole("button", { name: "References panel" }).click();
  await expect(page.getByRole("complementary", { name: "References side panel" })).toBeVisible();
  await expect(page.locator(".reference-summary")).toContainText("1");
  await expect(page.locator(".reference-summary")).toContainText("Broken");
  await expect(page.locator(".reference-issue-list")).toContainText("blk_missing");
  await expect(page.locator(".reference-target-list")).toContainText("blk_overview");

  const brokenItem = page.locator(".reference-issue-list li").filter({ hasText: "ref_missing" });
  await brokenItem.getByRole("button", { name: "Show" }).click();
  await expect(page.locator(".status-note")).toContainText("Focused reference Missing section");
  await expect(page.locator('.editor-node-highlight[data-highlighted-node-id="ref_missing"]')).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const document = await readPreviewDocument(page);
  expect(findFirstNodeByType(document, "crossReference").attrs?.targetId).toBe("blk_missing");
  expectUniqueIds(collectBlockIds(document));
  await page.getByRole("button", { name: "Settings panel" }).click();
  await expect(page.getByRole("complementary", { name: "Settings side panel" }).getByLabel("Schema status")).toContainText("Valid");
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

test("inserts a simple table and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.getByRole("button", { name: "Insert table" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted table");
  await expect(page.locator(".editor-surface table")).toBeVisible();

  await fillTableCell(page, "th", 0, "Name");
  await fillTableCell(page, "th", 1, "Status");
  await fillTableCell(page, "td", 0, "API");
  await fillTableCell(page, "td", 1, "Ready");

  await expect.poll(async () => findFirstNodeByType(await readPreviewDocument(page), "table").attrs?.id).toEqual(expect.any(String));
  const insertedDocument = await readPreviewDocument(page);
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".preview-output")).toContainText("| Name | Status |");
  await expect(page.locator(".preview-output")).toContainText("| API | Ready |");

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

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedTable = findFirstNodeByType(reopenedDocument, "table");
  expect(reopenedTable.attrs?.id).toBe(findFirstNodeByType(insertedDocument, "table").attrs?.id);
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("inserts inline and block equations and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();
  await page.keyboard.type("Energy ");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Inline equation");
    await dialog.accept("E=mc^2");
  });
  await page.getByRole("button", { name: "Insert inline equation" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted inline equation");
  await expect(page.locator(".editor-surface .sdoc-inline-equation .katex")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Block equation");
    await dialog.accept("a^2+b^2=c^2");
  });
  await page.getByRole("button", { name: "Insert equation block" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted equation block");
  await expect(page.locator(".editor-surface .sdoc-equation-block .katex")).toBeVisible();

  const insertedDocument = await readPreviewDocument(page);
  expect(findFirstNodeByType(insertedDocument, "equation").attrs?.latex).toBe("E=mc^2");
  expect(findFirstNodeByType(insertedDocument, "equationBlock").attrs?.latex).toBe("a^2+b^2=c^2");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".preview-output")).toContainText("Energy $E=mc^2$");
  await expect(page.locator(".preview-output")).toContainText("$$\na^2+b^2=c^2\n$$");

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

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const reopenedDocument = await readPreviewDocument(page);
  expect(findFirstNodeByType(reopenedDocument, "equation").attrs?.latex).toBe("E=mc^2");
  expect(findFirstNodeByType(reopenedDocument, "equationBlock").attrs?.latex).toBe("a^2+b^2=c^2");
  expectUniqueIds(collectBlockIds(reopenedDocument));
});

test("inserts a Mermaid diagram and round-trips through .sdoc", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();

  await page.getByRole("button", { name: "New document" }).click();
  await page.locator(".editor-surface").click();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Mermaid diagram");
    await dialog.accept("flowchart TD\nA[Start] --> B[Done]");
  });
  await page.getByRole("button", { name: "Insert Mermaid diagram" }).click();
  await expect(page.locator(".status-note")).toContainText("Inserted Mermaid diagram");
  await expect(page.locator(".editor-surface .sdoc-diagram svg")).toBeVisible();

  const insertedDocument = await readPreviewDocument(page);
  const insertedDiagram = findFirstNodeByType(insertedDocument, "diagram");
  expect(insertedDiagram.attrs?.kind).toBe("mermaid");
  expect(insertedDiagram.attrs?.source).toBe("flowchart TD\nA[Start] --> B[Done]");
  expect(JSON.stringify(insertedDocument)).not.toContain("<svg");
  expectUniqueIds(collectBlockIds(insertedDocument));
  await expect(page.getByText("Valid")).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".preview-output")).toContainText("```mermaid");
  await expect(page.locator(".preview-output")).toContainText("A[Start] --> B[Done]");

  const sdocDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .sdoc" }).click();
  const sdocDownload = await sdocDownloadPromise;
  const sdocPath = testInfo.outputPath("Diagram Round Trip.sdoc");
  await sdocDownload.saveAs(sdocPath);

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByLabel("Open document file").setInputFiles(sdocPath);
  await expect(page.locator(".status-note")).toContainText("Opened Diagram Round Trip.sdoc");
  await expect(page.locator(".editor-surface .sdoc-diagram svg")).toBeVisible();

  await page.locator(".tabs").getByRole("button", { name: "JSON" }).click();
  const reopenedDocument = await readPreviewDocument(page);
  const reopenedDiagram = findFirstNodeByType(reopenedDocument, "diagram");
  expect(reopenedDiagram.attrs?.source).toBe("flowchart TD\nA[Start] --> B[Done]");
  expect(JSON.stringify(reopenedDocument)).not.toContain("<svg");
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

  await expect(page.getByText("Phase 3 Playground")).toBeVisible();
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
