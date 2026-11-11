export const CANVAS_NODE_TYPES = ['text', 'file', 'link', 'group'] as const
export const CANVAS_SIDES = ['top', 'right', 'bottom', 'left'] as const
export const CANVAS_ARROW_ENDS = ['none', 'arrow'] as const

export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number]
export type CanvasSide = (typeof CANVAS_SIDES)[number]
export type CanvasArrowEnd = (typeof CANVAS_ARROW_ENDS)[number]

export interface CanvasNodeBase {
  id: string
  type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  color?: string
  'x-superboard'?: SuperBoardNodeExtension
}

export interface CanvasTextNode extends CanvasNodeBase {
  type: 'text'
  text: string
}

export interface CanvasFileNode extends CanvasNodeBase {
  type: 'file'
  file: string
  subpath?: string
}

export interface CanvasLinkNode extends CanvasNodeBase {
  type: 'link'
  url: string
}

export interface CanvasGroupNode extends CanvasNodeBase {
  type: 'group'
  label?: string
  background?: string
  backgroundStyle?: 'cover' | 'ratio' | 'repeat'
}

export type CanvasNode = CanvasTextNode | CanvasFileNode | CanvasLinkNode | CanvasGroupNode

export interface CanvasEdge {
  id: string
  fromNode: string
  fromSide?: CanvasSide
  fromEnd?: CanvasArrowEnd
  toNode: string
  toSide?: CanvasSide
  toEnd?: CanvasArrowEnd
  color?: string
  label?: string
  'x-superboard'?: Record<string, unknown>
}

export interface CanvasMeta {
  title: string
  slug: string
  summary?: string
  order?: number
  draft?: boolean
  aliases?: string[]
  updatedAt?: string
}

export interface CanvasFrame {
  id: string
  order: number
  name?: string
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasDirector {
  frames: CanvasFrame[]
}

export type SuperBoardNodeKind =
  | 'text'
  | 'markdown'
  | 'pele'
  | 'media'
  | 'shape'
  | 'drawing'
  | 'group'
  | 'frame'

export type SuperBoardShapeKind = 'rect' | 'ellipse' | 'diamond' | 'line'
export type SuperBoardMediaKind = 'image' | 'video' | 'iframe'

export interface SuperBoardStyle {
  backgroundColor?: string
  backgroundOpacity?: number
  borderColor?: string
  borderOpacity?: number
  borderWidth?: number | string
  borderStyle?: string
  color?: string
  opacity?: number
  cornerRadius?: number
  fontFamily?: string
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDash?: number[]
}

export interface SuperBoardMedia {
  kind: SuperBoardMediaKind
  url: string
  cropX?: number
  cropY?: number
  cropW?: number
  cropH?: number
  cropCx?: number
  cropCy?: number
  cropRadius?: number
  cropCorner?: number
}

export interface SuperBoardStroke {
  id: string
  color: string
  size: number
  thinning?: number
  smoothing?: number
  streamline?: number
  easing?: number
  simulatePressure?: boolean
  start?: number
  end?: number
  points: Array<[number, number, number?]>
}

export interface SuperBoardNodeExtension {
  kind: SuperBoardNodeKind
  style?: SuperBoardStyle
  shape?: SuperBoardShapeKind
  media?: SuperBoardMedia
  strokes?: SuperBoardStroke[]
  groupId?: string
  diagram?: string
  [key: string]: unknown
}

export interface SuperBoardRootExtension {
  version: 1
  meta: CanvasMeta
  director?: CanvasDirector
}

export interface CanvasDocument {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  'x-superboard'?: SuperBoardRootExtension
}
