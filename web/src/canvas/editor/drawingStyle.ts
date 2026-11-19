import type { CanvasNode } from '../model'

export interface DrawingPatch {
  size?: number
  color?: string
  opacity?: number
  thinning?: number
  smoothing?: number
  streamline?: number
  simulatePressure?: boolean
  start?: number
  end?: number
}

export function patchDrawingNode(node: CanvasNode, patch: DrawingPatch): CanvasNode {
  const extension = node['x-superboard'] ?? { kind: 'drawing' as const }
  const style = { ...extension.style }
  const { size, color, opacity, ...strokePatch } = patch
  if (size !== undefined) style.borderWidth = size
  if (color !== undefined) style.borderColor = color
  if (opacity !== undefined) style.opacity = opacity
  return {
    ...node,
    'x-superboard': {
      ...extension,
      style,
      strokes: (extension.strokes ?? []).map((stroke) => ({
        ...stroke,
        ...(size !== undefined ? { size } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(strokePatch.thinning !== undefined
          ? { thinning: strokePatch.thinning }
          : {}),
        ...(strokePatch.smoothing !== undefined
          ? { smoothing: strokePatch.smoothing }
          : {}),
        ...(strokePatch.streamline !== undefined
          ? { streamline: strokePatch.streamline }
          : {}),
        ...(strokePatch.simulatePressure !== undefined
          ? { simulatePressure: strokePatch.simulatePressure }
          : {}),
        ...(strokePatch.start !== undefined
          ? { start: strokePatch.start || undefined }
          : {}),
        ...(strokePatch.end !== undefined
          ? { end: strokePatch.end || undefined }
          : {}),
      })),
    },
  }
}
