import { useEffect, useRef, useState } from 'react'
import {
  TREE_BLOCK_PADDING,
  addTreeChild,
  layoutTree,
  removeTreeNode,
  treeBlockSize,
  treeEdges,
  treeNodeById,
  updateTreeNode,
  visibleTreeNodes,
  type SuperBoardTreeData,
} from '../../canvas/model'
import { usePreferences } from '../../canvas/editor/preferences'
import { TreeCard } from './TreeCard'

export interface KnowledgeTreeSize {
  width: number
  height: number
}

interface KnowledgeTreeProps {
  data: SuperBoardTreeData
  /** Called whenever the cards settle on a new block size. */
  onSize?: (size: KnowledgeTreeSize) => void
  /** Structure changed: add, remove or edit a card. */
  onChange?: (next: SuperBoardTreeData) => void
  /** A card was pressed with the primary button; selects the block. */
  onActivate?: () => void
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

export function KnowledgeTree({
  data,
  onSize,
  onChange,
  onActivate,
}: KnowledgeTreeProps) {
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

  const addChild = (parentId: string) => {
    const { data: next } = addTreeChild(data, parentId)
    onChange?.(next)
  }

  const submitQuestion = (id: string, text: string) => {
    const question = text.trim()
    if (!question) {
      cancelDraft(id)
      return
    }
    onChange?.(
      updateTreeNode(data, id, {
        question,
        title: question.slice(0, 20),
        status: 'done',
      }),
    )
  }

  const cancelDraft = (id: string) => {
    const node = treeNodeById(data, id)
    // The root card is the tree's starting point and never disappears.
    if (!node || node.id === data.rootId) return
    onChange?.(removeTreeNode(data, id, 'branch'))
  }

  const toggleBranch = (id: string) => {
    const node = treeNodeById(data, id)
    if (!node) return
    onChange?.(updateTreeNode(data, id, { branchCollapsed: !node.branchCollapsed }))
  }

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
        {nodes.map((node) => (
          <TreeCard
            key={node.id}
            node={node}
            hasChildren={data.nodes.some((item) => item.parentId === node.id)}
            position={layout.positions[node.id] ?? { x: 0, y: 0 }}
            defaults={blockDefaults}
            register={register(node.id)}
            onActivate={() => onActivate?.()}
            onAddChild={() => addChild(node.id)}
            onSubmitQuestion={(text) => submitQuestion(node.id, text)}
            onCancelDraft={() => cancelDraft(node.id)}
            onToggleBranch={() => toggleBranch(node.id)}
          />
        ))}
      </div>
    </div>
  )
}
