export type PreviewTab = "json" | "markdown" | "diff";

export type ActivityPanel = "files" | "outline" | "settings" | "review" | "developer";

export type ReviewWorkspaceTab = "changes" | "history" | "health";

export type RecentFileAction = "opened" | "saved";

export interface RecentFileEntry {
  id: string;
  name: string;
  title: string;
  action: RecentFileAction;
  updatedAt: string;
  nativePath?: string;
}
