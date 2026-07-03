# Draw.io External Editor Bridge Boundary

Created: 2026-07-03

## Decision

Draw.io editing should be handled first through a future Tauri desktop bridge that launches an installed Draw.io editor against a temporary working copy. The web playground remains limited to importing Draw.io source assets, showing static previews or placeholders, and preserving source references.

This bridge is a native adapter around the existing asset-backed `diagram` node. It must not introduce Draw.io XML, external file paths, process state, watcher state, viewport state, or conflict markers into canonical `document.json`.

## Adapter Contract

The desktop layer exposes a narrow adapter, `DrawioExternalEditorBridge`, with these responsibilities:

- resolve a `diagram` node with `attrs.kind = "drawio"` and `attrs.sourceAssetId`;
- check out the source asset through `DiagramSourceStore` into a private temporary file;
- launch the configured Draw.io executable with that temporary file;
- read saved file contents back from the temporary checkout;
- validate that the saved file is still usable Draw.io XML/source;
- write accepted source changes back through `DiagramSourceStore`;
- report recoverable errors without mutating canonical document state.

The adapter should return status events such as `opened`, `saved`, `preview-updated`, `invalid-source`, `conflict`, and `closed`. Those events are runtime UI state only.

## Save And Conflict Policy

Before checkout, the app should remember the current source asset revision or content hash outside `document.json`. On save-back, it should compare that value with the latest in-memory asset state.

- If the asset did not change elsewhere, replace the source asset and mark the document dirty.
- If the asset changed elsewhere, keep both versions available in memory and ask the user whether to keep the current asset, replace it, or save the external edit as a new asset.
- If validation fails, preserve the previous asset and surface the error near the diagram.

Temporary files should be deleted when the session closes where possible. Cleanup failure must not affect `.sdoc` validity.

## Preview Policy

Preview SVG/PNG output is non-canonical. The bridge may regenerate `previewAssetId` through a desktop renderer or keep the existing preview until a reliable renderer exists. Preview failure should never block saving valid source XML.

## Web Boundary

The browser implementation must not claim native app launch, folder watching, or external file save-back. Browser UI may offer import, export source, static preview, and a clear "desktop-only" editing message.

## Deferred Work

- File watching and debounce-based hot reload.
- Executable discovery beyond explicit path or platform default opener.
- Preview rendering service selection.
- Embedded Draw.io iframe experiment.
- Draw.io XML structural diff and merge.
- Enterprise asset store integration.

## Initial Implementation

The Phase 5 initial bridge adds runtime-only Tauri sessions:

- `checkout_drawio_source_asset` writes in-memory Draw.io asset bytes to a private temp file.
- `open_drawio_external_editor` launches an explicit executable path or the platform default opener.
- `read_drawio_external_edit` validates edited XML and returns source bytes for save-back through the app asset store.
- `close_drawio_external_edit` removes the temp checkout where possible.

The companion TypeScript adapter lives in `apps/desktop/src/nativeDrawioExternalEditorBridge.ts`. `apps/desktop/src/drawioBridgeModel.ts` keeps bridge status events, Draw.io source validation, and conflict classification testable without a native runtime.

This slice does not implement file watching, preview regeneration, executable discovery UI, or save-back UI. It provides the native bridge primitive for those product workflows.
