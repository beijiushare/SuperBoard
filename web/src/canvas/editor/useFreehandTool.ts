import { useRef } from 'react'
import type { CanvasDocument } from '../model'
import { createDrawingNode, drawStrokePreview, type StrokePoint } from './freehand'
import { nextFreeId } from './hierarchy'
import { getUiState } from './uiState'

interface UseFreehandToolOptions {
  canvas: CanvasDocument
  getScale: () => number
  getOffset: () => { offsetX: number; offsetY: number; scale: number } | null
  onBeforeChange: () => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
}

export function useFreehandTool({
  canvas,
  getScale,
  getOffset,
  onBeforeChange,
  onApply,
}: UseFreehandToolOptions) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const strokeRef = useRef<StrokePoint[] | null>(null)

  function redrawStrokePreview() {
    const canvasElement = previewCanvasRef.current
    const points = strokeRef.current
    if (!canvasElement || !points) return
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    drawStrokePreview(
      ctx,
      window.devicePixelRatio || 1,
      points,
      getUiState().brush,
      getScale(),
    )
  }

  function clearStrokePreview() {
    const canvasElement = previewCanvasRef.current
    const ctx = canvasElement?.getContext('2d')
    if (!canvasElement || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasElement.width / dpr, canvasElement.height / dpr)
  }

  function commitStroke() {
    const points = strokeRef.current
    strokeRef.current = null
    clearStrokePreview()
    if (!points || points.length < 2) return
    const offset = getOffset()
    if (!offset) return
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const node = createDrawingNode({
      id: nextFreeId(existing, 'draw'),
      points,
      offsetX: offset.offsetX,
      offsetY: offset.offsetY,
      scale: offset.scale,
      brush: getUiState().brush,
    })
    onBeforeChange()
    onApply({ ...canvas, nodes: [...canvas.nodes, node] }, [])
  }

  function resetStroke() {
    strokeRef.current = null
    clearStrokePreview()
  }

  return {
    previewCanvasRef,
    strokeRef,
    redrawStrokePreview,
    clearStrokePreview,
    commitStroke,
    resetStroke,
  }
}
