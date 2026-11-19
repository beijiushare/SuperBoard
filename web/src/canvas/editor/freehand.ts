import { getStroke } from 'perfect-freehand'
import type { CanvasNode } from '../model'
import type { BrushDefaults } from './uiState'

export type StrokePoint = [number, number, number]

export function strokeOutline(
  points: StrokePoint[],
  brush: BrushDefaults,
  scale: number,
) {
  return getStroke(points as number[][], {
    size: brush.size * scale,
    thinning: brush.thinning,
    smoothing: brush.smoothing,
    streamline: brush.streamline,
    simulatePressure: brush.simulatePressure,
    start: { taper: brush.start },
    end: { taper: brush.end },
  })
}

export function drawStrokePreview(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  points: StrokePoint[],
  brush: BrushDefaults,
  scale: number,
) {
  const width = ctx.canvas.width / dpr
  const height = ctx.canvas.height / dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (points.length < 2) return
  const outline = strokeOutline(points, brush, scale)
  if (outline.length < 3) return
  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (let index = 1; index < outline.length; index += 1) {
    ctx.lineTo(outline[index][0], outline[index][1])
  }
  ctx.closePath()
  ctx.globalAlpha = brush.opacity
  ctx.fillStyle = brush.color
  ctx.fill()
  ctx.globalAlpha = 1
}

interface CreateDrawingNodeOptions {
  id: string
  points: StrokePoint[]
  offsetX: number
  offsetY: number
  scale: number
  brush: BrushDefaults
}

export function createDrawingNode({
  id,
  points,
  offsetX,
  offsetY,
  scale,
  brush,
}: CreateDrawingNodeOptions): CanvasNode {
  const world = points.map(([x, y, pressure]) => [
    (x - offsetX) / scale,
    (y - offsetY) / scale,
    pressure ?? 0.5,
  ])
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of world) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const pad = brush.size / 2 + 1
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  const local = world.map(
    ([x, y, pressure]) =>
      [x - minX, y - minY, pressure] as [number, number, number],
  )
  return {
    id,
    type: 'group',
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    'x-superboard': {
      kind: 'drawing',
      style: {
        borderWidth: brush.size,
        borderColor: brush.color,
        opacity: brush.opacity,
      },
      strokes: [
        {
          id: `${id}-1`,
          color: brush.color,
          size: brush.size,
          thinning: brush.thinning,
          smoothing: brush.smoothing,
          streamline: brush.streamline,
          simulatePressure: brush.simulatePressure,
          start: brush.start || undefined,
          end: brush.end || undefined,
          points: local,
        },
      ],
    },
  }
}
