import type { CanvasNode } from '../model'

export function nodeMapOf(nodes: CanvasNode[]) {
  return new Map(nodes.map((node) => [node.id, node]))
}

export function groupIdOf(node: CanvasNode) {
  return node['x-superboard']?.groupId
}

export function topAncestor(node: CanvasNode, map: Map<string, CanvasNode>) {
  let current = node
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    const groupId = groupIdOf(current)
    if (!groupId) return current
    const parent = map.get(groupId)
    if (!parent) return current
    current = parent
  }
  return current
}

export function selectableAncestor(
  node: CanvasNode,
  map: Map<string, CanvasNode>,
  focusGroupId?: string | null,
) {
  if (!focusGroupId) return topAncestor(node, map)
  const chain: CanvasNode[] = []
  let current = node
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    chain.push(current)
    const groupId = groupIdOf(current)
    if (!groupId) break
    const parent = map.get(groupId)
    if (!parent) break
    current = parent
  }
  const focusIndex = chain.findIndex((item) => item.id === focusGroupId)
  if (focusIndex < 0) return topAncestor(node, map)
  return chain[Math.max(0, focusIndex - 1)]
}

export function isInsideGroup(
  node: CanvasNode,
  groupId: string,
  map: Map<string, CanvasNode>,
) {
  if (node.id === groupId) return true
  let current = node
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    const parentId = groupIdOf(current)
    if (!parentId) return false
    if (parentId === groupId) return true
    const parent = map.get(parentId)
    if (!parent) return false
    current = parent
  }
  return false
}

export function isLocked(node: CanvasNode, map?: Map<string, CanvasNode>) {
  if (node['x-superboard']?.locked) return true
  if (!map) return false
  let current = node
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    const groupId = groupIdOf(current)
    if (!groupId) return false
    const parent = map.get(groupId)
    if (!parent) return false
    if (parent['x-superboard']?.locked) return true
    current = parent
  }
  return false
}

export function hasSelectedAncestor(
  node: CanvasNode,
  map: Map<string, CanvasNode>,
  selected: Set<string>,
) {
  let current = node
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    const groupId = groupIdOf(current)
    if (!groupId) return false
    if (selected.has(groupId)) return true
    const parent = map.get(groupId)
    if (!parent) return false
    current = parent
  }
  return false
}

export function collectDescendants(node: CanvasNode, nodes: CanvasNode[]) {
  const result: CanvasNode[] = []
  const seen = new Set<string>()
  const queue = [node.id]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) continue
    for (const candidate of nodes) {
      if (candidate['x-superboard']?.groupId !== id || seen.has(candidate.id)) continue
      seen.add(candidate.id)
      result.push(candidate)
      queue.push(candidate.id)
    }
  }
  return result
}

export interface NodeBlock {
  root: CanvasNode
  nodes: CanvasNode[]
}

export function collectBlocks(nodes: CanvasNode[]): NodeBlock[] {
  const map = nodeMapOf(nodes)
  const children = new Map<string, CanvasNode[]>()
  const roots: CanvasNode[] = []
  for (const node of nodes) {
    const groupId = groupIdOf(node)
    if (groupId && map.has(groupId) && groupId !== node.id) {
      const list = children.get(groupId) ?? []
      list.push(node)
      children.set(groupId, list)
    } else {
      roots.push(node)
    }
  }
  return roots.map((root) => {
    const block: CanvasNode[] = [root]
    const queue = [root]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) continue
      for (const child of children.get(current.id) ?? []) {
        block.push(child)
        queue.push(child)
      }
    }
    return { root, nodes: block }
  })
}

export function nextFreeId(existing: Set<string>, prefix: string) {
  let index = 1
  let id = `${prefix}-${index}`
  while (existing.has(id)) {
    index += 1
    id = `${prefix}-${index}`
  }
  existing.add(id)
  return id
}
