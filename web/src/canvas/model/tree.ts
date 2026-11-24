import type { SuperBoardTreeData, SuperBoardTreeNode } from './types'

export const TREE_CARD_WIDTH = 340
export const TREE_CARD_MAX_HEIGHT = 420
export const TREE_DEFAULT_CARD_HEIGHT = 132
export const TREE_COLUMN_GAP = 76
export const TREE_ROW_GAP = 24
export const TREE_BLOCK_PADDING = 16
/** Measured height of a fresh draft card: head, draft area and border. */
export const TREE_DRAFT_HEIGHT = 96

export interface TreeLayout {
  /** Card top-left positions, relative to the block content box. */
  positions: Record<string, { x: number; y: number }>
  width: number
  height: number
}

export function emptyTreeData(id: string, createdAt: string): SuperBoardTreeData {
  return {
    version: 1,
    rootId: id,
    nodes: [
      {
        id,
        parentId: null,
        title: '',
        question: '',
        answer: '',
        status: 'draft',
        createdAt,
      },
    ],
  }
}

export function treeNodeById(
  data: SuperBoardTreeData,
  id: string | null | undefined,
): SuperBoardTreeNode | undefined {
  if (!id) return undefined
  return data.nodes.find((node) => node.id === id)
}

/** Direct children in sibling order. */
export function treeChildren(
  data: SuperBoardTreeData,
  parentId: string | null,
): SuperBoardTreeNode[] {
  return data.nodes.filter((node) => node.parentId === parentId)
}

/**
 * Root-to-node path. Returns an empty array when the node is unreachable, so
 * callers cannot accidentally build a context from a detached card.
 */
export function treePath(
  data: SuperBoardTreeData,
  id: string,
): SuperBoardTreeNode[] {
  const path: SuperBoardTreeNode[] = []
  const seen = new Set<string>()
  let current = treeNodeById(data, id)
  while (current) {
    if (seen.has(current.id)) return []
    seen.add(current.id)
    path.unshift(current)
    current = current.parentId ? treeNodeById(data, current.parentId) : undefined
  }
  if (path[0]?.id !== data.rootId) return []
  return path
}

export function treeDescendantIds(
  data: SuperBoardTreeData,
  id: string,
): Set<string> {
  const result = new Set<string>()
  const queue = treeChildren(data, id)
  while (queue.length) {
    const node = queue.shift()!
    if (result.has(node.id)) continue
    result.add(node.id)
    queue.push(...treeChildren(data, node.id))
  }
  return result
}

/** Nodes reachable from the root, skipping collapsed branches. */
export function visibleTreeNodes(data: SuperBoardTreeData): SuperBoardTreeNode[] {
  const root = treeNodeById(data, data.rootId)
  if (!root) return []
  const result: SuperBoardTreeNode[] = []
  const walk = (node: SuperBoardTreeNode) => {
    result.push(node)
    if (node.branchCollapsed) return
    for (const child of treeChildren(data, node.id)) walk(child)
  }
  walk(root)
  return result
}

/** Highest ancestor that hides this node, or null when it is visible. */
export function hiddenByAncestor(
  data: SuperBoardTreeData,
  id: string,
): string | null {
  const path = treePath(data, id)
  for (const ancestor of path.slice(0, -1)) {
    if (ancestor.branchCollapsed) return ancestor.id
  }
  return null
}

function resolveHeights(
  heights: Record<string, number>,
  node: SuperBoardTreeNode,
) {
  return resolveCardHeight(heights, node)
}

/** Card height for layout: measured when available, clamped to the max. */
export function resolveCardHeight(
  heights: Record<string, number>,
  node: SuperBoardTreeNode,
) {
  const measured = heights[node.id]
  return measured && Number.isFinite(measured) && measured > 0
    ? Math.min(measured, TREE_CARD_MAX_HEIGHT)
    : TREE_DEFAULT_CARD_HEIGHT
}

/**
 * Left-to-right tree layout.
 *
 * Every card occupies a fixed-width column; each subtree is stacked vertically
 * and its parent is centred on it. Heights come from DOM measurement, so an
 * unmeasured card falls back to the default height instead of collapsing.
 */
export function layoutTree(
  data: SuperBoardTreeData,
  heights: Record<string, number> = {},
): TreeLayout {
  const visible = visibleTreeNodes(data)
  if (!visible.length) return { positions: {}, width: 0, height: 0 }
  const visibleIds = new Set(visible.map((node) => node.id))

  const spans = new Map<string, number>()
  const subtreeHeight = (node: SuperBoardTreeNode): number => {
    const cached = spans.get(node.id)
    if (cached !== undefined) return cached
    const own = resolveHeights(heights, node)
    const children = node.branchCollapsed
      ? []
      : treeChildren(data, node.id).filter((child) => visibleIds.has(child.id))
    const childrenHeight = children.reduce(
      (total, child, index) =>
        total + subtreeHeight(child) + (index > 0 ? TREE_ROW_GAP : 0),
      0,
    )
    const span = Math.max(own, childrenHeight)
    spans.set(node.id, span)
    return span
  }

  const positions: Record<string, { x: number; y: number }> = {}
  let maxX = 0
  const place = (node: SuperBoardTreeNode, x: number, top: number) => {
    const own = resolveHeights(heights, node)
    const span = subtreeHeight(node)
    positions[node.id] = { x, y: top + (span - own) / 2 }
    maxX = Math.max(maxX, x + TREE_CARD_WIDTH)
    if (node.branchCollapsed) return
    const children = treeChildren(data, node.id).filter((child) =>
      visibleIds.has(child.id),
    )
    let cursor = top
    for (const child of children) {
      place(child, x + TREE_CARD_WIDTH + TREE_COLUMN_GAP, cursor)
      cursor += subtreeHeight(child) + TREE_ROW_GAP
    }
  }

  const root = treeNodeById(data, data.rootId)
  if (root) place(root, 0, 0)

  return {
    positions,
    width: maxX,
    height: root ? subtreeHeight(root) : 0,
  }
}

/** Block dimensions for a layout, including the block padding. */
export function treeBlockSize(layout: TreeLayout) {
  return {
    width: Math.round(layout.width + TREE_BLOCK_PADDING * 2),
    height: Math.round(layout.height + TREE_BLOCK_PADDING * 2),
  }
}

export interface TreeEdge {
  id: string
  parentId: string
  childId: string
  path: string
  /** Arrow head, drawn as a filled triangle. */
  arrow: string
}

const TREE_ARROW_LENGTH = 7
const TREE_ARROW_HALF = 4
const TREE_ELBOW_RADIUS = 8
/** Half the expand button, so branch lines start just past its circle. */
export const TREE_EXPAND_RADIUS = 10

/** Polyline with quadratic corner rounding, like a mind-map branch line. */
function roundedElbow(points: Array<[number, number]>, radius: number) {
  if (points.length < 2) return ''
  let path = `M ${points[0][0]} ${points[0][1]}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const [previousX, previousY] = points[index - 1]
    const [cornerX, cornerY] = points[index]
    const [nextX, nextY] = points[index + 1]
    const inLength = Math.hypot(cornerX - previousX, cornerY - previousY)
    const outLength = Math.hypot(nextX - cornerX, nextY - cornerY)
    if (!inLength || !outLength) continue
    const r = Math.min(radius, inLength / 2, outLength / 2)
    const startX = cornerX + ((previousX - cornerX) / inLength) * r
    const startY = cornerY + ((previousY - cornerY) / inLength) * r
    const endX = cornerX + ((nextX - cornerX) / outLength) * r
    const endY = cornerY + ((nextY - cornerY) / outLength) * r
    path += ` L ${startX} ${startY} Q ${cornerX} ${cornerY} ${endX} ${endY}`
  }
  const last = points[points.length - 1]
  return `${path} L ${last[0]} ${last[1]}`
}

/**
 * Edges are derived from parent/child relations, never stored. Layout positions
 * are card top-left corners, so the anchor is right/left middle of each card.
 *
 * Branches leave the parent horizontally, turn once in the gap and arrive
 * horizontally, which reads far calmer than a full S-curve. The expand toggle
 * sits on the anchor point and hides it, so the line never needs an offset.
 */
export function treeEdges(
  data: SuperBoardTreeData,
  positions: Record<string, { x: number; y: number }>,
  heights: Record<string, number> = {},
): TreeEdge[] {
  const edges: TreeEdge[] = []
  const visible = new Set(visibleTreeNodes(data).map((node) => node.id))
  for (const node of data.nodes) {
    if (!node.parentId || !visible.has(node.id)) continue
    const parent = treeNodeById(data, node.parentId)
    const from = positions[parent?.id ?? '']
    const to = positions[node.id]
    if (!parent || !from || !to || !visible.has(parent.id)) continue
    const startX = from.x + TREE_CARD_WIDTH
    const startY = from.y + resolveCardHeight(heights, parent) / 2
    const endX = to.x - TREE_ARROW_LENGTH
    const endY = to.y + resolveCardHeight(heights, node) / 2
    const kneeX = startX + (endX - startX) / 2
    const points: Array<[number, number]> =
      Math.abs(endY - startY) < 0.5
        ? [
            [startX, startY],
            [endX, endY],
          ]
        : [
            [startX, startY],
            [kneeX, startY],
            [kneeX, endY],
            [endX, endY],
          ]
    edges.push({
      id: `${parent.id}->${node.id}`,
      parentId: parent.id,
      childId: node.id,
      path: roundedElbow(points, TREE_ELBOW_RADIUS),
      arrow: `M ${to.x} ${endY} L ${to.x - TREE_ARROW_LENGTH} ${endY - TREE_ARROW_HALF} L ${to.x - TREE_ARROW_LENGTH} ${endY + TREE_ARROW_HALF} Z`,
    })
  }
  return edges
}

let treeIdSeed = 0

/** Stable-enough local id: the document only needs uniqueness inside a tree. */
export function newTreeNodeId() {
  treeIdSeed += 1
  return `tree-${Date.now().toString(36)}-${treeIdSeed.toString(36)}`
}

export function addTreeChild(
  data: SuperBoardTreeData,
  parentId: string,
  patch: Partial<SuperBoardTreeNode> = {},
): { data: SuperBoardTreeData; node: SuperBoardTreeNode | null } {
  const parent = treeNodeById(data, parentId)
  if (!parent) return { data, node: null }
  const node: SuperBoardTreeNode = {
    id: newTreeNodeId(),
    parentId,
    title: '',
    question: '',
    answer: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    ...patch,
  }
  const nodes = [...data.nodes]
  // Keep siblings contiguous: insert after the last existing child.
  const lastChildIndex = nodes.reduce(
    (last, item, index) => (item.parentId === parentId ? index : last),
    -1,
  )
  if (lastChildIndex >= 0) nodes.splice(lastChildIndex + 1, 0, node)
  else nodes.push(node)
  // Adding a child to a collapsed branch would create an invisible card.
  const expanded = nodes.map((item) =>
    item.id === parentId && item.branchCollapsed
      ? { ...item, branchCollapsed: false }
      : item,
  )
  return { data: { ...data, nodes: expanded }, node }
}

export function updateTreeNode(
  data: SuperBoardTreeData,
  id: string,
  patch: Partial<SuperBoardTreeNode>,
): SuperBoardTreeData {
  let changed = false
  const nodes = data.nodes.map((node) => {
    if (node.id !== id) return node
    changed = true
    return { ...node, ...patch }
  })
  return changed ? { ...data, nodes } : data
}

/**
 * Remove a card. `branch` drops its whole subtree; `promote` lifts its children
 * to its parent. The root is never removed.
 */
export function removeTreeNode(
  data: SuperBoardTreeData,
  id: string,
  mode: 'branch' | 'promote',
): SuperBoardTreeData {
  if (id === data.rootId) return data
  const node = treeNodeById(data, id)
  if (!node) return data
  const drop = mode === 'branch' ? treeDescendantIds(data, id) : new Set<string>()
  drop.add(id)
  const nodes = data.nodes
    .filter((item) => !drop.has(item.id))
    .map((item) =>
      mode === 'promote' && item.parentId === id
        ? { ...item, parentId: node.parentId }
        : item,
    )
  return { ...data, nodes }
}

/** Markdown outline used as the block's plain-text fallback. */
export function treeOutline(data: SuperBoardTreeData): string {
  const lines: string[] = []
  const walk = (node: SuperBoardTreeNode, depth: number) => {
    const title = node.title.trim() || node.question.trim() || '未命名'
    lines.push(`${'  '.repeat(depth)}- ${title}`)
    for (const child of treeChildren(data, node.id)) walk(child, depth + 1)
  }
  const root = treeNodeById(data, data.rootId)
  if (root) walk(root, 0)
  return lines.join('\n')
}

/**
 * Cards that were just given a question and still need an answer. Comparing the
 * previous and next tree keeps generation out of the render path: adding a
 * child or collapsing a branch never triggers a request.
 */
export function questionsToAnswer(
  previous: SuperBoardTreeData,
  next: SuperBoardTreeData,
): string[] {
  const before = new Map(previous.nodes.map((node) => [node.id, node]))
  return next.nodes
    .filter((node) => {
      if (node.status !== 'done') return false
      if (!node.question.trim() || node.answer.trim()) return false
      return before.get(node.id)?.question !== node.question
    })
    .map((node) => node.id)
}
