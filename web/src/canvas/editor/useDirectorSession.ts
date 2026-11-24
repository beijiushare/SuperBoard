import { useEffect, useMemo, useState, type RefObject } from 'react'
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

  function startPresentation(startIndex = 0) {
    if (directorFrames.length === 0) return
    const index = Math.max(0, Math.min(startIndex, directorFrames.length - 1))
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
      viewerRef.current?.viewer?.restoreDirectorCamera?.()
      if (directorMode) viewerRef.current?.viewer?.setDirectorVisible?.(true)
      return
    }
    setFrameIndex(next)
    void viewerRef.current?.viewer?.playDirectorFrame?.(directorFrames[next], true)
  }

  function exitPresentation() {
    setPresentation(false)
    setPresentationMenu(null)
    viewerRef.current?.viewer?.restoreDirectorCamera?.()
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
      viewerRef.current?.viewer?.restoreDirectorCamera?.()
      return
    }
    setDirectorMode(true)
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
