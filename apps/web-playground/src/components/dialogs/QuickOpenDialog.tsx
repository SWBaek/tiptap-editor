import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import { flattenWorkspaceDocuments } from "../panels/explorerTreeModel";

export interface QuickOpenItem {
  entry: WindowSdocWorkspaceEntry;
  relativePath: string;
}

export interface QuickOpenDialogProps {
  workspaceDirectory: string;
  entries: WindowSdocWorkspaceEntry[];
  onOpen: (entry: WindowSdocWorkspaceEntry) => void;
  onCancel: () => void;
}

export function QuickOpenDialog({ workspaceDirectory, entries, onOpen, onCancel }: QuickOpenDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo(
    () => createQuickOpenItems(entries, workspaceDirectory, query).slice(0, 50),
    [entries, query, workspaceDirectory]
  );

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 1))), [items.length]);

  function openActiveItem() {
    const item = items[activeIndex];
    if (item) {
      onOpen(item.entry);
    }
  }

  return (
    <div
      className="quick-open-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        className="quick-open-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Quick Open"
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            inputRef.current?.focus();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActiveIndex((current) => {
              if (event.key === "Home") return 0;
              if (event.key === "End") return Math.max(0, items.length - 1);
              const delta = event.key === "ArrowDown" ? 1 : -1;
              return items.length === 0 ? 0 : (current + delta + items.length) % items.length;
            });
          } else if (event.key === "Enter") {
            event.preventDefault();
            openActiveItem();
          }
        }}
      >
        <label className="quick-open-input-row">
          <Search size={17} aria-hidden="true" />
          <span className="visually-hidden">Find a document</span>
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-label="Find a document"
            aria-controls="quick-open-results"
            aria-expanded="true"
            aria-activedescendant={items[activeIndex] ? `quick-open-${activeIndex}` : undefined}
            placeholder="Type a document name"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
          />
          <kbd>Ctrl+P</kbd>
        </label>
        <div id="quick-open-results" className="quick-open-results" role="listbox" aria-label="Workspace documents">
          {items.length === 0 ? (
            <p>No matching documents</p>
          ) : items.map((item, index) => (
            <button
              id={`quick-open-${index}`}
              key={item.entry.path}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onOpen(item.entry)}
            >
              <FileText size={15} aria-hidden="true" />
              <strong>{item.entry.name}</strong>
              <span>{item.relativePath}</span>
            </button>
          ))}
        </div>
        <footer><span>↑↓ navigate</span><span>Enter open</span><span>Esc close</span></footer>
      </section>
    </div>
  );
}

export function createQuickOpenItems(
  entries: WindowSdocWorkspaceEntry[],
  workspaceDirectory: string,
  query: string
): QuickOpenItem[] {
  const queryTokens = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return flattenWorkspaceDocuments(entries)
    .map((entry) => ({ entry, relativePath: relativeWorkspacePath(workspaceDirectory, entry.path) }))
    .filter((item) => {
      const searchable = `${item.entry.name} ${item.relativePath}`.toLocaleLowerCase();
      return queryTokens.every((token) => searchable.includes(token));
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { numeric: true, sensitivity: "base" }));
}

function relativeWorkspacePath(workspaceDirectory: string, entryPath: string): string {
  const normalizedRoot = workspaceDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedEntry = entryPath.replace(/\\/g, "/");
  return normalizedEntry.toLocaleLowerCase().startsWith(`${normalizedRoot.toLocaleLowerCase()}/`)
    ? normalizedEntry.slice(normalizedRoot.length + 1)
    : normalizedEntry;
}
