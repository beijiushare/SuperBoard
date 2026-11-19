import type { RefObject } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  type CanvasMenuState,
  type DataManagerLike,
  type ViewerInternals,
} from './appUtils'
import { distanceToEdge } from './edges'
import { isLocked, nodeMapOf, selectableAncestor } from './hierarchy'
import type { EditorTool } from './tools'

interface UseCanvasMenuOptions {
  canvas: CanvasDocument | null
  tool: EditorTool
  directorMode: boolean
  selectedIds: string[]
  focusedGroupId: string | null
  viewerRef: RefObject<CanvasViewerHandle | null>
  rightDragRef: RefObject<{ x: number; y: number } | null>
  setSelectedIds: (ids: string[]) => void
  setSelectedEdgeId: (id: string | null) => void
  setCanvasMenu: (menu: CanvasMenuState | null) => void
}

const BLOCK_SELECTOR =
  'button, input, textarea, select, .sb-style-panel, .sb-color-popover, .sb-color-trigger, .sb-modal-backdrop, .canvas-tool-palette, .canvas-tool-flyout, .sb-director-overlay, .sb-frame-controller, .JCV-controls, .JCV-minimap-container'

const QUICK_SELECTOR = `${BLOCK_SELECTOR}, .sb-editor-tool-surface, .sb-editor-text-input, .sb-editor-selection, .sb-editor-hitbox, .sb-block-actions, .JCV-overlay-container`

export function useCanvasMenu({
  canvas,
  tool,
  directorMode,
  selectedIds,
  focusedGroupId,
  viewerRef,
  rightDragRef,
  setSelectedIds,
  setSelectedEdgeId,
  setCanvasMenu,
}: UseCanvasMenuOptions) {
  function nodeAtWorldPoint(x: number, y: number) {
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return null
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
      const map = nodeMapOf(nodes)
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const root = selectableAncestor(nodes[index], map, focusedGroupId)
        if (isLocked(root, map) && !selectedIds.includes(root.id)) continue
        if (
          x >= root.x &&
          x <= root.x + root.width &&
          y >= root.y &&
          y <= root.y + root.height
        ) {
          return root
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  function openCanvasMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (rightDragRef.current) {
      const distance = Math.hypot(
        event.clientX - rightDragRef.current.x,
        event.clientY - rightDragRef.current.y,
      )
      rightDragRef.current = null
      if (distance > 4) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }
    if (!canvas || directorMode) return
    const target = event.target as HTMLElement
    if (target.closest(BLOCK_SELECTOR)) return
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const bounds = event.currentTarget.getBoundingClientRect()
      const worldX = (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale
      const worldY = (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale
      event.preventDefault()
      if (
        target.closest('.sb-editor-multi-selection') &&
        selectedIds.length > 1
      ) {
        const primary = canvas.nodes.find(
          (node) => node.id === selectedIds[0],
        )
        if (primary) {
          setCanvasMenu({
            x: event.clientX,
            y: event.clientY,
            worldX,
            worldY,
            nodeId: primary.id,
          })
          return
        }
      }
      const hit = nodeAtWorldPoint(worldX, worldY)
      let edgeId: string | null = null
      if (!hit) {
        const map = nodeMapOf(canvas.nodes)
        const tolerance = 10 / dm.data.scale
        for (const edge of canvas.edges) {
          if (distanceToEdge(edge, map, worldX, worldY) <= tolerance) {
            edgeId = edge.id
            break
          }
        }
      }
      if (hit) {
        if (!selectedIds.includes(hit.id)) setSelectedIds([hit.id])
        setSelectedEdgeId(null)
      } else if (edgeId) {
        setSelectedIds([])
        setSelectedEdgeId(edgeId)
      }
      setCanvasMenu({
        x: event.clientX,
        y: event.clientY,
        worldX,
        worldY,
        nodeId: hit?.id ?? null,
        edgeId,
      })
    } catch {
      // ignore
    }
  }

  function openQuickMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!canvas || directorMode || tool !== 'select') return
    const target = event.target as HTMLElement
    if (target.closest(QUICK_SELECTOR)) return
    try {
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) return
      const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
      const bounds = event.currentTarget.getBoundingClientRect()
      const worldX = (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale
      const worldY = (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale
      if (nodeAtWorldPoint(worldX, worldY)) return
      event.preventDefault()
      setSelectedIds([])
      setSelectedEdgeId(null)
      setCanvasMenu({
        x: event.clientX,
        y: event.clientY,
        worldX,
        worldY,
        nodeId: null,
        quick: true,
      })
    } catch {
      // ignore
    }
  }

  return { nodeAtWorldPoint, openCanvasMenu, openQuickMenu }
}
