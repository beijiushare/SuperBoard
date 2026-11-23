import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { CanvasDocument } from '../model'
import { isInsideGroup, isLocked, nodeMapOf, selectableAncestor } from './hierarchy'
import { useSelectionActions } from './useSelectionActions'

interface UseEditorSelectionOptions {
  canvas: CanvasDocument | null
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  selectedEdgeId: string | null
  setSelectedEdgeId: (id: string | null) => void
  focusedGroupId: string | null
  setFocusedGroupId: (id: string | null) => void
  recordHistory: (mergeKey?: string) => void
  applyDocument: (next: CanvasDocument, selection?: string[]) => void
  markDirty: () => void
}

/**
 * Selection behaviour: node hit handling, shared actions and the validity
 * effects. The selection state itself stays in the caller so the workspace
 * session can reset it.
 */
export function useEditorSelection({
  canvas,
  selectedIds,
  setSelectedIds,
  selectedEdgeId,
  setSelectedEdgeId,
  focusedGroupId,
  setFocusedGroupId,
  recordHistory,
  applyDocument,
  markDirty,
}: UseEditorSelectionOptions) {
  const shiftRef = useRef(false)
  const rightDragRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      shiftRef.current = event.shiftKey
      if (event.button === 2) {
        rightDragRef.current = { x: event.clientX, y: event.clientY }
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  const handleNodeSelect = useCallback(
    (id: string) => {
      if (!canvas) return
      const map = nodeMapOf(canvas.nodes)
      const node = map.get(id)
      if (!node) return
      const target = selectableAncestor(node, map, focusedGroupId)
      if (isLocked(target, map)) return
      if (focusedGroupId && !isInsideGroup(node, focusedGroupId, map)) {
        setFocusedGroupId(null)
      }
      setSelectedIds((current) => {
        if (!shiftRef.current) return [target.id]
        return current.includes(target.id)
          ? current.filter((item) => item !== target.id)
          : [...current, target.id]
      })
    },
    [canvas, focusedGroupId],
  )

  const actions = useSelectionActions({
    canvas,
    selectedIds,
    selectedEdgeId,
    recordHistory,
    applyDocument,
    markDirty,
    setSelectedIds,
    setSelectedEdgeId,
    setFocusedGroupId,
  })

  useEffect(() => {
    if (selectedIds.length > 0) setSelectedEdgeId(null)
  }, [selectedIds])

  useEffect(() => {
    if (!focusedGroupId) return
    const group = canvas?.nodes.find((node) => node.id === focusedGroupId)
    if (!group || group['x-superboard']?.kind !== 'group') {
      setFocusedGroupId(null)
    }
  }, [canvas, focusedGroupId])

  useEffect(() => {
    if (!selectedEdgeId) return
    if (!canvas?.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null)
    }
  }, [canvas, selectedEdgeId])

  return {
    rightDragRef,
    handleNodeSelect,
    ...actions,
  }
}
