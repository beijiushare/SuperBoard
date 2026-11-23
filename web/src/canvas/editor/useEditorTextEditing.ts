import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { CanvasDocument } from '../model'
import { useMarkdownEditingSession } from './useMarkdownEditingSession'

interface UseEditorTextEditingOptions {
  canvas: CanvasDocument | null
  canvasRef: RefObject<CanvasDocument | null>
  setCanvas: Dispatch<SetStateAction<CanvasDocument | null>>
  markDirty: () => void
  recordHistory: (mergeKey?: string) => void
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setSelectedEdgeId: (id: string | null) => void
}

/** In-block text focus helpers and the floating Markdown editor session. */
export function useEditorTextEditing({
  canvas,
  canvasRef,
  setCanvas,
  markDirty,
  recordHistory,
  setSelectedIds,
  setSelectedEdgeId,
}: UseEditorTextEditingOptions) {
  function closeTextEditing() {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
  }

  const markdown = useMarkdownEditingSession({
    canvas,
    canvasRef,
    setCanvas,
    markDirty,
    recordHistory,
    setSelectedIds,
    setSelectedEdgeId,
    closeTextEditing,
  })

  return { ...markdown, closeTextEditing }
}
