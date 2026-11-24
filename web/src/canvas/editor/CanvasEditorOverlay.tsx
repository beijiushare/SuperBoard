import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import {
  blockKind,
  isActionableNode,
  isAutoSizedBlock,
  isBlockNode,
} from './blocks'
import { BlockActions } from './BlockActions'
import { edgeGeometry, edgePath } from './edges'
import {
  SELECTION_CORNERS,
  SELECTION_SIDES,
  canShowSelectionRotate,
  selectionChromeStyle,
  selectionEdgeStyle,
  selectionHandleStyle,
  selectionRotateStyle,
  visibleSelectionCorners,
} from './selectionChrome'
import {
  isLocked,
  nodeMapOf,
  selectableAncestor,
} from './hierarchy'
import {
  hasIframeContent,
  isAdditiveSelection,
  screenStyle,
  type Marquee,
} from './overlayGeometry'
import { useMarqueeSelection } from './useMarqueeSelection'
import { isCanvasChromeTarget } from './overlaySelectors'
import { useOverlayViewport } from './useOverlayViewport'
import { useEdgeDrag } from './useEdgeDrag'
import { useCanvasDrag } from './useCanvasDrag'
import type {
  OverlayController,
  OverlayDataManager,
} from './overlayTypes'

type DataManager = OverlayDataManager
type Controller = OverlayController

interface CanvasEditorOverlayProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onChange?: () => void
  onBeforeChange?: () => void
  interactive?: boolean
  selectedEdgeId?: string | null
  onSelectEdge?: (id: string | null) => void
  focusedGroupId?: string | null
  activeEditingId?: string | null
  selectionSuppressedId?: string | null
  guidesEnabled?: boolean
  onToggleBlockEdit?: (id: string) => void
  onFocusBlockEdit?: (id: string) => void
  onDeleteBlock?: (id: string) => void
  onResetBlockSize?: (id: string) => void
  onToggleRatioLock?: (id: string) => void
}

export function CanvasEditorOverlay({
  canvas,
  viewerRef,
  selectedIds,
  onSelect,
  onChange,
  onBeforeChange,
  interactive = true,
  selectedEdgeId = null,
  onSelectEdge,
  focusedGroupId = null,
  activeEditingId = null,
  selectionSuppressedId = null,
  guidesEnabled = true,
  onToggleBlockEdit,
  onFocusBlockEdit,
  onDeleteBlock,
  onResetBlockSize,
  onToggleRatioLock,
}: CanvasEditorOverlayProps) {
  const [tick, setTick] = useState(0)
  const [view, setView] = useState({ offsetX: 0, offsetY: 0, scale: 1 })
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null)
  const [actionsVisible, setActionsVisible] = useState(true)
  const canShowGuides =
    guidesEnabled && !activeEditingId && !selectionSuppressedId

  useEffect(() => {
    if (!canShowGuides) setGuides(null)
  }, [canShowGuides])

  useEffect(() => {
    const clearGuides = () => setGuides(null)
    window.addEventListener('pointerdown', clearGuides, true)
    return () => window.removeEventListener('pointerdown', clearGuides, true)
  }, [])
  const overlayRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  const pendingViewRef = useRef<{ offsetX: number; offsetY: number; scale: number } | null>(null)
  const dmRef = useRef<DataManager | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeAdditiveRef = useRef(false)
  const marqueeMovedRef = useRef(false)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const clearDrag = () => {
      dragRef.current = null
      setGuides(null)
      setActionsVisible(true)
    }
    window.addEventListener('pointerup', clearDrag, true)
    window.addEventListener('pointercancel', clearDrag, true)
    window.addEventListener('blur', clearDrag)
    return () => {
      window.removeEventListener('pointerup', clearDrag, true)
      window.removeEventListener('pointercancel', clearDrag, true)
      window.removeEventListener('blur', clearDrag)
    }
  }, [])

  useLayoutEffect(() => {
    const world = worldRef.current
    if (!world) return
    world.style.transform = ''
    world.style.removeProperty('--sb-actions-inverse')
  }, [view])

  useOverlayViewport({
    viewerRef,
    dmRef,
    controllerRef,
    worldRef,
    viewRef,
    pendingViewRef,
    setView,
    setTick,
  })
  const {
    edgePreview,
    beginEdgeEndpoint,
    finishEdgeEndpoint,
    moveEdge,
  } = useEdgeDrag({
    dmRef,
    overlayRef,
    controllerRef,
    focusedGroupId,
    onBeforeChange,
    onChange,
    setTick,
  })
  const {
    dragRef,
    beginMove,
    beginResize,
    beginMultiMove,
    beginMultiRotate,
    beginRotate,
    moveDrag,
    endDrag,
  } = useCanvasDrag({
    overlayRef,
    dmRef,
    controllerRef,
    selectedIds,
    onSelect,
    focusedGroupId: focusedGroupId ?? null,
    guidesEnabled: canShowGuides,
    onBeforeChange,
    onChange,
    setGuides,
    setActionsVisible,
    setTick,
  })

  useMarqueeSelection({
    overlayRef,
    dmRef,
    interactive,
    activeEditingId: activeEditingId ?? null,
    focusedGroupId: focusedGroupId ?? null,
    selectedIds,
    onSelect,
    onSelectEdge,
    setMarquee,
    marqueeStartRef,
    marqueeAdditiveRef,
    marqueeMovedRef,
    suppressClickRef,
  })

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      const dm = dmRef.current
      const target = event.target as HTMLElement | null
      if (!dm || !target) return
      if (!dm.data.container.contains(target)) return
      if (isAdditiveSelection(event)) return
      if (
        isCanvasChromeTarget(target) ||
        target.closest('.JCV-overlay-container') ||
        target.closest('button, a, input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      onSelect([])
      onSelectEdge?.(null)
    }

    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [onSelect, onSelectEdge])

  function movePointer(event: ReactPointerEvent) {
    if (moveEdge(event)) return
    moveDrag(event)
  }

  const dm = dmRef.current
  if (!dm) return null
  const { offsetX, offsetY, scale } = view
  const nodes = Object.values(dm.data.nodeMap).map((item) => item.ref)
  const map = nodeMapOf(nodes)
  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id))
  const selectionBoxNodes = selectedNodes.filter(
    (node) =>
      node.id !== selectionSuppressedId &&
      (node.id !== activeEditingId || blockKind(node) === 'text'),
  )
  const focusedNode = focusedGroupId ? map.get(focusedGroupId) ?? null : null
  const selectedEdge = selectedEdgeId
    ? canvas.edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null
  const selectedEdgeGeometry = selectedEdge ? edgeGeometry(selectedEdge, map) : null
  const canMultiRotate =
    selectedNodes.length > 1 &&
    selectedNodes.every(
      (node) => node['x-superboard']?.kind !== 'group' && !isLocked(node, map),
    )
  const selectedBounds =
    selectedNodes.length > 0
      ? {
          left: Math.min(...selectedNodes.map((node) => node.x)),
          top: Math.min(...selectedNodes.map((node) => node.y)),
          right: Math.max(...selectedNodes.map((node) => node.x + node.width)),
          bottom: Math.max(...selectedNodes.map((node) => node.y + node.height)),
        }
      : null
  const editable = nodes.filter((node) => {
    const kind = node['x-superboard']?.kind
    if (kind !== 'shape' && kind !== 'drawing' && kind !== 'group') return false
    return !isLocked(node, map)
  })

  return (
    <div
      ref={overlayRef}
      className="sb-editor-overlay"
      data-tick={tick}
      style={selectionChromeStyle}
    >
      <div ref={worldRef} className="sb-editor-world">
      <svg className="sb-editor-edge-layer">
        <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
          {canvas.edges.map((edge) => {
            const path = edgePath(edge, map)
            if (!path) return null
            return (
              <g key={edge.id}>
                <path
                  className="sb-editor-edge-hit"
                  d={path}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect?.([])
                    onSelectEdge?.(edge.id)
                  }}
                />
                {edge.id === selectedEdgeId ? (
                  <path
                    className="sb-editor-edge-selected"
                    d={path}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            )
          })}
        </g>
        {edgePreview ? (
          <line
            className="sb-editor-edge-preview"
            x1={offsetX + edgePreview.fromX * scale}
            y1={offsetY + edgePreview.fromY * scale}
            x2={offsetX + edgePreview.x * scale}
            y2={offsetY + edgePreview.y * scale}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {selectedEdge && selectedEdgeGeometry ? (
        <>
          <div
            className="sb-editor-edge-endpoint"
            style={{
              left: offsetX + selectedEdgeGeometry.start.x * scale,
              top: offsetY + selectedEdgeGeometry.start.y * scale,
            }}
            onPointerDown={(event) => beginEdgeEndpoint(event, selectedEdge, 'from')}
            onPointerMove={movePointer}
            onPointerUp={finishEdgeEndpoint}
          />
          <div
            className="sb-editor-edge-endpoint"
            style={{
              left: offsetX + selectedEdgeGeometry.end.x * scale,
              top: offsetY + selectedEdgeGeometry.end.y * scale,
            }}
            onPointerDown={(event) => beginEdgeEndpoint(event, selectedEdge, 'to')}
            onPointerMove={movePointer}
            onPointerUp={finishEdgeEndpoint}
          />
        </>
      ) : null}
      {focusedNode ? (
        <div
          className="sb-editor-group-focus"
          style={screenStyle(focusedNode, offsetX, offsetY, scale)}
        />
      ) : null}
      {editable
        .map((node) => (
          <div
            key={node.id}
            className="sb-editor-hitbox"
            style={screenStyle(node, offsetX, offsetY, scale)}
            onPointerDown={(event) => beginMove(event, node)}
            onPointerMove={movePointer}
            onPointerUp={endDrag}
          />
        ))}

      {nodes
        .filter((node) => isBlockNode(node) && !isLocked(node, map))
        .map((node) => (
          <div
            key={`block-hit-${node.id}`}
            data-node-id={node.id}
            className={`sb-editor-hitbox sb-editor-block-hitbox${
              selectedIds.includes(node.id) && hasIframeContent(node)
                ? ' is-interactive'
                : ''
            }`}
            style={screenStyle(node, offsetX, offsetY, scale)}
            onPointerDown={(event) => beginMove(event, node)}
            onPointerMove={movePointer}
            onPointerUp={endDrag}
            onDoubleClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleBlockEdit?.(node.id)
            }}
          />
        ))}

      {nodes
        .filter(
          (node) =>
            isLocked(node, map) &&
            node.id === selectableAncestor(node, map, focusedGroupId)?.id,
        )
        .map((node) => (
          <div
            key={`locked-hit-${node.id}`}
            className="sb-editor-hitbox sb-editor-locked-hitbox"
            style={screenStyle(node, offsetX, offsetY, scale)}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              onSelect(
                isAdditiveSelection(event)
                  ? selectedIds.includes(node.id)
                    ? selectedIds.filter((id) => id !== node.id)
                    : [...selectedIds, node.id]
                  : [node.id],
              )
              onSelectEdge?.(null)
            }}
          />
        ))}

      {selectionBoxNodes.map((node) => (
        <div
          key={node.id}
          className={`sb-editor-selection${
            hasIframeContent(node) || activeEditingId === node.id
              ? ' is-interactive'
              : ''
          }`}
          style={screenStyle(node, offsetX, offsetY, scale)}
          onPointerDown={(event) => beginMove(event, node)}
          onPointerMove={movePointer}
          onPointerUp={endDrag}
        >
          {selectionBoxNodes.length === 1 ? (
            <>
              {hasIframeContent(node)
                ? SELECTION_SIDES.map((side) => (
                    <span
                      key={`drag-${side}`}
                      className={`sb-editor-drag-edge sb-editor-drag-edge-${side}`}
                      onPointerDown={(event) => beginMove(event, node)}
                      onPointerMove={movePointer}
                      onPointerUp={endDrag}
                    />
                  ))
                : null}
              {isAutoSizedBlock(node) ? null : (
                <>
                  {visibleSelectionCorners(
                    node.width * scale,
                    node.height * scale,
                  ).map((corner) => (
                    <span
                      key={corner}
                      className="sb-editor-handle"
                      style={selectionHandleStyle(corner)}
                      onPointerDown={(event) => beginResize(event, node, corner)}
                      onPointerMove={movePointer}
                      onPointerUp={endDrag}
                    />
                  ))}
                  {SELECTION_SIDES.map((side) => (
                    <span
                      key={side}
                      className="sb-editor-edge-handle"
                      style={selectionEdgeStyle(side)}
                      onPointerDown={(event) => beginResize(event, node, side)}
                      onPointerMove={movePointer}
                      onPointerUp={endDrag}
                    />
                  ))}
                  {node['x-superboard']?.kind !== 'group' &&
                  canShowSelectionRotate(node.width * scale, node.height * scale)
                    ? SELECTION_CORNERS.map((corner) => (
                        <span
                          key={corner}
                          className="sb-editor-rotate"
                          style={selectionRotateStyle(corner)}
                          onPointerDown={(event) => beginRotate(event, node)}
                          onPointerMove={movePointer}
                          onPointerUp={endDrag}
                        />
                      ))
                    : null}
                </>
              )}
            </>
          ) : null}
        </div>
      ))}

      {canMultiRotate && selectedBounds ? (
        <div
          className="sb-editor-multi-selection"
          style={{
            left: offsetX + selectedBounds.left * scale,
            top: offsetY + selectedBounds.top * scale,
            width: (selectedBounds.right - selectedBounds.left) * scale,
            height: (selectedBounds.bottom - selectedBounds.top) * scale,
          }}
          onPointerDown={(event) => beginMultiMove(event, selectedNodes)}
          onPointerMove={movePointer}
          onPointerUp={endDrag}
        >
          {SELECTION_CORNERS.map((corner) => (
            <span
              key={corner}
              className="sb-editor-rotate"
              style={selectionRotateStyle(corner)}
              onPointerDown={(event) => beginMultiRotate(event, selectedNodes)}
              onPointerMove={movePointer}
              onPointerUp={endDrag}
            />
          ))}
        </div>
      ) : null}

      {nodes
        .filter(
          (node) =>
            actionsVisible &&
            isActionableNode(node) &&
            ((selectedIds.length === 1 && selectedIds[0] === node.id) ||
              activeEditingId === node.id) &&
            (node.id !== selectionSuppressedId ||
              activeEditingId === node.id),
        )
        .map((node) => (
          <BlockActions
            key={`block-actions-${node.id}`}
            node={node}
            offsetX={offsetX}
            offsetY={offsetY}
            scale={scale}
            stageWidth={dm.data.container.clientWidth}
            stageHeight={dm.data.container.clientHeight}
            editing={activeEditingId === node.id}
            onToggleBlockEdit={onToggleBlockEdit}
            onFocusBlockEdit={onFocusBlockEdit}
            onDeleteBlock={onDeleteBlock}
                onResetBlockSize={onResetBlockSize}
            onToggleRatioLock={onToggleRatioLock}
          />
        ))}

      {canShowGuides && guides?.x !== undefined ? (
        <div
          className="sb-editor-guide sb-editor-guide-v"
          style={{ left: offsetX + guides.x * scale }}
        />
      ) : null}
      {canShowGuides && guides?.y !== undefined ? (
        <div
          className="sb-editor-guide sb-editor-guide-h"
          style={{ top: offsetY + guides.y * scale }}
        />
      ) : null}

      {marquee ? <div className="sb-editor-marquee" style={marquee} /> : null}
      </div>
    </div>
  )
}
