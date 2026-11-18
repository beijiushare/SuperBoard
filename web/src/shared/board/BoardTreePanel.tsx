import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { BoardTree, type BoardTreeContextTarget } from './BoardTree'
import type { BoardTreeNode } from './types'

const MIN_TREE_WIDTH = 133
const MAX_TREE_WIDTH = 480
const DEFAULT_TREE_WIDTH = 264

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
  const [width, setWidth] = useState(DEFAULT_TREE_WIDTH)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(
    () => () => document.body.classList.remove('sb-tree-resizing'),
    [],
  )

  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = { startX: event.clientX, startWidth: width }
    document.body.classList.add('sb-tree-resizing')
  }

  function resize(event: PointerEvent<HTMLDivElement>) {
    const current = resizeRef.current
    if (!current) return
    const next = current.startWidth + event.clientX - current.startX
    setWidth(Math.max(MIN_TREE_WIDTH, Math.min(MAX_TREE_WIDTH, next)))
  }

  function endResize() {
    resizeRef.current = null
    document.body.classList.remove('sb-tree-resizing')
  }

  return (
    <aside
      className={`sb-tree-panel${collapsed ? ' is-collapsed' : ''}`}
      style={{ '--sb-tree-width': `${width}px` } as CSSProperties}
    >
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
      <div
        className="sb-tree-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整目录宽度"
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </aside>
  )
}
