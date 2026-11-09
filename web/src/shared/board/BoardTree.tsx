import type { ReactNode } from 'react'
import type { BoardTreeFile, BoardTreeNode } from './types'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms ease' }}
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={open ? 'M1.8 4.3h4l1.2 1.4h7.2v6.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.3Z' : 'M1.8 3.8h4l1.2 1.4h7.2v6.6a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V3.8Z'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M4 1.8h5.2L12.2 5v9.2H4V1.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9.2 1.8V5h3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

interface BoardTreeProps {
  nodes: BoardTreeNode[]
  selectedSlug?: string
  expanded: Set<string>
  onToggle: (path: string) => void
  onSelect: (slug: string) => void
  actions?: (node: BoardTreeFile) => ReactNode
  emptyLabel?: string
}

function TreeRow({
  node,
  depth,
  selectedSlug,
  expanded,
  onToggle,
  onSelect,
  actions,
}: {
  node: BoardTreeNode
  depth: number
  selectedSlug?: string
  expanded: Set<string>
  onToggle: (path: string) => void
  onSelect: (slug: string) => void
  actions?: (node: BoardTreeFile) => ReactNode
}) {
  if (node.type === 'folder') {
    const open = expanded.has(node.path)
    return (
      <div role="treeitem" aria-expanded={open}>
        <button
          type="button"
          className="sb-tree-row sb-tree-folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onToggle(node.path)}
        >
          <span className="sb-tree-chevron">
            <ChevronIcon open={open} />
          </span>
          <span className="sb-tree-icon">
            <FolderIcon open={open} />
          </span>
          <span className="sb-tree-label">{node.name}</span>
        </button>
        {open ? (
          <div role="group">
            {node.children.map((child) => (
              <TreeRow
                key={child.type === 'file' ? `file:${child.slug}` : `folder:${child.path}`}
                node={child}
                depth={depth + 1}
                selectedSlug={selectedSlug}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                actions={actions}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const selected = node.slug === selectedSlug
  return (
    <div className={`sb-tree-file-row${selected ? ' is-selected' : ''}`} role="treeitem" aria-selected={selected}>
      <button
        type="button"
        className="sb-tree-row sb-tree-file"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.slug)}
        title={`${node.title} (${node.slug})`}
      >
        <span className="sb-tree-chevron" aria-hidden="true" />
        <span className="sb-tree-icon">
          <FileIcon />
        </span>
        <span className="sb-tree-label">{node.name}</span>
      </button>
      {actions ? <div className="sb-tree-actions">{actions(node)}</div> : null}
    </div>
  )
}

export function BoardTree({
  nodes,
  selectedSlug,
  expanded,
  onToggle,
  onSelect,
  actions,
  emptyLabel = '还没有白板',
}: BoardTreeProps) {
  if (nodes.length === 0) {
    return <p className="sb-tree-empty">{emptyLabel}</p>
  }

  return (
    <div className="sb-tree" role="tree" aria-label="白板目录">
      {nodes.map((node) => (
        <TreeRow
          key={node.type === 'file' ? `file:${node.slug}` : `folder:${node.path}`}
          node={node}
          depth={0}
          selectedSlug={selectedSlug}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          actions={actions}
        />
      ))}
    </div>
  )
}
