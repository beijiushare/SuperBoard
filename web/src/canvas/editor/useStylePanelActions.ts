import type {
  CanvasDocument,
  CanvasEdge,
  CanvasNode,
  SuperBoardCanvasSettings,
  SuperBoardMedia,
  SuperBoardStyle,
} from '../model'
import {
  nodeSupportsBackground as supportsBackground,
  nodeSupportsSurface as supportsSurface,
} from '../model'
import { collectDescendants } from './hierarchy'
import {
  applyGeometry,
  applyTextStyle,
  withCommonStyle,
} from './styleMutations'
import { getUiState, updateUiState } from './uiState'
import { patchDrawingNode, type DrawingPatch } from './drawingStyle'
import { peleSizeForLayout } from '../../shared/pele/size'

interface UseStylePanelActionsOptions {
  canvas: CanvasDocument
  selectedIds: string[]
  targetNodes: CanvasNode[]
  paddingNodes: CanvasNode[]
  peleNodes: CanvasNode[]
  mediaNodes: CanvasNode[]
  edge?: CanvasEdge
  onBeforeChange: (mergeKey?: string) => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
}

function patchHistoryKey(prefix: string, patch: object) {
  return `${prefix}:${Object.keys(patch).sort().join(',')}`
}

/**
 * All mutations the style panel can perform. Keeping them out of the component
 * makes the panel JSX a pure view of the derived state.
 */
export function useStylePanelActions({
  canvas,
  selectedIds,
  targetNodes,
  paddingNodes,
  peleNodes,
  mediaNodes,
  edge,
  onBeforeChange,
  onApply,
}: UseStylePanelActionsOptions) {
  const boardSettings = canvas['x-superboard']?.settings ?? {}

  function applyTo(
    targets: CanvasNode[],
    change: (node: CanvasNode) => CanvasNode,
    historyKey?: string,
  ) {
    if (targets.length === 0) return
    const targetIds = new Set(targets.map((node) => node.id))
    onBeforeChange(historyKey)
    onApply(
      {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          targetIds.has(node.id) ? change(node) : node,
        ),
      },
      selectedIds,
    )
  }

  function updateBoardSettings(patch: SuperBoardCanvasSettings) {
    const root = canvas['x-superboard']
    if (!root) return
    onBeforeChange(patchHistoryKey('board', patch))
    onApply({
      ...canvas,
      'x-superboard': {
        ...root,
        settings: { ...boardSettings, ...patch },
      },
    })
  }

  function updateGeometry(patch: {
    width?: number
    height?: number
    rotation?: number
  }) {
    if (targetNodes.length === 0) return
    const targetIds = new Set(targetNodes.map((node) => node.id))
    onBeforeChange(patchHistoryKey('geometry', patch))
    onApply(
      {
        ...canvas,
        nodes: canvas.nodes.map((node) => {
          if (!targetIds.has(node.id)) return node
          // Pele blocks keep their diagram's ratio, also through the number fields.
          if (
            node['x-superboard']?.kind === 'pele' &&
            patch.rotation === undefined &&
            !(patch.width !== undefined && patch.height !== undefined) &&
            node.width > 0 &&
            node.height > 0
          ) {
            const ratio = node.width / node.height
            if (patch.width !== undefined) {
              return applyGeometry(node, {
                width: patch.width,
                height: Math.max(40, Math.round(patch.width / ratio)),
              })
            }
            if (patch.height !== undefined) {
              return applyGeometry(node, {
                width: Math.max(40, Math.round(patch.height * ratio)),
                height: patch.height,
              })
            }
          }
          return applyGeometry(node, patch)
        }),
      },
      selectedIds,
    )
  }

  function updateCommonStyle(patch: Partial<SuperBoardStyle>) {
    const keys = Object.keys(patch)
    const needsBackground = keys.some(
      (key) =>
        key === 'background' ||
        key === 'backgroundColor' ||
        key === 'backgroundOpacity' ||
        key === 'fill',
    )
    const needsBorder = keys.some(
      (key) =>
        key === 'border' ||
        key === 'borderColor' ||
        key === 'borderOpacity' ||
        key === 'borderWidth' ||
        key === 'borderStyle' ||
        key === 'stroke',
    )
    const targets = targetNodes.filter(
      (node) =>
        (!needsBackground || supportsBackground(node)) &&
        (!needsBorder || supportsSurface(node)),
    )
    applyTo(
      targets,
      (node) => withCommonStyle(node, patch),
      patchHistoryKey('style', patch),
    )
  }

  function updateGroupPadding(value: number) {
    const groups = targetNodes.filter(
      (node) => node['x-superboard']?.kind === 'group',
    )
    if (groups.length === 0) return
    const padding = Math.max(0, value)
    applyTo(
      groups,
      (node) => {
        const current = node['x-superboard']?.style?.padding ?? 0
        const delta = padding - current
        if (delta === 0) return node
        return {
          ...node,
          x: node.x - delta,
          y: node.y - delta,
          width: Math.max(1, node.width + delta * 2),
          height: Math.max(1, node.height + delta * 2),
          'x-superboard': {
            ...(node['x-superboard'] ?? { kind: 'group' as const }),
            style: { ...node['x-superboard']?.style, padding },
          },
        }
      },
      patchHistoryKey('group-padding', { padding }),
    )
  }

  function updateContentPadding(value: number) {
    if (paddingNodes.length === 0) return
    const padding = Math.max(0, Math.min(96, Math.round(value)))
    applyTo(
      paddingNodes,
      (node) => {
        const extension = node['x-superboard']
        if (!extension) return node
        return {
          ...node,
          'x-superboard': {
            ...extension,
            style: { ...extension.style, padding },
          },
        }
      },
      patchHistoryKey('content-padding', { padding }),
    )
  }

  function applyPeleNarrow(narrow: boolean) {
    if (peleNodes.length === 0) return
    void (async () => {
      const sizes = new Map<string, { width: number; height: number }>()
      for (const node of peleNodes) {
        const extension = node['x-superboard']
        const code =
          typeof extension?.code === 'string'
            ? extension.code
            : node.type === 'text'
              ? node.text
              : ''
        const size = await peleSizeForLayout(code, narrow, {
          width: node.width,
          height: node.height,
        })
        if (size) sizes.set(node.id, size)
      }
      applyTo(
        peleNodes,
        (node) => {
          const size = sizes.get(node.id)
          return {
            ...node,
            ...(size ?? {}),
            'x-superboard': {
              ...(node['x-superboard'] ?? { kind: 'pele' as const }),
              narrow,
            },
          }
        },
        patchHistoryKey('pele-narrow', { narrow }),
      )
    })()
  }

  function updateDrawing(patch: DrawingPatch) {
    const targets = targetNodes.filter(
      (node) => node['x-superboard']?.kind === 'drawing',
    )
    if (targets.length === 0) return
    applyTo(
      targets,
      (node) => patchDrawingNode(node, patch),
      patchHistoryKey('drawing', patch),
    )
    updateUiState({
      brush: { ...getUiState().brush, ...patch },
    })
  }

  function styleText(targets: CanvasNode[], patch: Partial<SuperBoardStyle>) {
    applyTo(
      targets,
      (node) => applyTextStyle(node, patch),
      patchHistoryKey('style', patch),
    )
  }

  function updateEdge(patch: Partial<CanvasEdge>) {
    if (!edge) return
    onBeforeChange(patchHistoryKey('edge', patch))
    onApply(
      {
        ...canvas,
        edges: canvas.edges.map((item) =>
          item.id === edge.id ? { ...item, ...patch } : item,
        ),
      },
      selectedIds,
    )
  }

  function setMediaCrop(patch: Partial<SuperBoardMedia>) {
    applyTo(
      mediaNodes,
      (node) => {
        const extension = node['x-superboard']
        if (!extension?.media) return node
        return {
          ...node,
          'x-superboard': {
            ...extension,
            media: { ...extension.media, ...patch },
          },
        }
      },
      patchHistoryKey('media', patch),
    )
  }

  function layoutRoots() {
    const selectedSet = new Set(targetNodes.map((node) => node.id))
    return targetNodes.filter((node) => {
      const groupId = node['x-superboard']?.groupId
      return !groupId || !selectedSet.has(groupId)
    })
  }

  function moveBy(moves: Map<string, { dx: number; dy: number }>) {
    onBeforeChange()
    onApply(
      {
        ...canvas,
        nodes: canvas.nodes.map((node) => {
          const move = moves.get(node.id)
          return move
            ? { ...node, x: node.x + move.dx, y: node.y + move.dy }
            : node
        }),
      },
      selectedIds,
    )
  }

  function align(
    mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom',
  ) {
    const roots = layoutRoots()
    if (roots.length < 2) return
    const minX = Math.min(...roots.map((node) => node.x))
    const maxX = Math.max(...roots.map((node) => node.x + node.width))
    const minY = Math.min(...roots.map((node) => node.y))
    const maxY = Math.max(...roots.map((node) => node.y + node.height))
    const moves = new Map<string, { dx: number; dy: number }>()
    for (const node of roots) {
      let dx = 0
      let dy = 0
      if (mode === 'left') dx = minX - node.x
      else if (mode === 'right') dx = maxX - (node.x + node.width)
      else if (mode === 'hcenter')
        dx = (minX + maxX) / 2 - (node.x + node.width / 2)
      else if (mode === 'top') dy = minY - node.y
      else if (mode === 'bottom') dy = maxY - (node.y + node.height)
      else dy = (minY + maxY) / 2 - (node.y + node.height / 2)
      if (dx === 0 && dy === 0) continue
      for (const item of [node, ...collectDescendants(node, canvas.nodes)]) {
        moves.set(item.id, { dx, dy })
      }
    }
    if (moves.size === 0) return
    moveBy(moves)
  }

  function distribute(axis: 'h' | 'v') {
    const roots = layoutRoots()
    if (roots.length < 3) return
    const horizontal = axis === 'h'
    const sorted = [...roots].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))
    const start = horizontal
      ? Math.min(...sorted.map((node) => node.x))
      : Math.min(...sorted.map((node) => node.y))
    const end = horizontal
      ? Math.max(...sorted.map((node) => node.x + node.width))
      : Math.max(...sorted.map((node) => node.y + node.height))
    const total = sorted.reduce(
      (sum, node) => sum + (horizontal ? node.width : node.height),
      0,
    )
    const gap = (end - start - total) / (sorted.length - 1)
    const moves = new Map<string, { dx: number; dy: number }>()
    let cursor = start
    for (const node of sorted) {
      const dx = horizontal ? cursor - node.x : 0
      const dy = horizontal ? 0 : cursor - node.y
      if (dx !== 0 || dy !== 0) {
        for (const item of [node, ...collectDescendants(node, canvas.nodes)]) {
          moves.set(item.id, { dx, dy })
        }
      }
      cursor += (horizontal ? node.width : node.height) + gap
    }
    if (moves.size === 0) return
    moveBy(moves)
  }

  return {
    updateBoardSettings,
    updateGeometry,
    updateCommonStyle,
    updateGroupPadding,
    updateContentPadding,
    applyPeleNarrow,
    updateDrawing,
    styleText,
    updateEdge,
    setMediaCrop,
    align,
    distribute,
  }
}
