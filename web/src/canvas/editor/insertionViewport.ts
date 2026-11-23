import type { RefObject } from 'react'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { DataManagerLike, ViewerInternals } from './appUtils'

/** World position that centers a new block of the given size in the viewport. */
export function viewportCenter(
  viewerRef: RefObject<CanvasViewerHandle | null>,
  width: number,
  height: number,
) {
  try {
    const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
    if (viewer?.container) {
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const { offsetX, offsetY, scale } = dm.data
      const container = dm.data.container
      return {
        x: Math.round((container.clientWidth / 2 - offsetX) / scale - width / 2),
        y: Math.round((container.clientHeight / 2 - offsetY) / scale - height / 2),
      }
    }
  } catch {
    // ignore
  }
  return { x: -width / 2, y: -height / 2 }
}
