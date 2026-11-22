import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { CanvasDocument } from '../model'

interface UseMarkdownEditingSessionOptions {
  canvas: CanvasDocument | null
  canvasRef: RefObject<CanvasDocument | null>
  setCanvas: Dispatch<SetStateAction<CanvasDocument | null>>
  markDirty: () => void
  recordHistory: () => void
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setSelectedEdgeId: (id: string | null) => void
  closeTextEditing: () => void
}

export function useMarkdownEditingSession({
  canvas,
  canvasRef,
  setCanvas,
  markDirty,
  recordHistory,
  setSelectedIds,
  setSelectedEdgeId,
  closeTextEditing,
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
    const id = markdownEditingId
    setMarkdownOverlayHidden(id, false)
    // Publish a new node object: the overlay only re-renders when the node
    // changes, and the block has to leave the "editing" placeholder state.
    setCanvas((current) => {
      if (!current) return current
      let changed = false
      const nodes = current.nodes.map((item) => {
        if (item.id !== id) return item
        const extension = item['x-superboard']
        if (!extension || extension.markdownLocked === true) return item
        changed = true
        return {
          ...item,
          'x-superboard': { ...extension, markdownLocked: true },
        }
      })
      return changed ? { ...current, nodes } : current
    })
    markDirty()
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
    resetMarkdownEditing,
  }
}
