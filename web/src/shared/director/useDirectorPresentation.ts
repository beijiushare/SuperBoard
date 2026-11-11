import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Editor } from 'tldraw'
import type { DirectorFrame } from '../board/types'
import { cancelCameraAnimation, moveCameraToFrame } from '../shapes/directorFrames'

interface PresentationState {
  frames: DirectorFrame[]
  index: number
}

interface UseDirectorPresentationOptions {
  appRef: RefObject<HTMLElement | null>
  editorRef: RefObject<Editor | null>
  frames: DirectorFrame[]
  setDirectorMode: (value: boolean) => void
}

export function useDirectorPresentation({
  appRef,
  editorRef,
  frames,
  setDirectorMode,
}: UseDirectorPresentationOptions) {
  const [presentation, setPresentation] = useState<PresentationState | null>(null)
  const [presentationMenu, setPresentationMenu] = useState<{ x: number; y: number } | null>(null)
  const cameraBeforePresentationRef = useRef<{ x: number; y: number; z: number } | null>(null)

  const restoreCameraAfterPresentation = useCallback(() => {
    const editor = editorRef.current
    const camera = cameraBeforePresentationRef.current
    if (!editor || !camera) return
    cameraBeforePresentationRef.current = null
    window.setTimeout(() => editor.setCamera(camera, { force: true, immediate: true }), 50)
  }, [editorRef])

  const startPresentation = useCallback(
    async (startFrameId?: string) => {
      const editor = editorRef.current
      const orderedFrames = [...frames].sort((a, b) => a.order - b.order)
      if (!editor || orderedFrames.length === 0) return

      let index = 0
      if (startFrameId) {
        const found = orderedFrames.findIndex((frame) => frame.id === startFrameId)
        if (found >= 0) index = found
      }

      setDirectorMode(true)
      cameraBeforePresentationRef.current = editor.getCamera()
      setPresentationMenu(null)
      setPresentation({ frames: orderedFrames, index })

      try {
        if (!document.fullscreenElement) await appRef.current?.requestFullscreen()
      } catch {
        // Fullscreen can be denied by the browser; presentation still works in-page.
      }

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      moveCameraToFrame(editor, orderedFrames[index], false)
    },
    [appRef, editorRef, frames, setDirectorMode],
  )

  const exitPresentation = useCallback(() => {
    cancelCameraAnimation()
    setPresentation(null)
    setPresentationMenu(null)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    restoreCameraAfterPresentation()
  }, [restoreCameraAfterPresentation])

  const advancePresentation = useCallback(() => {
    if (!presentation) return
    const nextIndex = presentation.index + 1
    if (nextIndex >= presentation.frames.length) {
      exitPresentation()
      return
    }

    const editor = editorRef.current
    if (editor) moveCameraToFrame(editor, presentation.frames[nextIndex], true)
    setPresentation({ ...presentation, index: nextIndex })
  }, [editorRef, exitPresentation, presentation])

  useEffect(() => {
    if (!presentation) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      advancePresentation()
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setPresentation(null)
        setPresentationMenu(null)
        restoreCameraAfterPresentation()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [advancePresentation, presentation, restoreCameraAfterPresentation])

  useEffect(() => () => cancelCameraAnimation(), [])

  return {
    presentation,
    presentationMenu,
    setPresentationMenu,
    startPresentation,
    exitPresentation,
    advancePresentation,
  }
}
