import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { CanvasDocument, CanvasFrame } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

interface UseDirectorSessionOptions {
  canvas: CanvasDocument | null
  viewerRef: RefObject<CanvasViewerHandle | null>
  markDirty: () => void
}

export function useDirectorSession({
  canvas,
  viewerRef,
  markDirty,
}: UseDirectorSessionOptions) {
  const [directorMode, setDirectorMode] = useState(false)
  const [presentation, setPresentation] = useState(false)
  const [presentationMenu, setPresentationMenu] = useState<{
    x: number
    y: number
  } | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [frameControllerOpen, setFrameControllerOpen] = useState(false)
  const [directorTick, setDirectorTick] = useState(0)

  const directorFrames = useMemo(() => {
    const frames = canvas?.['x-superboard']?.director?.frames ?? []
    return [...frames].sort((a, b) => a.order - b.order)
  }, [canvas, directorTick])

  useEffect(() => {
    const viewer = viewerRef.current?.viewer
    viewer?.setDirectorVisible?.(directorMode && !presentation)
    if (!directorMode) viewer?.restoreDirectorCamera?.()
  }, [directorMode, presentation, canvas, viewerRef])

  function resetDirectorSession() {
    setDirectorMode(false)
    setPresentation(false)
    setPresentationMenu(null)
    setSelectedFrameId(null)
    setFrameControllerOpen(false)
  }

  function updateDirectorFrames(frames: CanvasFrame[]) {
    if (!canvas) return
    const root = canvas['x-superboard']
    if (!root) return
    root.director = { ...(root.director ?? { frames: [] }), frames }
    markDirty()
    setDirectorTick((value) => value + 1)
    viewerRef.current?.viewer?.refresh?.()
  }

  const savedCamera = useRef<{
    offsetX: number
    offsetY: number
    scale: number
  } | null>(null)

  function restoreCamera() {
    const viewer = viewerRef.current?.viewer
    if (savedCamera.current) {
      viewer?.setDirectorCamera?.(savedCamera.current)
      return
    }
    viewer?.restoreDirectorCamera?.()
  }

  function startPresentation(startIndex = 0) {
    if (directorFrames.length === 0) return
    const index = Math.max(0, Math.min(startIndex, directorFrames.length - 1))
    // Take the snapshot here as well: entering the mode and starting playback
    // can happen in the same tick.
    savedCamera.current =
      viewerRef.current?.viewer?.getDirectorCamera?.() ?? savedCamera.current
    setPresentation(true)
    setPresentationMenu(null)
    setFrameIndex(index)
    // Jump straight to the first frame: easing from an unrelated camera makes
    // the opening look like a swing rather than a cut.
    void viewerRef.current?.viewer?.playDirectorFrame?.(directorFrames[index], false)
  }

  function advancePresentation() {
    if (!presentation) return
    const next = frameIndex + 1
    if (next >= directorFrames.length) {
      setPresentation(false)
      restoreCamera()
      if (directorMode) viewerRef.current?.viewer?.setDirectorVisible?.(true)
      return
    }
    setFrameIndex(next)
    void viewerRef.current?.viewer?.playDirectorFrame?.(directorFrames[next], true)
  }

  function exitPresentation() {
    setPresentation(false)
    setPresentationMenu(null)
    restoreCamera()
    if (directorMode) viewerRef.current?.viewer?.setDirectorVisible?.(true)
  }

  function toggleDirector() {
    if (directorMode) {
      setDirectorMode(false)
      setPresentation(false)
      setPresentationMenu(null)
      setSelectedFrameId(null)
      setFrameControllerOpen(false)
      viewerRef.current?.viewer?.setDirectorVisible?.(false)
      restoreCamera()
      savedCamera.current = null
      return
    }
    setDirectorMode(true)
    // Snapshot the editing camera when director mode opens, so playback always
    // returns here instead of to whatever frame was last previewed.
    savedCamera.current =
      viewerRef.current?.viewer?.getDirectorCamera?.() ?? null
    requestAnimationFrame(() => {
      if (!savedCamera.current) {
        savedCamera.current =
          viewerRef.current?.viewer?.getDirectorCamera?.() ?? null
      }
      viewerRef.current?.viewer?.captureDirectorCamera?.()
    })
  }

  return {
    directorMode,
    presentation,
    presentationMenu,
    selectedFrameId,
    frameControllerOpen,
    directorFrames,
    setPresentationMenu,
    setSelectedFrameId,
    setFrameControllerOpen,
    updateDirectorFrames,
    startPresentation,
    advancePresentation,
    exitPresentation,
    toggleDirector,
    resetDirectorSession,
  }
}
