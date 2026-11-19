import type { CanvasEdge, CanvasNode } from '../model'
import type { SuperBoardNodeExtension } from '../model'
import { blockStyleFromPreferences, getPreferences } from './preferences'
import { arrowSides, closestSide } from './toolGeometry'

export type ShapeTool = 'rect' | 'rounded-rect' | 'ellipse' | 'diamond' | 'line'

interface CreateShapeNodeOptions {
  id: string
  shape: ShapeTool
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function createShapeNode({
  id,
  shape,
  startX,
  startY,
  currentX,
  currentY,
}: CreateShapeNodeOptions): CanvasNode {
  const width = Math.abs(currentX - startX)
  const height = Math.abs(currentY - startY)
  const x = Math.min(startX, currentX)
  const y = Math.min(startY, currentY)
  const shapeKind = shape === 'rounded-rect' ? 'rect' : shape
  const extension: SuperBoardNodeExtension = {
    kind: 'shape',
    shape: shapeKind,
    ...(shape === 'rounded-rect' ? { roundedRect: true } : {}),
    style: {
      ...blockStyleFromPreferences(),
      ...(shape === 'line' ? { backgroundColor: 'transparent' } : {}),
      ...(shape === 'rounded-rect'
        ? { cornerRadius: 8 }
        : shape === 'rect'
          ? { cornerRadius: getPreferences().shapeCornerRadius }
          : {}),
    },
  }
  if (shape === 'line') {
    extension.lineFlip = {
      x: currentX < startX,
      y: currentY < startY,
    }
  }
  return {
    id,
    type: 'group',
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
    'x-superboard': extension,
  }
}

interface CreateArrowEdgeOptions {
  id: string
  from: CanvasNode
  to: CanvasNode
  currentX: number
  currentY: number
}

export function createArrowEdge({
  id,
  from,
  to,
  currentX,
  currentY,
}: CreateArrowEdgeOptions): CanvasEdge {
  const sides = arrowSides(from, to)
  return {
    id,
    fromNode: from.id,
    toNode: to.id,
    fromSide: sides.fromSide,
    toSide: closestSide(to, currentX, currentY),
    fromEnd: 'none',
    toEnd: 'arrow',
  }
}
