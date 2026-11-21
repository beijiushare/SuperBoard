import i18n from '../../i18n'
import {
  CANVAS_ARROW_ENDS,
  CANVAS_NODE_TYPES,
  CANVAS_SIDES,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
} from './types'

export class CanvasValidationError extends Error {
  readonly code: string

  constructor(message: string, code = '') {
    super(message)
    this.name = 'CanvasValidationError'
    this.code = code
  }
}

function fail(error: { key: string; params: Record<string, unknown> }): never {
  const fallback = `errors:canvas.${error.key}`
  const translated = i18n.t(fallback, error.params)
  throw new CanvasValidationError(
    typeof translated === 'string' && translated ? translated : fallback,
    error.key,
  )
}

function canvasError(key: string, params: Record<string, unknown> = {}) {
  return { key, params }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateNode(value: unknown, index: number): CanvasNode {
  if (!isRecord(value)) {
    fail(canvasError('expectedObject', { path: `nodes[${index}]` }))
  }

  const id = value.id
  if (typeof id !== 'string' || !id) {
    fail(canvasError('nonEmptyString', { path: `nodes[${index}].id` }))
  }

  const type = value.type
  if (!CANVAS_NODE_TYPES.includes(type as never)) {
    fail(
      canvasError('unsupportedType', {
        path: `nodes[${index}]`,
        value: JSON.stringify(type),
      }),
    )
  }

  // Migrate the legacy `link` + x-superboard.media.kind="file" representation
  // to the JSON Canvas native file node.
  let normalized: Record<string, unknown> = value
  let normalizedType = type
  const extension = value['x-superboard']
  if (
    type === 'link' &&
    isRecord(extension) &&
    isRecord(extension.media) &&
    extension.media.kind === 'file' &&
    typeof extension.media.file === 'string'
  ) {
    const media = {
      ...extension.media,
      url:
        typeof extension.media.url === 'string'
          ? extension.media.url
          : extension.media.file,
    }
    normalized = {
      ...value,
      type: 'file',
      file: extension.media.file,
      'x-superboard': { ...extension, media },
    }
    delete normalized.url
    normalizedType = 'file'
  }

  for (const key of ['x', 'y', 'width', 'height']) {
    if (!isFiniteNumber(normalized[key])) {
      fail(canvasError('finiteNumber', { path: `nodes[${index}].${key}` }))
    }
  }
  if ((normalized.width as number) <= 0 || (normalized.height as number) <= 0) {
    fail(canvasError('positiveSize', { path: `nodes[${index}]` }))
  }

  if (normalizedType === 'text' && typeof normalized.text !== 'string') {
    fail(canvasError('expectedString', { path: `nodes[${index}].text` }))
  }
  if (normalizedType === 'file' && typeof normalized.file !== 'string') {
    fail(canvasError('expectedString', { path: `nodes[${index}].file` }))
  }
  if (normalizedType === 'link' && typeof normalized.url !== 'string') {
    fail(canvasError('expectedString', { path: `nodes[${index}].url` }))
  }
  if (normalizedType === 'group' && normalized.label !== undefined && typeof normalized.label !== 'string') {
    fail(canvasError('expectedString', { path: `nodes[${index}].label` }))
  }

  if (normalized['x-superboard'] !== undefined && !isRecord(normalized['x-superboard'])) {
    fail(canvasError('expectedObject', { path: `nodes[${index}]["x-superboard"]` }))
  }

  return normalized as unknown as CanvasNode
}

function validateEdge(value: unknown, index: number, nodeIds: Set<string>): CanvasEdge {
  if (!isRecord(value)) {
    fail(canvasError('expectedObject', { path: `edges[${index}]` }))
  }

  const id = value.id
  if (typeof id !== 'string' || !id) {
    fail(canvasError('nonEmptyString', { path: `edges[${index}].id` }))
  }

  const fromNode = value.fromNode
  const toNode = value.toNode
  if (typeof fromNode !== 'string' || !nodeIds.has(fromNode)) {
    fail(canvasError('missingNodeRef', { path: `edges[${index}].fromNode` }))
  }
  if (typeof toNode !== 'string' || !nodeIds.has(toNode)) {
    fail(canvasError('missingNodeRef', { path: `edges[${index}].toNode` }))
  }

  for (const key of ['fromSide', 'toSide'] as const) {
    const side = value[key]
    if (side !== undefined && !CANVAS_SIDES.includes(side as never)) {
      fail(
        canvasError('invalidValue', {
          path: `edges[${index}].${key}`,
          value: JSON.stringify(side),
        }),
      )
    }
  }

  for (const key of ['fromEnd', 'toEnd'] as const) {
    const end = value[key]
    if (end !== undefined && !CANVAS_ARROW_ENDS.includes(end as never)) {
      fail(
        canvasError('invalidValue', {
          path: `edges[${index}].${key}`,
          value: JSON.stringify(end),
        }),
      )
    }
  }

  return value as unknown as CanvasEdge
}

export function validateCanvas(value: unknown): CanvasDocument {
  if (!isRecord(value)) fail(canvasError('rootNotObject'))

  const rawNodes = value.nodes ?? []
  const rawEdges = value.edges ?? []
  if (!Array.isArray(rawNodes)) fail(canvasError('expectedArray', { path: 'nodes' }))
  if (!Array.isArray(rawEdges)) fail(canvasError('expectedArray', { path: 'edges' }))

  const nodes = rawNodes.map(validateNode)
  const nodeIds = new Set<string>()
  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id)) {
      fail(
        canvasError('duplicateId', {
          path: `nodes[${index}]`,
          value: node.id,
        }),
      )
    }
    nodeIds.add(node.id)
  }

  const edges = rawEdges.map((edge, index) => validateEdge(edge, index, nodeIds))
  const edgeIds = new Set<string>()
  for (const [index, edge] of edges.entries()) {
    if (edgeIds.has(edge.id)) {
      fail(
        canvasError('duplicateId', {
          path: `edges[${index}]`,
          value: edge.id,
        }),
      )
    }
    edgeIds.add(edge.id)
  }

  const extension = value['x-superboard']
  if (extension !== undefined) {
    if (!isRecord(extension)) fail(canvasError('expectedObject', { path: 'x-superboard' }))
    if (extension.version !== 1) fail(canvasError('version'))
    if (!isRecord(extension.meta)) {
      fail(canvasError('expectedObject', { path: 'x-superboard.meta' }))
    }

    const title = extension.meta.title
    const slug = extension.meta.slug
    if (typeof title !== 'string' || !title.trim()) fail(canvasError('emptyTitle'))
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      fail(canvasError('invalidSlug'))
    }

    const director = extension.director
    if (director !== undefined) {
      if (!isRecord(director) || !Array.isArray(director.frames)) {
        fail(canvasError('expectedArray', { path: 'x-superboard.director.frames' }))
      }
      for (const [index, frame] of director.frames.entries()) {
        if (!isRecord(frame)) {
          fail(canvasError('expectedObject', { path: `director.frames[${index}]` }))
        }
        if (typeof frame.id !== 'string' || !frame.id) {
          fail(canvasError('invalidValue', { path: `director.frames[${index}].id` }))
        }
        if (!isFiniteNumber(frame.order)) {
          fail(canvasError('finiteNumber', { path: `director.frames[${index}].order` }))
        }
        for (const key of ['x', 'y', 'width', 'height']) {
          if (!isFiniteNumber(frame[key])) {
            fail(canvasError('finiteNumber', { path: `director.frames[${index}].${key}` }))
          }
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
    fail(
      canvasError('jsonParse', {
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }
  return validateCanvas(value)
}

export function stringifyCanvas(document: CanvasDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

export function serializeCanvas(document: CanvasDocument): string {
  validateCanvas(document)
  return stringifyCanvas(document)
}

export function getNodeExtension(node: CanvasNode) {
  return node['x-superboard']
}
