import type { RefObject } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasEdge, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

export type ToolDataManager = {
  data: {
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: CanvasNode }>
    edgeMap: Record<string, { ref: CanvasEdge }>
  }
}

export type ToolController = {
  refresh: () => void
}

export interface ToolView {
  offsetX: number
  offsetY: number
  scale: number
}

interface ViewerInternals {
  container?: { get: (key: unknown) => unknown }
}

interface UseToolViewportOptions {
  viewerRef: RefObject<CanvasViewerHandle | null>
  surfaceRef: RefObject<HTMLDivElement | null>
}

export function useToolViewport({
  viewerRef,
  surfaceRef,
}: UseToolViewportOptions) {
  function internals() {
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return null
      const dm = viewer.container.get(internal.DataManager as never) as ToolDataManager
      const controller = viewer.container.get(internal.Controller as never) as ToolController
      return { dm, controller }
    } catch {
      return null
    }
  }

  function getView(): ToolView | null {
    const data = internals()
    if (!data) return null
    return {
      offsetX: data.dm.data.offsetX,
      offsetY: data.dm.data.offsetY,
      scale: data.dm.data.scale,
    }
  }

  function surfacePoint(event: { clientX: number; clientY: number }) {
    const surface = surfaceRef.current
    const data = internals()
    if (!surface || !data) return null
    const bounds = surface.getBoundingClientRect()
    const screenX = event.clientX - bounds.left
    const screenY = event.clientY - bounds.top
    const { offsetX, offsetY, scale } = data.dm.data
    return {
      screenX,
      screenY,
      worldX: (screenX - offsetX) / scale,
      worldY: (screenY - offsetY) / scale,
    }
  }

  return { internals, getView, surfacePoint }
}
