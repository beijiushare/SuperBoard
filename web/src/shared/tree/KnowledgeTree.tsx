import { useEffect, useRef, useState } from 'react'
import {
  TREE_BLOCK_PADDING,
  TREE_CARD_MAX_HEIGHT,
  TREE_CARD_WIDTH,
  colorWithOpacity,
  layoutTree,
  treeBlockSize,
  treeEdges,
  visibleTreeNodes,
  type SuperBoardTreeData,
  type SuperBoardTreeNode,
} from '../../canvas/model'
import { usePreferences } from '../../canvas/editor/preferences'
import { MarkdownVditorPreview } from '../markdown/MarkdownVditorPreview'

export interface KnowledgeTreeSize {
  width: number
  height: number
}

interface KnowledgeTreeProps {
  data: SuperBoardTreeData
  /** Called whenever the cards settle on a new block size. */
  onSize?: (size: KnowledgeTreeSize) => void
}

/**
 * Card heights are measured, never guessed: the layout is a pure function of
 * measured heights, so a card that grows pushes its siblings instead of
 * overlapping them.
 */
function useCardHeights() {
  const [heights, setHeights] = useState<Record<string, number>>({})
  const observer = useRef<ResizeObserver | null>(null)
  const elements = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const instance = new ResizeObserver((entries) => {
      const measured: Record<string, number> = {}
      for (const entry of entries) {
        const element = entry.target as HTMLElement
        const id = element.dataset.treeNodeId
        if (!id) continue
        const box = entry.borderBoxSize?.[0]
        const height = box ? box.blockSize : element.offsetHeight
        if (height > 0) measured[id] = Math.ceil(height)
      }
      if (!Object.keys(measured).length) return
      setHeights((current) => {
        let changed = false
        for (const [id, height] of Object.entries(measured)) {
          if (current[id] !== height) {
            changed = true
            break
          }
        }
        return changed ? { ...current, ...measured } : current
      })
    })
    observer.current = instance
    elements.current.forEach((element) => instance.observe(element))
    return () => {
      instance.disconnect()
      observer.current = null
    }
  }, [])

  const register = (id: string) => (element: HTMLElement | null) => {
    const previous = elements.current.get(id)
    if (previous && previous !== element) {
      observer.current?.unobserve(previous)
      elements.current.delete(id)
    }
    if (!element) return
    elements.current.set(id, element)
    observer.current?.observe(element)
  }

  return { heights, register }
}

function CardBody({ node }: { node: SuperBoardTreeNode }) {
  if (node.status === 'draft' || !node.answer.trim()) {
    return (
      <div className="sb-kt-card-empty">
        {node.status === 'draft'
          ? '等待提问'
          : node.status === 'generating'
            ? '生成中…'
            : node.status === 'error'
              ? '生成失败'
              : '暂无回答'}
      </div>
    )
  }
  return <MarkdownVditorPreview source={node.answer} />
}

export function KnowledgeTree({ data, onSize }: KnowledgeTreeProps) {
  const { heights, register } = useCardHeights()
  const blockDefaults = usePreferences().block
  const layout = layoutTree(data, heights)
  const edges = treeEdges(data, layout.positions, heights)
  const size = treeBlockSize(layout)
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize
  const lastSize = useRef<KnowledgeTreeSize>({ width: 0, height: 0 })

  useEffect(() => {
    const previous = lastSize.current
    if (previous.width === size.width && previous.height === size.height) return
    lastSize.current = size
    onSizeRef.current?.(size)
  }, [size.width, size.height])

  const nodes = visibleTreeNodes(data)

  return (
    <div
      className="sb-kt"
      style={{
        padding: TREE_BLOCK_PADDING,
        width: size.width,
        height: size.height,
      }}
    >
      <div
        className="sb-kt-stage"
        style={{ width: layout.width, height: layout.height }}
      >
        <svg
          className="sb-kt-edges"
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          {edges.map((edge) => (
            <g key={edge.id} className="sb-kt-edge">
              <path d={edge.path} fill="none" />
              <path d={edge.arrow} />
            </g>
          ))}
        </svg>
        {nodes.map((node) => {
          const position = layout.positions[node.id] ?? { x: 0, y: 0 }
          return (
            <article
              key={node.id}
              ref={register(node.id)}
              data-tree-node-id={node.id}
              className={`sb-kt-card${node.bodyCollapsed ? ' is-collapsed' : ''}${
                node.status === 'draft' ? ' is-draft' : ''
              }`}
              style={{
                left: position.x,
                top: position.y,
                width: TREE_CARD_WIDTH,
                maxHeight: TREE_CARD_MAX_HEIGHT,
                // Cards follow the shared block defaults unless they carry an
                // explicit colour, exactly like a normal block surface.
                background: colorWithOpacity(
                  node.style?.background ?? blockDefaults.backgroundColor,
                  blockDefaults.backgroundOpacity,
                ),
                borderColor: colorWithOpacity(
                  node.style?.border ?? blockDefaults.borderColor,
                  blockDefaults.borderOpacity,
                ),
                borderWidth: `${blockDefaults.borderWidth}px`,
                borderStyle: blockDefaults.borderStyle,
              }}
            >
              <header className="sb-kt-head">
                <span className="sb-kt-title">
                  {node.title.trim() || node.question.trim() || '未命名'}
                </span>
              </header>
              {node.quote ? (
                <blockquote className="sb-kt-quote">
                  {node.quote.title ? (
                    <span className="sb-kt-quote-source">
                      {node.quote.title}
                    </span>
                  ) : null}
                  {node.quote.text}
                </blockquote>
              ) : null}
              {node.question ? (
                <blockquote className="sb-kt-question">
                  {node.question}
                </blockquote>
              ) : null}
              <div className="sb-kt-body">
                <CardBody node={node} />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
