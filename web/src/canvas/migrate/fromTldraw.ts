import { getPointsFromDrawSegments } from 'tldraw'
import type { BoardFile } from '../../shared/board/types'
import type {
  CanvasDocument,
  CanvasEdge,
  CanvasFrame,
  CanvasNode,
  SuperBoardMediaKind,
  SuperBoardShapeKind,
  SuperBoardStroke,
  SuperBoardStyle,
} from '../model'

type ShapeRecord = {
  id: string
  type: string
  typeName?: string
  index?: string
  x: number
  y: number
  rotation?: number
  opacity?: number
  props: Record<string, any>
}

const DRAW_SIZES: Record<string, number> = {
  s: 2,
  m: 3.5,
  l: 5,
  xl: 8,
}

const COLOR_HEX: Record<string, string> = {
  black: '#1d1d1d',
  grey: '#9ca3af',
  lightgray: '#e5e7eb',
  blue: '#3b82f6',
  lightblue: '#93c5fd',
  green: '#22c55e',
  lightgreen: '#86efac',
  red: '#ef4444',
  lightred: '#fca5a5',
  orange: '#f97316',
  yellow: '#eab308',
  violet: '#8b5cf6',
  white: '#ffffff',
}

function round(value: number) {
  return Math.round(value)
}

function clampSize(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, round(value)) : fallback
}

function color(value: unknown) {
  return typeof value === 'string' ? (COLOR_HEX[value] ?? value) : '#1d1d1d'
}

function styleFromProps(props: Record<string, any>, opacity = 1): SuperBoardStyle {
  return {
    backgroundColor: props.backgroundColor,
    backgroundOpacity: props.backgroundOpacity,
    borderColor: props.borderColor,
    borderOpacity: props.borderOpacity,
    borderWidth: props.borderWidth,
    borderStyle: props.borderStyle,
    opacity,
  }
}

function textFromProps(props: Record<string, any>) {
  if (typeof props.text === 'string') return props.text
  if (typeof props.richText === 'string') return props.richText
  return ''
}

function geometryFromPoints(points: Array<{ x: number; y: number }>) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

function drawStrokes(shape: ShapeRecord): SuperBoardStroke[] {
  const segments = Array.isArray(shape.props.segments) ? shape.props.segments : []
  const points = getPointsFromDrawSegments(segments, shape.props.scaleX ?? 1, shape.props.scaleY ?? 1)
  if (points.length === 0) return []

  return [
    {
      id: `${shape.id}:stroke:0`,
      color: color(shape.props.color),
      size: DRAW_SIZES[shape.props.size] ?? DRAW_SIZES.m,
      simulatePressure: true,
      points: points.map((point) => [point.x, point.y]),
    },
  ]
}

function shapeKind(type: string): SuperBoardShapeKind | null {
  if (type === 'rectangle' || type === 'rect') return 'rect'
  if (type === 'ellipse' || type === 'oval') return 'ellipse'
  if (type === 'diamond') return 'diamond'
  if (type === 'line' || type === 'arrow') return 'line'
  return null
}

function mediaKind(value: unknown): SuperBoardMediaKind {
  return value === 'video' || value === 'iframe' || value === 'image' ? value : 'image'
}

function convertShape(shape: ShapeRecord): CanvasNode | null {
  if (shape.type === 'sb-frame') return null

  const props = shape.props ?? {}
  const width = clampSize(props.w, shape.type === 'text' ? 320 : 240)
  const height = clampSize(props.h, shape.type === 'text' ? 80 : 140)
  const base = {
    id: shape.id,
    x: round(shape.x),
    y: round(shape.y),
    width,
    height,
  }

  if (shape.type === 'sb-markdown') {
    return {
      ...base,
      type: 'text',
      text: typeof props.text === 'string' ? props.text : '',
      'x-superboard': {
        kind: 'markdown',
        style: styleFromProps(props, shape.opacity),
      },
    }
  }

  if (shape.type === 'sb-pele') {
    const code = typeof props.code === 'string' ? props.code : ''
    return {
      ...base,
      type: 'text',
      text: `\`\`\`mermaid\n${code}\n\`\`\``,
      'x-superboard': {
        kind: 'pele',
        diagram: typeof props.diagram === 'string' ? props.diagram : undefined,
        code,
        style: styleFromProps(props, shape.opacity),
      },
    }
  }

  if (shape.type === 'sb-media') {
    const url = typeof props.url === 'string' ? props.url : ''
    return {
      ...base,
      type: 'link',
      url,
      'x-superboard': {
        kind: 'media',
        media: {
          kind: mediaKind(props.kind),
          url,
          crop: props.crop,
          cropX: props.cropX,
          cropY: props.cropY,
          cropW: props.cropW,
          cropH: props.cropH,
          cropCx: props.cropCx,
          cropCy: props.cropCy,
          cropRadius: props.cropRadius,
          cropCorner: props.cropCorner,
        } as any,
      },
    }
  }

  if (shape.type === 'text') {
    return {
      ...base,
      type: 'text',
      text: textFromProps(props),
      'x-superboard': {
        kind: 'text',
        style: {
          color: color(props.color),
          fontSize: props.size === 's' ? 16 : props.size === 'l' ? 32 : props.size === 'xl' ? 44 : 24,
          fontFamily: 'PingFang SC, Microsoft YaHei, Segoe UI, sans-serif',
          textAlign: props.textAlign,
        },
      },
    }
  }

  if (shape.type === 'draw') {
    const rawStrokes = drawStrokes(shape)
    if (rawStrokes.length === 0) return null
    const points = rawStrokes.flatMap((stroke) => stroke.points)
    const bounds = geometryFromPoints(points.map(([x, y]) => ({ x, y })))
    const strokes = rawStrokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map(([x, y, pressure]) => [
        x - bounds.minX,
        y - bounds.minY,
        ...(pressure === undefined ? [] : [pressure]),
      ]),
    })) as SuperBoardStroke[]
    return {
      ...base,
      x: round(shape.x + bounds.minX),
      y: round(shape.y + bounds.minY),
      width: Math.max(1, round(bounds.maxX - bounds.minX)),
      height: Math.max(1, round(bounds.maxY - bounds.minY)),
      type: 'group',
      'x-superboard': {
        kind: 'drawing',
        strokes,
        style: { opacity: shape.opacity },
      },
    }
  }

  const kind = shapeKind(shape.type)
  if (kind) {
    return {
      ...base,
      type: 'group',
      'x-superboard': {
        kind: 'shape',
        shape: kind,
        style: {
          fill: color(props.fill),
          stroke: color(props.color),
          strokeWidth: props.size === 's' ? 1 : props.size === 'l' ? 4 : 2,
          strokeDash: props.dash === 'dashed' ? [8, 6] : props.dash === 'dotted' ? [2, 4] : undefined,
          opacity: shape.opacity,
        },
        rotation: shape.rotation,
      },
    }
  }

  return {
    ...base,
    type: 'text',
    text: `[未迁移形状: ${shape.type}]`,
    'x-superboard': { kind: 'text' },
  }
}

function directorFrames(board: BoardFile): CanvasFrame[] | undefined {
  const frames = board.director?.frames
  if (!frames?.length) return undefined
  return frames.map((frame) => ({
    id: frame.id,
    order: frame.order,
    name: frame.name,
    x: round(frame.x),
    y: round(frame.y),
    width: round(frame.w),
    height: round(frame.h),
  }))
}

export function convertTldrawBoard(board: BoardFile): CanvasDocument {
  const records = Object.values(board.document.store) as ShapeRecord[]
  const shapes = records
    .filter((record) => record?.typeName === 'shape')
    .sort((a, b) => String((a as any).index ?? '').localeCompare(String((b as any).index ?? '')))

  const nodes = shapes.map(convertShape).filter((node): node is CanvasNode => Boolean(node))
  const edges: CanvasEdge[] = []
  const frames = directorFrames(board)

  return {
    nodes,
    edges,
    'x-superboard': {
      version: 1,
      meta: {
        title: board.meta.title,
        slug: board.meta.slug,
        summary: board.meta.summary,
        order: board.meta.order,
        draft: board.meta.draft,
        aliases: board.meta.aliases,
        updatedAt: board.meta.updatedAt,
      },
      ...(frames ? { director: { frames } } : {}),
    },
  }
}
