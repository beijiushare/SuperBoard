import { useEffect, type MutableRefObject, type RefObject } from 'react'
import type { CanvasNode } from '../model'
import { isInsideGroup, isLocked, nodeMapOf, selectableAncestor } from './hierarchy'
import {
  intersects,
  isAdditiveSelection,
  screenRect,
  type Marquee,
} from './overlayGeometry'
import { isCanvasChromeTarget } from './overlaySelectors'

type DataManager = {
  data: {
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: CanvasNode }>
  }
}

interface UseMarqueeSelectionOptions {
  overlayRef: RefObject<HTMLDivElement | null>
  dmRef: MutableRefObject<DataManager | null>
  interactive: boolean
  activeEditingId: string | null
  focusedGroupId: string | null
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onSelectEdge?: (id: string | null) => void
  setMarquee: (marquee: Marquee | null) => void
  marqueeStartRef: MutableRefObject<{ x: number; y: number } | null>
  marqueeAdditiveRef: MutableRefObject<boolean>
  marqueeMovedRef: MutableRefObject<boolean>
  suppressClickRef: MutableRefObject<boolean>
}

export function useMarqueeSelection({
  overlayRef,
  dmRef,
  interactive,
  activeEditingId,
  focusedGroupId,
  selectedIds,
  onSelect,
  onSelectEdge,
  setMarquee,
  marqueeStartRef,
  marqueeAdditiveRef,
  marqueeMovedRef,
  suppressClickRef,
}: UseMarqueeSelectionOptions) {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!interactive || activeEditingId) return
      if (event.button !== 0) return
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm) return
      const target = event.target as HTMLElement | null
      if (
        isCanvasChromeTarget(event.target) ||
        target?.closest(
          '.sb-editor-selection, .sb-editor-hitbox, .sb-editor-edge-hit, .sb-editor-edge-endpoint, .sb-block-actions, .sb-md-editor, .JCV-overlay-container, .sb-frame-controller, button, a, input, textarea, [contenteditable="true"]',
        )
      ) {
        return
      }
      const bounds = overlay.getBoundingClientRect()
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      marqueeAdditiveRef.current = isAdditiveSelection(event)
      marqueeMovedRef.current = false
      marqueeStartRef.current = { x: event.clientX, y: event.clientY }
      setMarquee({
        left: event.clientX - bounds.left,
        top: event.clientY - bounds.top,
        width: 0,
        height: 0,
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!interactive) return
      const start = marqueeStartRef.current
      const overlay = overlayRef.current
      if (!start || !overlay) return
      const bounds = overlay.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const width = Math.abs(x - (start.x - bounds.left))
      const height = Math.abs(y - (start.y - bounds.top))
      if (width > 2 || height > 2) marqueeMovedRef.current = true
      setMarquee({
        left: Math.min(start.x - bounds.left, x),
        top: Math.min(start.y - bounds.top, y),
        width,
        height,
      })
    }

    const onPointerUp = (event: PointerEvent) => {
      const start = marqueeStartRef.current
      if (!interactive) {
        marqueeStartRef.current = null
        setMarquee(null)
        return
      }
      const dm = dmRef.current
      const overlay = overlayRef.current
      if (!start || !dm || !overlay) return
      marqueeStartRef.current = null
      const bounds = overlay.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const box = {
        left: Math.min(start.x - bounds.left, x),
        top: Math.min(start.y - bounds.top, y),
        width: Math.abs(x - (start.x - bounds.left)),
        height: Math.abs(y - (start.y - bounds.top)),
      }
      onSelectEdge?.(null)
      const { offsetX, offsetY, scale } = dm.data
      const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
      const map = nodeMapOf(nodes)
      const ids = new Set<string>()
      for (const node of nodes) {
        if (isLocked(node, map)) continue
        if (focusedGroupId && !isInsideGroup(node, focusedGroupId, map)) continue
        if (!intersects(box, screenRect(node, offsetX, offsetY, scale))) continue
        ids.add(selectableAncestor(node, map, focusedGroupId).id)
      }
      if (marqueeAdditiveRef.current) {
        for (const id of selectedIds) ids.add(id)
      }
      marqueeAdditiveRef.current = false
      suppressClickRef.current = marqueeMovedRef.current
      marqueeMovedRef.current = false
      onSelect([...ids])
      setMarquee(null)
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [
    onSelect,
    onSelectEdge,
    interactive,
    focusedGroupId,
    selectedIds,
    activeEditingId,
  ])
}
