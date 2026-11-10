import type { MouseEvent, ReactNode } from 'react'
import { BoardTree, type BoardTreeContextTarget } from './BoardTree'
import type { BoardTreeNode } from './types'

interface BoardTreePanelProps {
  nodes: BoardTreeNode[]
  title?: string
  collapsed?: boolean
  selectedSlug?: string
  expanded: Set<string>
  onToggle: (path: string) => void
  onSelect: (slug: string) => void
  onContextMenu?: (event: MouseEvent<HTMLElement>, target: BoardTreeContextTarget) => void
  onRootContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
  headerMeta?: ReactNode
  emptyLabel?: string
}

export function BoardTreePanel({
  nodes,
  title = '白板目录',
  collapsed = false,
  selectedSlug,
  expanded,
  onToggle,
  onSelect,
  onContextMenu,
  onRootContextMenu,
  headerMeta,
  emptyLabel,
}: BoardTreePanelProps) {
  return (
    <aside className={`sb-tree-panel${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sb-tree-header">
        <span className="sb-tree-heading">{title}</span>
        {headerMeta}
      </div>
      <div className="sb-tree-scroll" onContextMenu={onRootContextMenu}>
        <BoardTree
          nodes={nodes}
          selectedSlug={selectedSlug}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          emptyLabel={emptyLabel}
        />
      </div>
    </aside>
  )
}
