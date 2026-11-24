import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TREE_BLOCK_PADDING,
  TREE_CARD_WIDTH,
  TREE_DRAFT_HEIGHT,
  TREE_EXPAND_RADIUS,
  addTreeChild,
  layoutTree,
  removeTreeNode,
  resolveCardHeight,
  treeBlockSize,
  treeDescendantIds,
  treeEdges,
  treeNodeById,
  treePath,
  updateTreeNode,
  visibleTreeNodes,
  type SuperBoardTreeData,
} from '../../canvas/model'
import { usePreferences } from '../../canvas/editor/preferences'
import { buildTreeMessages, estimateTokens } from '../../canvas/tree/treePrompt'
import { TreeCard } from './TreeCard'
import { TreeCardMenu } from './TreeCardMenu'
import { TreeSelectionMenu } from './TreeSelectionMenu'

export interface KnowledgeTreeSize {
  width: number
  height: number
}

/** Matches the card exit transition in knowledge-tree.css. */
const TREE_EXIT_MS = 170

interface KnowledgeTreeProps {
  data: SuperBoardTreeData
  /** Called whenever the cards settle on a new block size. */
  onSize?: (size: KnowledgeTreeSize) => void
  /** Structure changed: add, remove or edit a card. */
  onChange?: (next: SuperBoardTreeData) => void
  /** A card was pressed with the primary button; selects the block. */
  onActivate?: () => void
  /** Ask again for one card, e.g. after a failed request. */
  onGenerate?: (nodeId: string) => void
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

  /** Give a brand new card a known height so the layout does not jump twice. */
  const seed = (id: string, height: number) => {
    setHeights((current) =>
      current[id] === height ? current : { ...current, [id]: height },
    )
  }

  return { heights, register, seed }
}

export function KnowledgeTree({
  data,
  onSize,
  onChange,
  onActivate,
  onGenerate,
}: KnowledgeTreeProps) {
  const { heights, register, seed } = useCardHeights()
  const { t } = useTranslation(['editor'])
  const blockDefaults = usePreferences().block
  const layout = layoutTree(data, heights)
  const edges = treeEdges(data, layout.positions, heights)
  const size = treeBlockSize(layout)
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize
  const lastSize = useRef<KnowledgeTreeSize>({ width: 0, height: 0 })
  const sizeFrame = useRef(0)
  const [menu, setMenu] = useState<{
    nodeId: string
    left: number
    top: number
  } | null>(null)
  const [textMenu, setTextMenu] = useState<{
    nodeId: string
    left: number
    top: number
    text: string
  } | null>(null)
  // Cards fade out before they leave the data, so deleting reads like adding.
  const [exiting, setExiting] = useState<Set<string>>(() => new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimer = useRef(0)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const previous = lastSize.current
    if (previous.width === size.width && previous.height === size.height) return
    lastSize.current = size
    // Coalesce the block resize into one frame: two updates in a row make the
    // whole canvas flash while the new card is still being measured.
    if (sizeFrame.current) return
    sizeFrame.current = requestAnimationFrame(() => {
      sizeFrame.current = 0
      onSizeRef.current?.(lastSize.current)
    })
  }, [size.width, size.height])

  useEffect(
    () => () => {
      if (sizeFrame.current) cancelAnimationFrame(sizeFrame.current)
    },
    [],
  )

  const nodes = visibleTreeNodes(data)
  const childrenOf = (id: string) => data.nodes.some((item) => item.parentId === id)

  /** Hover state keeps the expand button reachable when the pointer moves onto it. */
  const setHover = (id: string | null) => {
    window.clearTimeout(hoverTimer.current)
    if (id) {
      setHoveredId(id)
      return
    }
    hoverTimer.current = window.setTimeout(() => setHoveredId(null), 140)
  }

  /** What the request would carry if this card asked the typed question. */
  const contextFor = (nodeId: string, question: string) => {
    const path = treePath(data, nodeId)
    const titles = path
      .slice(0, -1)
      .map(
        (item) =>
          item.title.trim() ||
          item.question.trim() ||
          t('editor:tree.untitled'),
      )
    if (!question.trim()) return { path: titles, tokens: 0 }
    const preview: SuperBoardTreeData = {
      ...data,
      nodes: data.nodes.map((item) =>
        item.id === nodeId ? { ...item, question } : item,
      ),
    }
    return {
      path: titles,
      tokens: estimateTokens(buildTreeMessages(preview, nodeId)),
    }
  }

  const addChild = (parentId: string) => {
    const { data: next, node } = addTreeChild(data, parentId)
    if (node) seed(node.id, TREE_DRAFT_HEIGHT)
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
        status: 'done',
      }),
    )
  }

  const cancelDraft = (id: string) => {
    const node = treeNodeById(data, id)
    // The root card is the tree's starting point and never disappears.
    if (!node || node.id === data.rootId) return
    removeWithAnimation(id, 'branch')
  }

  const toggleBranch = (id: string) => {
    const node = treeNodeById(data, id)
    if (!node) return
    onChange?.(updateTreeNode(data, id, { branchCollapsed: !node.branchCollapsed }))
  }

  const renameNode = (id: string, title: string) => {
    onChange?.(updateTreeNode(data, id, { title }))
  }

  const deleteNode = (id: string, mode: 'branch' | 'promote') => {
    removeWithAnimation(id, mode)
  }

  const toggleBody = (id: string) => {
    const node = treeNodeById(data, id)
    if (!node) return
    onChange?.(updateTreeNode(data, id, { bodyCollapsed: !node.bodyCollapsed }))
  }

  const removeTimers = useRef<number[]>([])

  useEffect(
    () => () => {
      removeTimers.current.forEach((timer) => window.clearTimeout(timer))
    },
    [],
  )

  /** Fade the card out first, then drop it from the data. */
  function removeWithAnimation(id: string, mode: 'branch' | 'promote') {
    const current = dataRef.current
    // A whole branch leaves together, otherwise children blink out of existence
    // while their parent is still fading.
    const leaving =
      mode === 'branch'
        ? new Set([id, ...treeDescendantIds(current, id)])
        : new Set([id])
    setExiting((previous) => {
      const next = new Set(previous)
      leaving.forEach((item) => next.add(item))
      return next
    })
    const timer = window.setTimeout(() => {
      removeTimers.current = removeTimers.current.filter((item) => item !== timer)
      setExiting((previous) => {
        const next = new Set(previous)
        leaving.forEach((item) => next.delete(item))
        return next
      })
      const latest = dataRef.current
      if (!treeNodeById(latest, id)) return
      onChange?.(removeTreeNode(latest, id, mode))
    }, TREE_EXIT_MS)
    removeTimers.current.push(timer)
  }

  const setCardStyle = (id: string, patch: { background?: string; border?: string }) => {
    const node = treeNodeById(data, id)
    if (!node) return
    onChange?.(
      updateTreeNode(data, id, { style: { ...node.style, ...patch } }),
    )
  }

  const quoteOf = (nodeId: string, text: string) => {    const node = treeNodeById(data, nodeId)
    return {
      text,
      title:
        node?.title.trim() || node?.question.trim() || undefined,
    }
  }

  /** Explain the excerpt right away: a child card that starts generating. */
  const explainSelection = (nodeId: string, text: string) => {
    const { data: next } = addTreeChild(data, nodeId, {
      quote: quoteOf(nodeId, text),
      question: t('editor:tree.explainQuestion'),
      status: 'done',
    })
    window.getSelection()?.removeAllRanges()
    onChange?.(next)
  }

  /** Ask about the excerpt: a child draft that keeps it as a quote. */
  const askSelection = (nodeId: string, text: string) => {
    const { data: next, node } = addTreeChild(data, nodeId, {
      quote: quoteOf(nodeId, text),
    })
    if (node) seed(node.id, TREE_DRAFT_HEIGHT)
    window.getSelection()?.removeAllRanges()
    onChange?.(next)
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
            hasChildren={childrenOf(node.id)}
            canDelete={node.id !== data.rootId}
            exiting={exiting.has(node.id)}
            position={layout.positions[node.id] ?? { x: 0, y: 0 }}
            defaults={blockDefaults}
            register={register(node.id)}
            onActivate={() => onActivate?.()}
            onAddChild={() => addChild(node.id)}
            onSubmitQuestion={(text) => submitQuestion(node.id, text)}
            onCancelDraft={() => cancelDraft(node.id)}
            onToggleBody={() => toggleBody(node.id)}
            onHover={(hovering) => setHover(hovering ? node.id : null)}
            onRename={(title) => renameNode(node.id, title)}
            onDelete={(mode) => deleteNode(node.id, mode)}
            onRetry={() => onGenerate?.(node.id)}
            onOpenMenu={(anchor) => setMenu({ nodeId: node.id, ...anchor })}
            onTextMenu={(payload) => setTextMenu({ nodeId: node.id, ...payload })}
            contextFor={(question) => contextFor(node.id, question)}
          />
        ))}
        {nodes
          .filter((node) => childrenOf(node.id))
          .map((node) => {
            const position = layout.positions[node.id] ?? { x: 0, y: 0 }
            const height = resolveCardHeight(heights, node)
            const collapsed = node.branchCollapsed === true
            const hiddenCount = collapsed
              ? treeDescendantIds(data, node.id).size
              : 0
            return (
              <button
                key={`expand-${node.id}`}
                type="button"
                className={`sb-kt-expand${collapsed ? ' is-collapsed' : ''}${
                  collapsed || hoveredId === node.id ? ' is-visible' : ''
                }`}
                style={
                  {
                    '--sb-kt-ex': `${position.x + TREE_CARD_WIDTH - TREE_EXPAND_RADIUS}px`,
                    '--sb-kt-ey': `${position.y + height / 2 - TREE_EXPAND_RADIUS}px`,
                  } as CSSProperties
                }
                aria-label={
                  collapsed
                    ? t('editor:tree.expandBranch')
                    : t('editor:tree.collapseBranch')
                }
                title={
                  collapsed
                    ? t('editor:tree.expandBranchCount', { count: hiddenCount })
                    : t('editor:tree.collapseBranch')
                }
                onPointerDown={(event) => event.stopPropagation()}
                onPointerEnter={() => setHover(node.id)}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleBranch(node.id)
                }}
              >
                {collapsed ? (
                  <span className="sb-kt-expand-count">{hiddenCount}</span>
                ) : (
                  <svg
                    viewBox="0 0 16 16"
                    width="10"
                    height="10"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 8h9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            )
          })}
      </div>
      {textMenu ? (
        <TreeSelectionMenu
          anchor={{ left: textMenu.left, top: textMenu.top }}
          onExplain={() => explainSelection(textMenu.nodeId, textMenu.text)}
          onAsk={() => askSelection(textMenu.nodeId, textMenu.text)}
          onClose={() => setTextMenu(null)}
        />
      ) : null}
      {menu && treeNodeById(data, menu.nodeId) ? (
        <TreeCardMenu
          anchor={{ left: menu.left, top: menu.top }}
          node={treeNodeById(data, menu.nodeId) ?? data.nodes[0]}
          defaults={blockDefaults}
          onBackground={(color) => setCardStyle(menu.nodeId, { background: color })}
          onBorder={(color) => setCardStyle(menu.nodeId, { border: color })}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  )
}
