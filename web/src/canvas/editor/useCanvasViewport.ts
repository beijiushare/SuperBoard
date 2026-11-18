import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { BoardScope } from '../../shared/board/types'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  readStoredViewport,
  readViewport,
  writeStoredViewport,
  writeViewport,
  type ViewerInternals,
  type Viewport,
} from './appUtils'

interface UseCanvasViewportOptions {
  canvas: CanvasDocument | null
  selectedSlug: string
  scope: BoardScope
  viewerRef: RefObject<CanvasViewerHandle | null>
  setStylePanelOpen: Dispatch<SetStateAction<boolean>>
  setMenuPanelOpen: Dispatch<SetStateAction<boolean>>
}

export function useCanvasViewport({
  canvas,
  selectedSlug,
  scope,
  viewerRef,
  setStylePanelOpen,
  setMenuPanelOpen,
}: UseCanvasViewportOptions) {
  const pendingViewportRef = useRef<Viewport | null>(null)
  const viewportSaveTimerRef = useRef<number | null>(null)

  const applyCanvasUiSettings = useCallback(
    (next: CanvasDocument, slug: string, targetScope: BoardScope) => {
      const settings = next['x-superboard']?.settings
      setStylePanelOpen(settings?.stylePanelOpen ?? true)
      setMenuPanelOpen(settings?.toolPaletteOpen ?? true)
      pendingViewportRef.current =
        readStoredViewport(slug, targetScope) ?? settings?.viewport ?? null
    },
    [setMenuPanelOpen, setStylePanelOpen],
  )

  const captureViewport = useCallback(() => {
    pendingViewportRef.current = readViewport(viewerRef.current)
  }, [viewerRef])

  useEffect(() => {
    const viewport = pendingViewportRef.current
    if (!viewport) return
    pendingViewportRef.current = null
    writeViewport(viewerRef.current, viewport)
    if (selectedSlug) {
      writeStoredViewport(selectedSlug, scope, viewport)
    }
  }, [canvas, scope, selectedSlug, viewerRef])

  useEffect(() => {
    if (!selectedSlug) return
    const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return
    let controller: {
      onRefresh: { subscribe: (callback: () => void) => () => void }
    }
    try {
      controller = viewer.container.get(internal.Controller as never) as {
        onRefresh: { subscribe: (callback: () => void) => () => void }
      }
    } catch {
      return
    }
    let latestViewport: Viewport | null = null
    const saveViewport = () => {
      latestViewport = readViewport(viewerRef.current)
      if (viewportSaveTimerRef.current) {
        window.clearTimeout(viewportSaveTimerRef.current)
      }
      viewportSaveTimerRef.current = window.setTimeout(() => {
        viewportSaveTimerRef.current = null
        if (latestViewport) {
          writeStoredViewport(selectedSlug, scope, latestViewport)
        }
      }, 500)
    }
    const unsubscribe = controller.onRefresh.subscribe(saveViewport)
    return () => {
      unsubscribe()
      if (viewportSaveTimerRef.current) {
        window.clearTimeout(viewportSaveTimerRef.current)
        viewportSaveTimerRef.current = null
      }
      if (latestViewport) {
        writeStoredViewport(selectedSlug, scope, latestViewport)
      }
    }
  }, [scope, selectedSlug, viewerRef])

  return { applyCanvasUiSettings, captureViewport }
}
