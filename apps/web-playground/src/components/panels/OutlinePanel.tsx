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
  outlineDepth: number;
  onOutlineDepthChange: (depth: number) => void;
  highlightedNodeId: string | null;
  onRevealNode: (nodeId: string, label: string) => void;
}

export function OutlinePanel({
  items,
  figures,
  tables,
  outlineDepth,
  onOutlineDepthChange,
  highlightedNodeId,
  onRevealNode
}: OutlinePanelProps) {
  return (
    <div className="side-panel-section outline-panel">
      <section className="outline-section" aria-label="Document outline">
        <h3>Outline</h3>
        <label className="outline-depth-control">
          <span>Depth</span>
          <select value={outlineDepth} onChange={(event) => onOutlineDepthChange(Number(event.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option value={level} key={level}>H1-H{level}</option>
            ))}
          </select>
        </label>
        {items.length === 0 ? (
          <p className="outline-empty">No headings yet</p>
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

      <section className="outline-section" aria-label="Figure list">
        <h3>Figures</h3>
        {figures.length === 0 ? (
          <p className="outline-empty">No figures yet</p>
        ) : (
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
        )}
      </section>

      <section className="outline-section" aria-label="Table list">
        <h3>Tables</h3>
        {tables.length === 0 ? (
          <p className="outline-empty">No tables yet</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
