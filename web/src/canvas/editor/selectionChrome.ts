import type { CSSProperties } from 'react'

export const SELECTION_CORNERS = ['nw', 'ne', 'sw', 'se'] as const
export const SELECTION_SIDES = ['n', 'e', 's', 'w'] as const

export type SelectionCorner = (typeof SELECTION_CORNERS)[number]
export type SelectionSide = (typeof SELECTION_SIDES)[number]

export const selectionHandleSize = 9
export const selectionHandleOffset = 5
export const selectionHandleHitInset = 5
export const selectionRotateSize = 11
export const selectionRotateOffset = 18
export const selectionRotateHitInset = 6
export const selectionEdgeHitSize = 14
export const selectionEdgeInset = '22%'
export const selectionTinySize = 18

export function visibleSelectionCorners(
  width: number,
  height: number,
): SelectionCorner[] {
  const tinyX = width < selectionTinySize
  const tinyY = height < selectionTinySize
  if (tinyX && tinyY) return ['nw']
  if (tinyX || tinyY) return ['nw', 'se']
  return [...SELECTION_CORNERS]
}

export function canShowSelectionRotate(width: number, height: number) {
  return width >= selectionTinySize && height >= selectionTinySize
}

const cornerCursor: Record<SelectionCorner, CSSProperties['cursor']> = {
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  se: 'nwse-resize',
}

const sideCursor: Record<SelectionSide, CSSProperties['cursor']> = {
  n: 'ns-resize',
  e: 'ew-resize',
  s: 'ns-resize',
  w: 'ew-resize',
}

export const selectionChromeStyle = {
  '--sb-selection-handle-hit-inset': `-${selectionHandleHitInset}px`,
  '--sb-selection-rotate-hit-inset': `-${selectionRotateHitInset}px`,
} as CSSProperties

export function selectionHandleStyle(corner: SelectionCorner): CSSProperties {
  return {
    width: selectionHandleSize,
    height: selectionHandleSize,
    top: corner[0] === 'n' ? -selectionHandleOffset : undefined,
    bottom: corner[0] === 's' ? -selectionHandleOffset : undefined,
    left: corner[1] === 'w' ? -selectionHandleOffset : undefined,
    right: corner[1] === 'e' ? -selectionHandleOffset : undefined,
    cursor: cornerCursor[corner],
  }
}

export function selectionRotateStyle(corner: SelectionCorner): CSSProperties {
  return {
    width: selectionRotateSize,
    height: selectionRotateSize,
    top: corner[0] === 'n' ? -selectionRotateOffset : undefined,
    bottom: corner[0] === 's' ? -selectionRotateOffset : undefined,
    left: corner[1] === 'w' ? -selectionRotateOffset : undefined,
    right: corner[1] === 'e' ? -selectionRotateOffset : undefined,
    cursor: cornerCursor[corner],
  }
}

export function selectionEdgeStyle(side: SelectionSide): CSSProperties {
  const half = selectionEdgeHitSize / 2
  switch (side) {
    case 'n':
      return {
        top: -half,
        right: selectionEdgeInset,
        left: selectionEdgeInset,
        height: selectionEdgeHitSize,
        cursor: sideCursor[side],
      }
    case 's':
      return {
        bottom: -half,
        right: selectionEdgeInset,
        left: selectionEdgeInset,
        height: selectionEdgeHitSize,
        cursor: sideCursor[side],
      }
    case 'e':
      return {
        top: selectionEdgeInset,
        right: -half,
        bottom: selectionEdgeInset,
        width: selectionEdgeHitSize,
        cursor: sideCursor[side],
      }
    case 'w':
      return {
        top: selectionEdgeInset,
        bottom: selectionEdgeInset,
        left: -half,
        width: selectionEdgeHitSize,
        cursor: sideCursor[side],
      }
  }
}
