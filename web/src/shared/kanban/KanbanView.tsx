export interface KanbanColumn {
  title: string
  cards: string[]
}

export function parseKanban(source: string): KanbanColumn[] {
  const columns: KanbanColumn[] = []
  let current: KanbanColumn | null = null

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const heading = line.match(/^#{2,3}\s+(.+)$/)
    if (heading) {
      current = { title: heading[1].trim(), cards: [] }
      columns.push(current)
      continue
    }

    const card = line.match(/^[-*]\s+(.+)$/)
    if (card) {
      if (!current) {
        current = { title: '列表', cards: [] }
        columns.push(current)
      }
      current.cards.push(card[1].trim())
    }
  }

  return columns.filter((column) => column.title || column.cards.length > 0)
}

interface KanbanViewProps {
  source: string
  className?: string
}

export function KanbanView({ source, className = '' }: KanbanViewProps) {
  const columns = parseKanban(source)

  if (columns.length === 0) {
    return <p className="sb-empty">暂无看板内容</p>
  }

  return (
    <div className={`sb-kanban ${className}`.trim()}>
      {columns.map((column, columnIndex) => (
        <section className="sb-kanban-column" key={`${column.title}-${columnIndex}`}>
          <header className="sb-kanban-column-header">
            <span>{column.title}</span>
            <span className="sb-kanban-count">{column.cards.length}</span>
          </header>
          <div className="sb-kanban-cards">
            {column.cards.length === 0 ? (
              <p className="sb-kanban-empty">空</p>
            ) : (
              column.cards.map((card, cardIndex) => (
                <article className="sb-kanban-card" key={`${card}-${cardIndex}`}>
                  {card}
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
