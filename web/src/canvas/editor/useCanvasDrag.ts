import { useRef, type MutableRefObject, type RefObject } from 'react'
import type { CanvasNode } from '../model'
import {
  blockKind,
  contentScale,
  isActionableNode,
  isRatioLocked,
} from './blocks'
import {
  collectDescendants,
  isLocked,
  nodeMapOf,
  selectableAncestor,
} from './hierarchy'
import type { OverlayController, OverlayDataManager } from './overlayTypes'
import { isAdditiveSelection } from './overlayGeometry'

interface DragNode {
  node: CanvasNode
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

interface DragState {
  kind: 'move' | 'resize' | 'rotate'
  nodes: DragNode[]
  primary: CanvasNode
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  scale: number
  corner?: string
  startAngle?: number
  startRotation?: number
  changed?: boolean
  centerX?: number
  centerY?: number
  ratioLocked?: boolean
  startContentScale?: number
  rotationNodes?: Array<{
    node: CanvasNode
    startRotation: number
    offsetX: number
    offsetY: number
  }>
}

const GUIDE_DISTANCE_THRESHOLD_PX = 3

interface PointerLike {
  button: number
  clientX: number
  clientY: number
  altKey?: boolean
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  preventDefault?: () => void
  stopPropagation: () => void
  pointerId: number
  currentTarget: { setPointerCapture: (id: number) => void }
}

interface UseCanvasDragOptions {
  overlayRef: RefObject<HTMLDivElement | null>
  dmRef: MutableRefObject<OverlayDataManager | null>
  controllerRef: MutableRefObject<OverlayController | null>
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  focusedGroupId: string | null
  guidesEnabled: boolean
  onBeforeChange?: () => void
  onChange?: () => void
  setGuides: (guides: { x?: number; y?: number } | null) => void
  setActionsVisible: (visible: boolean) => void
  setTick: (update: (value: number) => number) => void
}

function ensureExtension(node: CanvasNode) {
  if (!node['x-superboard']) {
    node['x-superboard'] = {
      kind: node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media',
    }
  }
  return node['x-superboard']!
}

function cornerRatioScale(
  width: number,
  height: number,
  startWidth: number,
  startHeight: number,
) {
  const startRatio = startWidth / startHeight
  const cornerRatio = width / height
  return cornerRatio > startRatio ? width / startWidth : height / startHeight
}

export function useCanvasDrag({
  overlayRef,
  dmRef,
  controllerRef,
  selectedIds,
  onSelect,
  focusedGroupId,
  guidesEnabled,
  onBeforeChange,
  onChange,
  setGuides,
  setActionsVisible,
  setTick,
}: UseCanvasDragOptions) {
  const dragRef = useRef<DragState | null>(null)

  function beginMove(event: PointerLike, node: CanvasNode) {
    if (event.button !== 0) return
    event.preventDefault?.()
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    const target = selectableAncestor(node, map, focusedGroupId)
    if (isLocked(target, map)) return

    if (isAdditiveSelection(event)) {
      onSelect(
        selectedIds.includes(target.id)
          ? selectedIds.filter((id) => id !== target.id)
          : [...selectedIds, target.id],
      )
      return
    }

    const rootIds = selectedIds.includes(target.id) ? selectedIds : [target.id]
    if (!selectedIds.includes(target.id)) onSelect(rootIds)
    const seen = new Set<string>()
    const dragNodes: DragNode[] = []
    for (const id of rootIds) {
      const root = map.get(id)
      if (!root) continue
      for (const item of [root, ...collectDescendants(root, allNodes)]) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        dragNodes.push({
          node: item,
          startX: item.x,
          startY: item.y,
          startWidth: item.width,
          startHeight: item.height,
        })
      }
    }
    if (dragNodes.length === 0) return
    dragRef.current = {
      kind: 'move',
      nodes: dragNodes,
      primary: target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x,
      startY: target.y,
      startWidth: target.width,
      startHeight: target.height,
      scale: dm.data.scale,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: PointerLike, node: CanvasNode, corner: string) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    const target = selectableAncestor(node, map, focusedGroupId)
    if (isLocked(target, map)) return
    onSelect([target.id])
    const dragNodes: DragNode[] = [target, ...collectDescendants(target, allNodes)].map(
      (item) => ({
        node: item,
        startX: item.x,
        startY: item.y,
        startWidth: item.width,
        startHeight: item.height,
      }),
    )
    dragRef.current = {
      kind: 'resize',
      nodes: dragNodes,
      primary: target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x,
      startY: target.y,
      startWidth: target.width,
      startHeight: target.height,
      scale: dm.data.scale,
      corner,
      ratioLocked: isActionableNode(target) && isRatioLocked(target),
      startContentScale: contentScale(target),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginMultiMove(event: PointerLike, selection: CanvasNode[]) {
    if (event.button !== 0) return
    if (selection.length < 2) return
    event.preventDefault?.()
    event.stopPropagation()
    const dm = dmRef.current
    if (!dm) return
    const allNodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
    const map = nodeMapOf(allNodes)
    if (selection.some((node) => isLocked(node, map))) return
    const seen = new Set<string>()
    const dragNodes: DragNode[] = []
    for (const root of selection) {
      for (const item of [root, ...collectDescendants(root, allNodes)]) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        dragNodes.push({
          node: item,
          startX: item.x,
          startY: item.y,
          startWidth: item.width,
          startHeight: item.height,
        })
      }
    }
    const primary = selection[0]
    dragRef.current = {
      kind: 'move',
      nodes: dragNodes,
      primary,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: primary.x,
      startY: primary.y,
      startWidth: primary.width,
      startHeight: primary.height,
      scale: dm.data.scale,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginMultiRotate(event: PointerLike, selection: CanvasNode[]) {
    if (event.button !== 0 || selection.length < 2) return
    event.stopPropagation()
    const dm = dmRef.current
    const overlay = overlayRef.current
    if (!dm || !overlay) return
    const map = nodeMapOf(selection)
    if (
      selection.some(
        (node) =>
          node['x-superboard']?.kind === 'group' || isLocked(node, map),
      )
    ) {
      return
    }
    const minX = Math.min(...selection.map((node) => node.x))
    const minY = Math.min(...selection.map((node) => node.y))
    const maxX = Math.max(...selection.map((node) => node.x + node.width))
    const maxY = Math.max(...selection.map((node) => node.y + node.height))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const bounds = overlay.getBoundingClientRect()
    const { offsetX, offsetY, scale } = dm.data
    const centerScreenX = bounds.left + offsetX + centerX * scale
    const centerScreenY = bounds.top + offsetY + centerY * scale
    dragRef.current = {
      kind: 'rotate',
      nodes: selection.map((node) => ({
        node,
        startX: node.x,
        startY: node.y,
        startWidth: node.width,
        startHeight: node.height,
      })),
      primary: selection[0],
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: centerX,
      startY: centerY,
      startWidth: 0,
      startHeight: 0,
      scale,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerScreenY, event.clientX - centerScreenX),
      rotationNodes: selection.map((node) => ({
        node,
        startRotation: node['x-superboard']?.rotation ?? 0,
        offsetX: node.x + node.width / 2 - centerX,
        offsetY: node.y + node.height / 2 - centerY,
      })),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginRotate(event: PointerLike, node: CanvasNode) {
    if (event.button !== 0) return
    event.stopPropagation()
    const dm = dmRef.current
    const overlay = overlayRef.current
    if (!dm || !overlay) return
    const map = nodeMapOf(Object.values(dm.data.nodeMap).map((item) => item.ref))
    const target = selectableAncestor(node, map, focusedGroupId)
    if (target['x-superboard']?.kind === 'group') return
    if (isLocked(target, map)) return
    ensureExtension(target)
    onSelect([target.id])
    const bounds = overlay.getBoundingClientRect()
    const { offsetX, offsetY, scale } = dm.data
    const centerX = bounds.left + offsetX + (target.x + target.width / 2) * scale
    const centerY = bounds.top + offsetY + (target.y + target.height / 2) * scale
    dragRef.current = {
      kind: 'rotate',
      nodes: [
        {
          node: target,
          startX: target.x,
          startY: target.y,
          startWidth: target.width,
          startHeight: target.height,
        },
      ],
      primary: target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x,
      startY: target.y,
      startWidth: target.width,
      startHeight: target.height,
      scale,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startRotation: target['x-superboard']?.rotation ?? 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function applyContentScale(drag: DragState, ratioScale: number) {
    if (!drag.ratioLocked || drag.nodes.length !== 1) return
    const kind = blockKind(drag.primary)
    if (!kind) return
    const extension = ensureExtension(drag.primary)
    extension.contentScale =
      Math.round((drag.startContentScale ?? 1) * ratioScale * 1000) / 1000
  }

  function moveDrag(event: PointerLike) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startClientX) / drag.scale
    const dy = (event.clientY - drag.startClientY) / drag.scale
    if (!drag.changed && (dx !== 0 || dy !== 0)) {
      drag.changed = true
      setActionsVisible(false)
      onBeforeChange?.()
    }
    if (drag.kind === 'move') {
      const dmNow = dmRef.current
      const dragDistance = Math.hypot(
        event.clientX - drag.startClientX,
        event.clientY - drag.startClientY,
      )
      const showGuides =
        guidesEnabled && dragDistance >= GUIDE_DISTANCE_THRESHOLD_PX
      let moveX = dx
      let moveY = dy
      let nextGuides: { x?: number; y?: number } | null = null
      if (dmNow && !event.altKey && showGuides) {
        const dragged = new Set(drag.nodes.map((item) => item.node.id))
        let left = Infinity
        let top = Infinity
        let right = -Infinity
        let bottom = -Infinity
        for (const item of drag.nodes) {
          left = Math.min(left, item.startX)
          top = Math.min(top, item.startY)
          right = Math.max(right, item.startX + item.startWidth)
          bottom = Math.max(bottom, item.startY + item.startHeight)
        }
        const leftEdge = left + dx
        const rightEdge = right + dx
        const topEdge = top + dy
        const bottomEdge = bottom + dy
        const xAnchors = [leftEdge, (leftEdge + rightEdge) / 2, rightEdge]
        const yAnchors = [topEdge, (topEdge + bottomEdge) / 2, bottomEdge]
        const threshold = 8 / drag.scale
        let bestX = { diff: threshold + 1, target: 0, anchor: 0 }
        let bestY = { diff: threshold + 1, target: 0, anchor: 0 }
        for (const item of Object.values(dmNow.data.nodeMap)) {
          const node = item.ref
          if (dragged.has(node.id)) continue
          const xTargets = [node.x, node.x + node.width / 2, node.x + node.width]
          const yTargets = [node.y, node.y + node.height / 2, node.y + node.height]
          for (const target of xTargets) {
            for (const anchor of xAnchors) {
              const diff = Math.abs(target - anchor)
              if (diff < bestX.diff) bestX = { diff, target, anchor }
            }
          }
          for (const target of yTargets) {
            for (const anchor of yAnchors) {
              const diff = Math.abs(target - anchor)
              if (diff < bestY.diff) bestY = { diff, target, anchor }
            }
          }
        }
        if (bestX.diff <= threshold) {
          moveX += bestX.target - bestX.anchor
          nextGuides = { ...(nextGuides ?? {}), x: bestX.target }
        }
        if (bestY.diff <= threshold) {
          moveY += bestY.target - bestY.anchor
          nextGuides = { ...(nextGuides ?? {}), y: bestY.target }
        }
      }
      setGuides(showGuides ? nextGuides : null)
      for (const item of drag.nodes) {
        item.node.x = item.startX + moveX
        item.node.y = item.startY + moveY
      }
    } else if (drag.kind === 'rotate' && drag.rotationNodes) {
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm || drag.centerX === undefined || drag.centerY === undefined) {
        return
      }
      const bounds = overlay.getBoundingClientRect()
      const { offsetX, offsetY, scale } = dm.data
      const centerScreenX = bounds.left + offsetX + drag.centerX * scale
      const centerScreenY = bounds.top + offsetY + drag.centerY * scale
      const angle = Math.atan2(
        event.clientY - centerScreenY,
        event.clientX - centerScreenX,
      )
      let delta = ((angle - (drag.startAngle ?? angle)) * 180) / Math.PI
      if (event.shiftKey) delta = Math.round(delta / 15) * 15
      const radians = (delta * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      for (const item of drag.rotationNodes) {
        const centerX = drag.centerX + item.offsetX * cos - item.offsetY * sin
        const centerY = drag.centerX + item.offsetX * sin + item.offsetY * cos
        item.node.x = centerX - item.node.width / 2
        item.node.y = centerY - item.node.height / 2
        const extension = ensureExtension(item.node)
        const degree = ((item.startRotation + delta) % 360 + 360) % 360
        extension.rotation = Math.round(degree * 10) / 10
      }
    } else if (drag.kind === 'rotate') {
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (!overlay || !dm) return
      const extension = ensureExtension(drag.primary)
      const bounds = overlay.getBoundingClientRect()
      const { offsetX, offsetY, scale } = dm.data
      const centerX =
        bounds.left + offsetX + (drag.startX + drag.startWidth / 2) * scale
      const centerY =
        bounds.top + offsetY + (drag.startY + drag.startHeight / 2) * scale
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
      const delta = ((angle - (drag.startAngle ?? angle)) * 180) / Math.PI
      let degree = (drag.startRotation ?? 0) + delta
      if (event.shiftKey) degree = Math.round(degree / 15) * 15
      degree = ((degree % 360) + 360) % 360
      extension.rotation = Math.round(degree * 10) / 10
    } else {
      const corner = drag.corner ?? 'se'
      const hasEast = corner.includes('e')
      const hasWest = corner.includes('w')
      const hasSouth = corner.includes('s')
      const hasNorth = corner.includes('n')
      const rotation = drag.primary['x-superboard']?.rotation ?? 0
      const overlay = overlayRef.current
      const dm = dmRef.current
      if (drag.nodes.length === 1 && rotation !== 0 && overlay && dm) {
        const bounds = overlay.getBoundingClientRect()
        const pointerX = (event.clientX - bounds.left - dm.data.offsetX) / dm.data.scale
        const pointerY = (event.clientY - bounds.top - dm.data.offsetY) / dm.data.scale
        const radians = (rotation * Math.PI) / 180
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)
        const rotate = (x: number, y: number) => ({
          x: x * cos - y * sin,
          y: x * sin + y * cos,
        })
        const inverseRotate = (x: number, y: number) => ({
          x: x * cos + y * sin,
          y: -x * sin + y * cos,
        })
        const signX = hasEast ? 1 : hasWest ? -1 : 0
        const signY = hasSouth ? 1 : hasNorth ? -1 : 0
        const centerX = drag.startX + drag.startWidth / 2
        const centerY = drag.startY + drag.startHeight / 2
        const anchorOffset = rotate(
          (-signX * drag.startWidth) / 2,
          (-signY * drag.startHeight) / 2,
        )
        const anchor = { x: centerX + anchorOffset.x, y: centerY + anchorOffset.y }
        const local = inverseRotate(pointerX - anchor.x, pointerY - anchor.y)
        let width = signX === 0 ? drag.startWidth : Math.max(40, signX * local.x)
        let height = signY === 0 ? drag.startHeight : Math.max(40, signY * local.y)
        let ratioScale = 1
        if (drag.ratioLocked) {
          if (signX === 0) ratioScale = height / drag.startHeight
          else if (signY === 0) ratioScale = width / drag.startWidth
          else {
            ratioScale = cornerRatioScale(
              width,
              height,
              drag.startWidth,
              drag.startHeight,
            )
          }
          width = drag.startWidth * ratioScale
          height = drag.startHeight * ratioScale
        }
        const centerOffset = rotate((signX * width) / 2, (signY * height) / 2)
        const nextCenter = { x: anchor.x + centerOffset.x, y: anchor.y + centerOffset.y }
        drag.primary.x = nextCenter.x - width / 2
        drag.primary.y = nextCenter.y - height / 2
        drag.primary.width = width
        drag.primary.height = height
        applyContentScale(drag, ratioScale)
      } else {
        let width = hasEast
          ? Math.max(40, drag.startWidth + dx)
          : hasWest
            ? Math.max(40, drag.startWidth - dx)
            : drag.startWidth
        let height = hasSouth
          ? Math.max(40, drag.startHeight + dy)
          : hasNorth
            ? Math.max(40, drag.startHeight - dy)
            : drag.startHeight
        let ratioScale = 1
        if (drag.ratioLocked) {
          if (!hasEast && !hasWest) ratioScale = height / drag.startHeight
          else if (!hasSouth && !hasNorth) ratioScale = width / drag.startWidth
          else {
            ratioScale = cornerRatioScale(
              width,
              height,
              drag.startWidth,
              drag.startHeight,
            )
          }
          width = drag.startWidth * ratioScale
          height = drag.startHeight * ratioScale
        }
        const nextX = hasWest ? drag.startX + drag.startWidth - width : drag.startX
        const nextY = hasNorth ? drag.startY + drag.startHeight - height : drag.startY
        const scaleX = drag.startWidth === 0 ? 1 : width / drag.startWidth
        const scaleY = drag.startHeight === 0 ? 1 : height / drag.startHeight
        for (const item of drag.nodes) {
          item.node.x = nextX + (item.startX - drag.startX) * scaleX
          item.node.y = nextY + (item.startY - drag.startY) * scaleY
          item.node.width = Math.max(1, item.startWidth * scaleX)
          item.node.height = Math.max(1, item.startHeight * scaleY)
        }
        applyContentScale(drag, ratioScale)
      }
    }
    const dmNow = dmRef.current
    if (focusedGroupId && dmNow) {
      const allNodes = Object.values(dmNow.data.nodeMap).map((item) => item.ref)
      const group = dmNow.data.nodeMap[focusedGroupId]?.ref
      const descendants = group ? collectDescendants(group, allNodes) : []
      if (group && descendants.length > 0) {
        const minX = Math.min(...descendants.map((node) => node.x))
        const minY = Math.min(...descendants.map((node) => node.y))
        const maxX = Math.max(...descendants.map((node) => node.x + node.width))
        const maxY = Math.max(...descendants.map((node) => node.y + node.height))
        group.x = minX
        group.y = minY
        group.width = Math.max(1, maxX - minX)
        group.height = Math.max(1, maxY - minY)
      }
    }
    controllerRef.current?.refresh()
    onChange?.()
    setTick((value) => value + 1)
  }

  function endDrag() {
    dragRef.current = null
    setGuides(null)
    setActionsVisible(true)
  }

  return {
    dragRef,
    beginMove,
    beginResize,
    beginMultiMove,
    beginMultiRotate,
    beginRotate,
    moveDrag,
    endDrag,
  }
}
