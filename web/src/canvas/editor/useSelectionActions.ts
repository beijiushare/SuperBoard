import { useRef } from 'react'
import { GROUP_DEFAULT_PADDING, type CanvasDocument, type CanvasNode } from '../model'
import { PASTE_OFFSET, nextId, type Clipboard } from './appUtils'
import {
  collectBlocks,
  collectDescendants,
  hasSelectedAncestor,
  isLocked,
  nextFreeId,
  nodeMapOf,
} from './hierarchy'

interface UseSelectionActionsOptions {
  canvas: CanvasDocument | null
  selectedIds: string[]
  selectedEdgeId: string | null
  recordHistory: (mergeKey?: string) => void
  applyDocument: (next: CanvasDocument, selection?: string[]) => void
  markDirty: () => void
  setSelectedIds: (ids: string[]) => void
  setSelectedEdgeId: (id: string | null) => void
  setFocusedGroupId: (id: string | null) => void
}

export function useSelectionActions({
  canvas,
  selectedIds,
  selectedEdgeId,
  recordHistory,
  applyDocument,
  markDirty,
  setSelectedIds,
  setSelectedEdgeId,
  setFocusedGroupId,
}: UseSelectionActionsOptions) {
  const clipboardRef = useRef<Clipboard | null>(null)
  const pasteCountRef = useRef(0)

  function collectSelected() {
    if (!canvas || selectedIds.length === 0) return null
    const ids = new Set(selectedIds)
    const copied = new Map<string, CanvasNode>()
    for (const node of canvas.nodes) {
      if (!ids.has(node.id)) continue
      copied.set(node.id, node)
      for (const child of collectDescendants(node, canvas.nodes)) {
        copied.set(child.id, child)
      }
    }
    return copied
  }

  function copySelection() {
    const copied = collectSelected()
    if (!canvas || !copied) return
    clipboardRef.current = {
      nodes: [...copied.values()].map((node) => structuredClone(node)),
      edges: canvas.edges
        .filter((edge) => copied.has(edge.fromNode) && copied.has(edge.toNode))
        .map((edge) => structuredClone(edge)),
    }
    pasteCountRef.current = 0
  }

  function attachClones(
    copied: Map<string, CanvasNode>,
    offset: number,
  ): { nodes: CanvasNode[]; edges: CanvasDocument['edges'] } {
    if (!canvas) return { nodes: [], edges: [] }
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const idMap = new Map<string, string>()
    const nodes = [...copied.values()].map((node) => {
      const clone = structuredClone(node)
      clone.id = nextId(existing, node.id)
      clone.x = node.x + offset
      clone.y = node.y + offset
      idMap.set(node.id, clone.id)
      return clone
    })
    for (const node of nodes) {
      const extension = node['x-superboard']
      if (!extension?.groupId) continue
      const mapped = idMap.get(extension.groupId)
      if (mapped) extension.groupId = mapped
      else delete extension.groupId
    }
    const edges = canvas.edges
      .filter((edge) => copied.has(edge.fromNode) && copied.has(edge.toNode))
      .map((edge) => {
        const clone = structuredClone(edge)
        clone.id = nextId(existing, edge.id)
        clone.fromNode = idMap.get(edge.fromNode) ?? edge.fromNode
        clone.toNode = idMap.get(edge.toNode) ?? edge.toNode
        return clone
      })
    return { nodes, edges }
  }

  function applyClones(
    nodes: CanvasNode[],
    edges: CanvasDocument['edges'],
  ) {
    if (!canvas) return
    applyDocument({
      ...canvas,
      nodes: [...canvas.nodes, ...nodes],
      edges: [...canvas.edges, ...edges],
    })
    const clonedIds = new Set(nodes.map((node) => node.id))
    const roots = nodes.filter((node) => {
      const groupId = node['x-superboard']?.groupId
      return !groupId || !clonedIds.has(groupId)
    })
    if (roots.length > 0) setSelectedIds(roots.map((node) => node.id))
  }

  function pasteClipboard() {
    if (!canvas || !clipboardRef.current) return
    const clipboard = clipboardRef.current
    recordHistory()
    pasteCountRef.current += 1
    const offset = PASTE_OFFSET * pasteCountRef.current
    const copied = new Map<string, CanvasNode>()
    for (const node of clipboard.nodes) copied.set(node.id, node)
    const { nodes, edges } = attachClones(copied, offset)
    applyClones(nodes, edges)
  }

  function duplicateSelection() {
    const copied = collectSelected()
    if (!canvas || !copied || copied.size === 0) return
    recordHistory()
    const { nodes, edges } = attachClones(copied, 24)
    applyClones(nodes, edges)
  }

  function deleteSelection(
    ids: string[] = selectedIds,
    edgeId: string | null = selectedEdgeId,
  ) {
    if (!canvas) return
    if (edgeId) {
      recordHistory()
      applyDocument({
        ...canvas,
        edges: canvas.edges.filter((edge) => edge.id !== edgeId),
      })
      setSelectedEdgeId(null)
      return
    }
    if (ids.length === 0) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(ids)
    const deleted = new Set<string>()
    for (const node of canvas.nodes) {
      if (!selected.has(node.id) || isLocked(node, map)) continue
      deleted.add(node.id)
      for (const child of collectDescendants(node, canvas.nodes)) deleted.add(child.id)
    }
    if (deleted.size === 0) return
    recordHistory()
    const nodes = canvas.nodes.filter((node) => !deleted.has(node.id))
    for (const node of nodes) {
      const groupId = node['x-superboard']?.groupId
      if (groupId && deleted.has(groupId)) delete node['x-superboard']?.groupId
    }
    applyDocument({
      ...canvas,
      nodes,
      edges: canvas.edges.filter(
        (edge) => !deleted.has(edge.fromNode) && !deleted.has(edge.toNode),
      ),
    })
  }

  function ensureExtension(node: CanvasNode) {
    if (!node['x-superboard']) {
      node['x-superboard'] = {
        kind: node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media',
      }
    }
    return node['x-superboard']!
  }

  function groupSelection() {
    if (!canvas) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(selectedIds)
    const roots = canvas.nodes.filter(
      (node) =>
        selected.has(node.id) &&
        !hasSelectedAncestor(node, map, selected) &&
        !isLocked(node, map),
    )
    if (roots.length < 2) return
    recordHistory()
    const existing = new Set(canvas.nodes.map((node) => node.id))
    const groupId = nextFreeId(existing, 'group')
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of roots) {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    }
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'group',
      x: minX - GROUP_DEFAULT_PADDING,
      y: minY - GROUP_DEFAULT_PADDING,
      width: Math.max(1, maxX - minX + GROUP_DEFAULT_PADDING * 2),
      height: Math.max(1, maxY - minY + GROUP_DEFAULT_PADDING * 2),
      'x-superboard': {
        kind: 'group',
        style: { padding: GROUP_DEFAULT_PADDING },
      },
    }
    for (const node of roots) ensureExtension(node).groupId = groupId
    const minimumIndex = Math.min(...roots.map((node) => canvas.nodes.indexOf(node)))
    const nodes = [...canvas.nodes]
    nodes.splice(minimumIndex, 0, groupNode)
    applyDocument({ ...canvas, nodes })
    setSelectedIds([groupId])
  }

  function ungroupSelection() {
    if (!canvas) return
    const map = nodeMapOf(canvas.nodes)
    const selected = new Set(selectedIds)
    const groups = canvas.nodes.filter(
      (node) =>
        selected.has(node.id) &&
        node['x-superboard']?.kind === 'group' &&
        !isLocked(node, map),
    )
    if (groups.length === 0) return
    recordHistory()
    const groupIds = new Set(groups.map((node) => node.id))
    const released = new Set<string>()
    for (const node of canvas.nodes) {
      const groupId = node['x-superboard']?.groupId
      if (!groupId || !groupIds.has(groupId)) continue
      delete node['x-superboard']?.groupId
      released.add(node.id)
    }
    applyDocument({
      ...canvas,
      nodes: canvas.nodes.filter((node) => !groupIds.has(node.id)),
      edges: canvas.edges.filter(
        (edge) => !groupIds.has(edge.fromNode) && !groupIds.has(edge.toNode),
      ),
    })
    const remaining = selectedIds.filter((id) => !groupIds.has(id))
    setSelectedIds([...new Set([...remaining, ...released])])
  }

  function enterGroup() {
    if (!canvas || selectedIds.length !== 1) return
    const map = nodeMapOf(canvas.nodes)
    const node = map.get(selectedIds[0])
    if (!node || node['x-superboard']?.kind !== 'group' || isLocked(node, map)) return
    const children = canvas.nodes.filter(
      (item) =>
        item['x-superboard']?.groupId === node.id && !isLocked(item, map),
    )
    setFocusedGroupId(node.id)
    setSelectedEdgeId(null)
    setSelectedIds(children.map((item) => item.id))
  }

  function toggleGroup() {
    if (canvas && selectedIds.length === 1) {
      const node = canvas.nodes.find((item) => item.id === selectedIds[0])
      if (node?.['x-superboard']?.kind === 'group') {
        ungroupSelection()
        return
      }
    }
    groupSelection()
  }

  function toggleLockSelection() {
    if (!canvas || selectedIds.length === 0) return
    const selected = new Set(selectedIds)
    const targets = canvas.nodes.filter((node) => selected.has(node.id))
    if (targets.length === 0) return
    const allLocked = targets.every((node) => node['x-superboard']?.locked)
    recordHistory()
    for (const node of targets) {
      const extension = ensureExtension(node)
      if (allLocked) delete extension.locked
      else extension.locked = true
    }
    markDirty()
    setSelectedIds([...selectedIds])
  }

  function unlockAllLocked() {
    if (!canvas) return
    const locked = canvas.nodes.filter((node) => node['x-superboard']?.locked)
    if (locked.length === 0) return
    recordHistory()
    for (const node of locked) delete node['x-superboard']?.locked
    markDirty()
    setSelectedIds([])
  }

  function reorderSelection(mode: 'front' | 'back' | 'forward' | 'backward') {
    if (!canvas || selectedIds.length === 0) return
    const blocks = collectBlocks(canvas.nodes)
    const selected = new Set(selectedIds)
    const isSelected = (block: (typeof blocks)[number]) =>
      block.nodes.some((node) => selected.has(node.id))
    const before = blocks.map((block) => block.root.id).join('|')
    let ordered = [...blocks]
    if (mode === 'front' || mode === 'back') {
      const chosen = ordered.filter(isSelected)
      if (chosen.length === 0) return
      const rest = ordered.filter((block) => !isSelected(block))
      ordered = mode === 'front' ? [...rest, ...chosen] : [...chosen, ...rest]
    } else if (mode === 'forward') {
      for (let index = ordered.length - 2; index >= 0; index -= 1) {
        if (isSelected(ordered[index]) && !isSelected(ordered[index + 1])) {
          const temp = ordered[index]
          ordered[index] = ordered[index + 1]
          ordered[index + 1] = temp
        }
      }
    } else {
      for (let index = 1; index < ordered.length; index += 1) {
        if (isSelected(ordered[index]) && !isSelected(ordered[index - 1])) {
          const temp = ordered[index]
          ordered[index] = ordered[index - 1]
          ordered[index - 1] = temp
        }
      }
    }
    const after = ordered.map((block) => block.root.id).join('|')
    if (before === after) return
    recordHistory()
    applyDocument({ ...canvas, nodes: ordered.flatMap((block) => block.nodes) })
    setSelectedIds(selectedIds)
  }

  function selectAllUnlocked() {
    if (!canvas) return
    const map = nodeMapOf(canvas.nodes)
    const ids = canvas.nodes
      .filter((node) => {
        const groupId = node['x-superboard']?.groupId
        if (groupId && map.has(groupId)) return false
        return !isLocked(node, map)
      })
      .map((node) => node.id)
    setSelectedIds(ids)
  }

  return {
    copySelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelection,
    groupSelection,
    ungroupSelection,
    enterGroup,
    toggleGroup,
    toggleLockSelection,
    unlockAllLocked,
    reorderSelection,
    selectAllUnlocked,
  }
}
