import { stableStringify, type SDocMetadata } from "@sdoc/format";

export function isMetadataDirty(current: SDocMetadata, baseline: SDocMetadata): boolean {
  return stableStringify(current) !== stableStringify(baseline);
}

export function getSavedLabel(savedAt: string, hasUnsavedChanges: boolean): string {
  return hasUnsavedChanges ? "Unsaved changes" : savedAt;
}
