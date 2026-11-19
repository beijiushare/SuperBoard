import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import type {
  OverlayController,
  OverlayDataManager,
  OverlayView,
} from './overlayTypes'

interface UseOverlayViewportOptions {
  viewerRef: RefObject<CanvasViewerHandle | null>
  dmRef: MutableRefObject<OverlayDataManager | null>
  controllerRef: MutableRefObject<OverlayController | null>
  worldRef: RefObject<HTMLDivElement | null>
  viewRef: MutableRefObject<OverlayView>
  pendingViewRef: MutableRefObject<OverlayView | null>
  setView: (view: OverlayView) => void
  setTick: (update: (value: number) => number) => void
}

export function useOverlayViewport({
  viewerRef,
  dmRef,
  controllerRef,
  worldRef,
  viewRef,
  pendingViewRef,
  setView,
  setTick,
}: UseOverlayViewportOptions) {
  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    let unsubscribe: (() => void) | undefined
    let frame = 0
    let commitTimer: number | undefined

    const update = () => {
      frame = 0
      const dm = dmRef.current
      if (!dm) return
      const next = {
        offsetX: dm.data.offsetX,
        offsetY: dm.data.offsetY,
        scale: dm.data.scale,
      }
      const current = viewRef.current
      if (
        next.offsetX === current.offsetX &&
        next.offsetY === current.offsetY &&
        next.scale === current.scale
      ) {
        setTick((value) => value + 1)
        return
      }
      pendingViewRef.current = next
      const factor = next.scale / current.scale
      const translateX = next.offsetX - current.offsetX * factor
      const translateY = next.offsetY - current.offsetY * factor
      if (worldRef.current) {
        worldRef.current.style.transformOrigin = '0 0'
        worldRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${factor})`
        // Keep the action bar at a stable screen size while the overlay follows the zoom transform.
        worldRef.current.style.setProperty(
          '--sb-actions-inverse',
          String(1 / factor),
        )
      }
      if (!commitTimer) {
        commitTimer = window.setTimeout(() => {
          commitTimer = undefined
          const target = pendingViewRef.current
          if (!target) return
          pendingViewRef.current = null
          viewRef.current = target
          setView(target)
        }, 120)
      }
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    const attach = () => {
      if (disposed) return
      const viewer = viewerRef.current?.viewer as
        | { container?: { get: (key: unknown) => unknown } }
        | undefined
      if (!viewer?.container) {
        timer = window.setTimeout(attach, 100)
        return
      }
      try {
        dmRef.current = viewer.container.get(
          internal.DataManager as never,
        ) as OverlayDataManager
        controllerRef.current = viewer.container.get(
          internal.Controller as never,
        ) as OverlayController
        unsubscribe = controllerRef.current.onRefresh.subscribe(schedule)
        const initial = {
          offsetX: dmRef.current.data.offsetX,
          offsetY: dmRef.current.data.offsetY,
          scale: dmRef.current.data.scale,
        }
        pendingViewRef.current = null
        viewRef.current = initial
        setView(initial)
        setTick((value) => value + 1)
      } catch {
        timer = window.setTimeout(attach, 100)
      }
    }

    attach()
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      if (frame) cancelAnimationFrame(frame)
      if (commitTimer) window.clearTimeout(commitTimer)
      unsubscribe?.()
      pendingViewRef.current = null
      dmRef.current = null
      controllerRef.current = null
    }
  }, [viewerRef, dmRef, controllerRef, worldRef, viewRef, pendingViewRef, setView, setTick])
}
