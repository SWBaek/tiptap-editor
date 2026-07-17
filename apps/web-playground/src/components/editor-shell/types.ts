export type PreviewTab = "json" | "markdown" | "diff";

export type ActivityPanel = "files" | "outline" | "export" | "settings" | "review" | "diagnostics" | "history" | "developer";

export type RecentFileAction = "opened" | "saved";

export interface RecentFileEntry {
  id: string;
  name: string;
  title: string;
  action: RecentFileAction;
  updatedAt: string;
  nativePath?: string;
}
