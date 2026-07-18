export function CanvasDocumentHeader({
  title,
  author,
  version,
  onTitleChange,
  onOpenProperties
}: {
  title: string;
  author: string;
  version: string;
  onTitleChange: (title: string) => void;
  onOpenProperties: () => void;
}) {
  const summary = [author.trim(), version.trim() ? `Version ${version.trim()}` : ""].filter(Boolean).join(" · ");

  return (
    <header className="canvas-document-header">
      <label>
        <span className="visually-hidden">Title</span>
        <input
          aria-label="Title"
          value={title}
          placeholder="Untitled document"
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <button type="button" onClick={onOpenProperties} aria-label="Open document properties">
        {summary || "Add author and version"}
      </button>
    </header>
  );
}
