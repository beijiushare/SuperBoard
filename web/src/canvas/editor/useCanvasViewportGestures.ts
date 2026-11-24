import { useEffect, type RefObject } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import type {
  CanvasDocument,
} from '../model'
import type {
  ControllerLike,
  DataManagerLike,
  ViewerInternals,
} from './appUtils'
import { isCanvasChromeTarget } from './overlaySelectors'

interface UseCanvasViewportGesturesOptions {
  stageRef: RefObject<HTMLDivElement | null>
  viewerRef: RefObject<CanvasViewerHandle | null>
  canvas: CanvasDocument | null
}

function isScroller(element: HTMLElement) {
  if (element.scrollHeight <= element.clientHeight + 1) return false
  const overflowY = getComputedStyle(element).overflowY
  return overflowY === 'auto' || overflowY === 'scroll'
}

/**
 * The innermost scrollable box under the pointer. A tree card can contain many
 * scrollable cards, so walking up from the pointer is the only correct lookup;
 * searching the whole block would always hit the first overflowing one.
 */
function scrollableTarget(target: HTMLElement, host: HTMLElement) {
  let element: HTMLElement | null = target
  while (element) {
    if (isScroller(element)) return element
    if (element === host) break
    element = element.parentElement
  }
  // The editor overlay scrolls internally, so the scroller can also be a child.
  const candidates = [host, ...host.querySelectorAll<HTMLElement>('*')]
  return candidates.find((candidate) => candidate !== host && isScroller(candidate)) ?? null
}

/** Wheel zoom/scroll and middle/right-button pan for the canvas stage. */
export function useCanvasViewportGestures({
  stageRef,
  viewerRef,
  canvas,
}: UseCanvasViewportGesturesOptions) {
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (isCanvasChromeTarget(target)) return
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const hitbox = target.closest<HTMLElement>(
          '.sb-editor-block-hitbox[data-node-id]',
        )
        const host =
          target.closest<HTMLElement>('.sb-md-editor') ??
          target.closest<HTMLElement>('.JCV-overlay-container') ??
          (hitbox?.dataset.nodeId
            ? document.getElementById(hitbox.dataset.nodeId)
            : null)
        if (host) {
          const scroller = scrollableTarget(target, host)
          if (scroller) {
            event.preventDefault()
            event.stopPropagation()
            scroller.scrollBy({ top: event.deltaY })
            return
          }
        }
      }
      const zooming = event.ctrlKey || event.metaKey
      if (!zooming && target.closest('.sb-md-editor')) return
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      let dm: DataManagerLike
      let controller: ControllerLike
      try {
        dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
        controller = viewer.container.get(
          internal.Controller as never,
        ) as ControllerLike
      } catch {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const bounds = stage.getBoundingClientRect()
      if (zooming) {
        const clamped = Math.max(-120, Math.min(120, event.deltaY))
        const factor = 1.08 ** (-clamped / 100)
        const nextScale = Math.min(20, Math.max(0.05, dm.data.scale * factor))
        const originX = event.clientX - bounds.left
        const originY = event.clientY - bounds.top
        const worldX = (originX - dm.data.offsetX) / dm.data.scale
        const worldY = (originY - dm.data.offsetY) / dm.data.scale
        dm.data.offsetX = originX - worldX * nextScale
        dm.data.offsetY = originY - worldY * nextScale
        dm.data.scale = nextScale
      } else {
        dm.data.offsetX += event.shiftKey ? -event.deltaY : -event.deltaX
        dm.data.offsetY += event.shiftKey ? 0 : -event.deltaY
      }
      controller.refresh()
    }
    stage.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => stage.removeEventListener('wheel', onWheel, { capture: true })
  }, [canvas])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let pan: {
      startX: number
      startY: number
      offsetX: number
      offsetY: number
      dm: DataManagerLike
      controller: ControllerLike
      moved: boolean
    } | null = null
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 && event.button !== 2) return
      const target = event.target as HTMLElement | null
      if (
        isCanvasChromeTarget(target) ||
        target?.closest('.sb-canvas-context-menu')
      ) {
        return
      }
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const controller = viewer.container.get(
        internal.Controller as never,
      ) as ControllerLike
      pan = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: dm.data.offsetX,
        offsetY: dm.data.offsetY,
        dm,
        controller,
        moved: false,
      }
      if (event.button === 1) event.preventDefault()
      event.stopPropagation()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!pan) return
      const dx = event.clientX - pan.startX
      const dy = event.clientY - pan.startY
      if (!pan.moved && Math.hypot(dx, dy) < 4) return
      pan.moved = true
      event.preventDefault()
      event.stopPropagation()
      pan.dm.data.offsetX = pan.offsetX + dx
      pan.dm.data.offsetY = pan.offsetY + dy
      pan.controller.refresh()
    }
    const onPointerUp = () => {
      pan = null
    }
    stage.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerUp, true)
    return () => {
      stage.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
    }
  }, [canvas])
}
