import type { CanvasNode } from '../model'

export interface OverlayView {
  offsetX: number
  offsetY: number
  scale: number
}

export type OverlayDataManager = {
  data: OverlayView & {
    container: HTMLDivElement
    nodeMap: Record<string, { ref: CanvasNode }>
  }
}

export type OverlayController = {
  refresh: () => void
  onRefresh: { subscribe: (callback: () => void) => () => void }
}
