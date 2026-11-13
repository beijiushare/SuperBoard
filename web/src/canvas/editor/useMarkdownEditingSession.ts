import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type {
  CanvasDocument,
  CanvasNode,
  MarkdownTheme,
  SuperBoardNodeExtension,
} from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

interface UseMarkdownEditingSessionOptions {
  canvas: CanvasDocument | null
  canvasRef: RefObject<CanvasDocument | null>
  setCanvas: Dispatch<SetStateAction<CanvasDocument | null>>
  markDirty: () => void
  recordHistory: () => void
  viewerRef: RefObject<CanvasViewerHandle | null>
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setSelectedEdgeId: (id: string | null) => void
  closeTextEditing: () => void
  ensureExtension: (node: CanvasNode) => SuperBoardNodeExtension
}

export function useMarkdownEditingSession({
  canvas,
  canvasRef,
  setCanvas,
  markDirty,
  recordHistory,
  viewerRef,
  setSelectedIds,
  setSelectedEdgeId,
  closeTextEditing,
  ensureExtension,
}: UseMarkdownEditingSessionOptions) {
  const [markdownEditingId, setMarkdownEditingId] = useState<string | null>(null)
  const [markdownFocusId, setMarkdownFocusId] = useState<string | null>(null)
  const markdownHistoryRef = useRef(false)

  const markdownFocusNode = (() => {
    if (!canvas || !markdownFocusId) return null
    const node = canvas.nodes.find((item) => item.id === markdownFocusId)
    return node?.type === 'text' ? node : null
  })()

  function setMarkdownOverlayHidden(id: string, hidden: boolean) {
    const overlay = document.getElementById(id)
    overlay?.classList.toggle('sb-md-editing-hidden', hidden)
  }

  function openMarkdownEditor(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!node || node['x-superboard']?.kind !== 'markdown') return
    if (markdownEditingId === id) return
    if (markdownEditingId) closeMarkdownEditor()
    setMarkdownFocusId(null)
    setMarkdownOverlayHidden(id, true)
    const extension = ensureExtension(node)
    extension.markdownLocked = false
    markDirty()
    markdownHistoryRef.current = false
    setMarkdownEditingId(id)
  }

  function openMarkdownFocus(id: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!node || node['x-superboard']?.kind !== 'markdown') return
    closeTextEditing()
    if (markdownEditingId) closeMarkdownEditor()
    setSelectedIds([id])
    setSelectedEdgeId(null)
    markdownHistoryRef.current = false
    setMarkdownFocusId(id)
  }

  function closeMarkdownFocus() {
    setMarkdownFocusId(null)
  }

  function closeMarkdownEditor() {
    if (!markdownEditingId) return
    setMarkdownOverlayHidden(markdownEditingId, false)
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === markdownEditingId)
    if (node) {
      const extension = ensureExtension(node)
      extension.markdownLocked = true
      markDirty()
    }
    setMarkdownEditingId(null)
  }

  function toggleMarkdownEdit(id: string) {
    if (markdownEditingId === id) closeMarkdownEditor()
    else openMarkdownEditor(id)
  }

  function startMarkdownEditing(id: string) {
    markdownHistoryRef.current = false
    setMarkdownEditingId(id)
  }

  function handleMarkdownInput(id: string, value: string) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!node || node.type !== 'text') return
    if (!markdownHistoryRef.current) {
      recordHistory()
      markdownHistoryRef.current = true
    }
    setCanvas((current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((item) =>
              item.id === id && item.type === 'text'
                ? { ...item, text: value }
                : item,
            ),
          }
        : current,
    )
    markDirty()
  }

  function setMarkdownTheme(id: string, theme: MarkdownTheme) {
    const document = canvasRef.current
    const node = document?.nodes.find((item) => item.id === id)
    if (!document || !node || node['x-superboard']?.kind !== 'markdown') return
    recordHistory()
    const nodes = document.nodes.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        'x-superboard': {
          ...ensureExtension(item),
          markdownTheme: theme,
        },
      }
    })
    const root = document['x-superboard']
    setCanvas({
      ...document,
      nodes,
      'x-superboard': root
        ? { ...root, markdownDefaultTheme: theme }
        : root,
    })
    markDirty()
    viewerRef.current?.viewer?.refresh?.()
  }

  function resetMarkdownEditing() {
    setMarkdownEditingId(null)
    setMarkdownFocusId(null)
    markdownHistoryRef.current = false
  }

  return {
    markdownEditingId,
    markdownFocusId,
    markdownFocusNode,
    openMarkdownEditor,
    openMarkdownFocus,
    closeMarkdownEditor,
    closeMarkdownFocus,
    toggleMarkdownEdit,
    startMarkdownEditing,
    handleMarkdownInput,
    setMarkdownTheme,
    resetMarkdownEditing,
  }
}
