export interface AuthorOutlineItem {
  headingId: string;
  headingLevel: number;
  title: string;
  number?: string;
}

export interface AuthorFigureItem {
  id: string;
  number: string;
  caption: string;
  detail: string;
}

export interface AuthorTableItem {
  id: string;
  number: string;
  title: string;
  detail: string;
}

export interface OutlinePanelProps {
  items: AuthorOutlineItem[];
  figures: AuthorFigureItem[];
  tables: AuthorTableItem[];
  highlightedNodeId: string | null;
  onRevealNode: (nodeId: string, label: string) => void;
}

export function OutlinePanel({
  items,
  figures,
  tables,
  highlightedNodeId,
  onRevealNode
}: OutlinePanelProps) {
  return (
    <div className="side-panel-section outline-panel">
      <section className="outline-section" aria-label="Document outline">
        <header className="outline-group-heading"><h3>Headings</h3><span>{items.length}</span></header>
        {items.length === 0 ? (
          <p className="outline-empty">Add a heading in the document to build its outline.</p>
        ) : (
          <ul className="outline-list">
            {items.map((item) => (
              <li className={highlightedNodeId === item.headingId ? "active" : undefined} key={item.headingId}>
                <button type="button" style={{ paddingLeft: `${Math.max(0, item.headingLevel - 1) * 12 + 8}px` }} onClick={() => onRevealNode(item.headingId, item.title)}>
                  <span>{item.number ? item.number : `H${item.headingLevel}`}</span>
                  <strong>{item.title}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {figures.length > 0 && (
        <details className="outline-section outline-collapsible" aria-label="Figure list" open>
          <summary className="outline-group-heading"><h3>Figures</h3><span>{figures.length}</span></summary>
          <ul className="outline-list structured-list">
            {figures.map((figure) => (
              <li className={highlightedNodeId === figure.id ? "active" : undefined} key={figure.id}>
                <button type="button" onClick={() => onRevealNode(figure.id, figure.caption)}>
                  <span>{figure.number}</span>
                  <strong>{figure.caption}</strong>
                  <small>{figure.detail}</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {tables.length > 0 && (
        <details className="outline-section outline-collapsible" aria-label="Table list" open>
          <summary className="outline-group-heading"><h3>Tables</h3><span>{tables.length}</span></summary>
          <ul className="outline-list structured-list">
            {tables.map((table) => (
              <li className={highlightedNodeId === table.id ? "active" : undefined} key={table.id}>
                <button type="button" onClick={() => onRevealNode(table.id, table.title)}>
                  <span>{table.number}</span>
                  <strong>{table.title}</strong>
                  <small>{table.detail}</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
