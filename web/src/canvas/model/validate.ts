import {
  CANVAS_ARROW_ENDS,
  CANVAS_NODE_TYPES,
  CANVAS_SIDES,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
} from './types'

export class CanvasValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanvasValidationError'
  }
}

function fail(message: string): never {
  throw new CanvasValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateNode(value: unknown, index: number): CanvasNode {
  if (!isRecord(value)) fail(`nodes[${index}] 必须是对象`)

  const id = value.id
  if (typeof id !== 'string' || !id) fail(`nodes[${index}].id 必须是非空字符串`)

  const type = value.type
  if (!CANVAS_NODE_TYPES.includes(type as never)) {
    fail(`nodes[${index}].type 不支持: ${JSON.stringify(type)}`)
  }

  for (const key of ['x', 'y', 'width', 'height']) {
    if (!isFiniteNumber(value[key])) fail(`nodes[${index}].${key} 必须是有限数字`)
  }
  if ((value.width as number) <= 0 || (value.height as number) <= 0) {
    fail(`nodes[${index}] 的 width/height 必须大于 0`)
  }

  if (type === 'text' && typeof value.text !== 'string') {
    fail(`nodes[${index}].text 必须是字符串`)
  }
  if (type === 'file' && typeof value.file !== 'string') {
    fail(`nodes[${index}].file 必须是字符串`)
  }
  if (type === 'link' && typeof value.url !== 'string') {
    fail(`nodes[${index}].url 必须是字符串`)
  }
  if (type === 'group' && value.label !== undefined && typeof value.label !== 'string') {
    fail(`nodes[${index}].label 必须是字符串`)
  }

  if (value['x-superboard'] !== undefined && !isRecord(value['x-superboard'])) {
    fail(`nodes[${index}]["x-superboard"] 必须是对象`)
  }

  return value as unknown as CanvasNode
}

function validateEdge(value: unknown, index: number, nodeIds: Set<string>): CanvasEdge {
  if (!isRecord(value)) fail(`edges[${index}] 必须是对象`)

  const id = value.id
  if (typeof id !== 'string' || !id) fail(`edges[${index}].id 必须是非空字符串`)

  const fromNode = value.fromNode
  const toNode = value.toNode
  if (typeof fromNode !== 'string' || !nodeIds.has(fromNode)) {
    fail(`edges[${index}].fromNode 必须引用已存在的节点`)
  }
  if (typeof toNode !== 'string' || !nodeIds.has(toNode)) {
    fail(`edges[${index}].toNode 必须引用已存在的节点`)
  }

  for (const key of ['fromSide', 'toSide'] as const) {
    const side = value[key]
    if (side !== undefined && !CANVAS_SIDES.includes(side as never)) {
      fail(`edges[${index}].${key} 不合法: ${JSON.stringify(side)}`)
    }
  }

  for (const key of ['fromEnd', 'toEnd'] as const) {
    const end = value[key]
    if (end !== undefined && !CANVAS_ARROW_ENDS.includes(end as never)) {
      fail(`edges[${index}].${key} 不合法: ${JSON.stringify(end)}`)
    }
  }

  return value as unknown as CanvasEdge
}

export function validateCanvas(value: unknown): CanvasDocument {
  if (!isRecord(value)) fail('画布必须是对象')

  const rawNodes = value.nodes ?? []
  const rawEdges = value.edges ?? []
  if (!Array.isArray(rawNodes)) fail('nodes 必须是数组')
  if (!Array.isArray(rawEdges)) fail('edges 必须是数组')

  const nodes = rawNodes.map(validateNode)
  const nodeIds = new Set<string>()
  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id)) fail(`nodes[${index}].id 重复: ${node.id}`)
    nodeIds.add(node.id)
  }

  const edges = rawEdges.map((edge, index) => validateEdge(edge, index, nodeIds))
  const edgeIds = new Set<string>()
  for (const [index, edge] of edges.entries()) {
    if (edgeIds.has(edge.id)) fail(`edges[${index}].id 重复: ${edge.id}`)
    edgeIds.add(edge.id)
  }

  const extension = value['x-superboard']
  if (extension !== undefined) {
    if (!isRecord(extension)) fail('x-superboard 必须是对象')
    if (extension.version !== 1) fail('x-superboard.version 必须是 1')
    if (!isRecord(extension.meta)) fail('x-superboard.meta 必须是对象')

    const title = extension.meta.title
    const slug = extension.meta.slug
    if (typeof title !== 'string' || !title.trim()) fail('x-superboard.meta.title 不能为空')
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      fail('x-superboard.meta.slug 不合法')
    }

    const director = extension.director
    if (director !== undefined) {
      if (!isRecord(director) || !Array.isArray(director.frames)) {
        fail('x-superboard.director.frames 必须是数组')
      }
      for (const [index, frame] of director.frames.entries()) {
        if (!isRecord(frame)) fail(`director.frames[${index}] 必须是对象`)
        if (typeof frame.id !== 'string' || !frame.id) fail(`director.frames[${index}].id 不合法`)
        if (!isFiniteNumber(frame.order)) fail(`director.frames[${index}].order 必须是数字`)
        for (const key of ['x', 'y', 'width', 'height']) {
          if (!isFiniteNumber(frame[key])) fail(`director.frames[${index}].${key} 必须是数字`)
        }
      }
    }
  }

  return {
    nodes,
    edges,
    ...(extension !== undefined ? { 'x-superboard': extension as never } : {}),
  }
}

export function parseCanvas(text: string): CanvasDocument {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    fail(`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  return validateCanvas(value)
}

export function serializeCanvas(document: CanvasDocument): string {
  validateCanvas(document)
  return `${JSON.stringify(document, null, 2)}\n`
}

export function getNodeExtension(node: CanvasNode) {
  return node['x-superboard']
}
