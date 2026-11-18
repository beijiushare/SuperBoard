import { useEffect, useState } from 'react'
import {
  resolveNodeStyle,
  textBlockHeight,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
  type SuperBoardMedia,
  type SuperBoardStyle,
} from '../model'
import { isRoundedRect } from './blocks'
import { collectDescendants } from './hierarchy'
import { ColorPicker } from './ColorPicker'
import {
  BackgroundFields,
  BorderFields,
  CanvasFields,
  TextFields,
  TransformFields,
} from './StyleFieldGroups'
import { StyleNumberControl } from './StyleNumberControl'
import { useFloatingPanel } from './useFloatingPanel'
import { WindowDragHandle } from './WindowDragHandle'

interface CanvasStylePanelProps {
  canvas: CanvasDocument
  selectedIds: string[]
  selectedEdgeId?: string | null
  onBeforeChange: (mergeKey?: string) => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
  onRememberColor?: (color: string) => void
}

function kindOf(node: CanvasNode) {
  return node['x-superboard']?.kind
}

function fallbackKind(node: CanvasNode) {
  return node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media'
}

function patchHistoryKey(prefix: string, patch: object) {
  return `${prefix}:${Object.keys(patch).sort().join(',')}`
}

function CropSlider({
  label,
  value,
  min = 0,
  max = 100,
  onCommit,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onCommit: (value: number) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <div className="sb-style-row">
      <span>{label}</span>
      <input
        className="sb-style-range"
        type="range"
        min={min}
        max={max}
        value={local}
        onChange={(event) => setLocal(Number(event.target.value))}
        onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
        onKeyUp={(event) => onCommit(Number(event.currentTarget.value))}
      />
      <em className="sb-style-value">{local}</em>
    </div>
  )
}

function withStyle(node: CanvasNode, patch: Partial<SuperBoardStyle>): CanvasNode {
  const extension = node['x-superboard']
  return {
    ...node,
    'x-superboard': {
      ...(extension ?? { kind: fallbackKind(node) }),
      style: { ...extension?.style, ...patch },
    },
  }
}

export function CanvasStylePanel({
  canvas,
  selectedIds,
  selectedEdgeId = null,
  onBeforeChange,
  onApply,
  onRememberColor,
}: CanvasStylePanelProps) {
  const { rootRef, position, handleProps } = useFloatingPanel({
    alignRight: true,
    centerVertically: true,
  })
  const selected = new Set(selectedIds)
  const nodes = canvas.nodes.filter((node) => selected.has(node.id))
  const edge = selectedEdgeId
    ? canvas.edges.find((item) => item.id === selectedEdgeId)
    : undefined
  const boardSettings = canvas['x-superboard']?.settings ?? {}
  const hasSelection = nodes.length > 0 || Boolean(edge)

  function updateBoardSettings(patch: NonNullable<typeof boardSettings>) {
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
    if (nodes.length === 0) return
    const targetIds = new Set(nodes.map((node) => node.id))
    onBeforeChange(patchHistoryKey('geometry', patch))
    onApply({
      ...canvas,
      nodes: canvas.nodes.map((node) => {
        if (!targetIds.has(node.id)) return node
        const extension = node['x-superboard'] ?? { kind: fallbackKind(node) }
        return {
          ...node,
          width: patch.width ?? node.width,
          height: patch.height ?? node.height,
          'x-superboard': {
            ...extension,
            rotation: patch.rotation ?? extension.rotation,
          },
        }
      }),
    }, selectedIds)
  }

  function withCommonStyle(node: CanvasNode, patch: Partial<SuperBoardStyle>) {
    const next = withStyle(node, patch)
    if (patch.borderStyle === undefined) return next
    const extension = next['x-superboard']
    if (!extension?.style) return next
    const style = { ...extension.style }
    delete style.strokeDash
    return { ...next, 'x-superboard': { ...extension, style } }
  }

  function updateCommonStyle(patch: Partial<SuperBoardStyle>) {
    applyTo(
      nodes,
      (node) => withCommonStyle(node, patch),
      patchHistoryKey('style', patch),
    )
  }

  const texts = nodes.filter((node) => node.type === 'text' && (!kindOf(node) || kindOf(node) === 'text'))
  const mediaNodes = nodes.filter(
    (node) => node['x-superboard']?.kind === 'media' && node['x-superboard']?.media,
  )

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
        nodes: canvas.nodes.map((node) => (targetIds.has(node.id) ? change(node) : node)),
      },
      selectedIds,
    )
  }

  function styleText(targets: CanvasNode[], patch: Partial<SuperBoardStyle>) {
    applyTo(
      targets,
      (node) => {
        const next = withStyle(node, patch)
        if (node.type !== 'text' || !patch.fontSize) return next
        return {
          ...next,
          height: textBlockHeight(node.text, node.width, patch.fontSize),
        }
      },
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
    const selectedSet = new Set(nodes.map((node) => node.id))
    return nodes.filter((node) => {
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
          return move ? { ...node, x: node.x + move.dx, y: node.y + move.dy } : node
        }),
      },
      selectedIds,
    )
  }

  function align(mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
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
      else if (mode === 'hcenter') dx = (minX + maxX) / 2 - (node.x + node.width / 2)
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

  const firstNode = nodes[0]
  const firstKind = firstNode?.['x-superboard']?.kind
  const firstIsPlainText =
    firstNode?.type === 'text' && (!firstKind || firstKind === 'text')
  const firstIsShape = firstKind === 'shape'
  const firstIsDrawing = firstKind === 'drawing'
  const firstIsLine =
    firstIsShape && firstNode?.['x-superboard']?.shape === 'line'
  const firstResolved = resolveNodeStyle(firstNode?.['x-superboard']?.style)
  const firstIsRoundedRect = firstNode ? isRoundedRect(firstNode) : false
  const firstCornerRadius = firstResolved.cornerRadius ?? 0
  const maxCornerRadius = firstNode
    ? Math.max(1, Math.floor(Math.min(firstNode.width, firstNode.height) / 2))
    : 100
  const firstBorderColor = firstResolved.borderColor ?? '#1d1d1d'
  const firstBorderWidth = firstResolved.borderWidth ?? (firstIsShape ? 2 : 0)
  const firstBorderOpacity = Math.round(firstResolved.borderOpacity * 100)
  const firstBorderStyle = firstResolved.borderStyle
  const firstBackgroundColor = firstResolved.background ?? '#ffffff'
  const firstBackgroundOpacity = Math.round(firstResolved.backgroundOpacity * 100)
  const firstText = texts[0]
  const firstMedia = mediaNodes[0]?.['x-superboard']?.media

  return (
    <div
      ref={rootRef}
      className="sb-style-panel"
      style={{ left: position.x, top: position.y }}
    >
      <div className="sb-style-panel-header">
        <div
          className="sb-style-panel-drag"
          role="button"
          tabIndex={-1}
          aria-label="拖动样式面板"
          {...handleProps}
        >
          <WindowDragHandle />
        </div>
        <strong>样式面板</strong>
      </div>
      <div className="sb-style-panel-content">
      {firstNode ? (
        <>
          <TransformFields
            rotation={firstNode['x-superboard']?.rotation ?? 0}
            width={firstNode.width}
            height={firstNode.height}
            onRotation={(rotation) => updateGeometry({ rotation })}
            onWidth={(width) => updateGeometry({ width })}
            onHeight={(height) => updateGeometry({ height })}
          />
          {!firstIsDrawing && !firstIsLine && !firstIsPlainText ? (
            <BackgroundFields
              color={firstBackgroundColor}
              opacity={firstBackgroundOpacity}
              recentColors={boardSettings.recentColors}
              onColor={(backgroundColor) =>
                updateCommonStyle({ backgroundColor })
              }
              onOpacity={(value) =>
                updateCommonStyle({ backgroundOpacity: value / 100 })
              }
              onColorUsed={onRememberColor}
            />
          ) : null}
          {!firstIsPlainText ? (
            <BorderFields
              color={firstBorderColor}
              opacity={firstBorderOpacity}
              width={firstBorderWidth}
              style={firstBorderStyle}
              showStyle={!firstIsDrawing}
              recentColors={boardSettings.recentColors}
              onColor={(borderColor) => updateCommonStyle({ borderColor })}
              onOpacity={(value) =>
                updateCommonStyle({ borderOpacity: value / 100 })
              }
              onWidth={(borderWidth) => updateCommonStyle({ borderWidth })}
              onStyle={(borderStyle) => updateCommonStyle({ borderStyle })}
              onColorUsed={onRememberColor}
            />
          ) : null}
          {firstIsRoundedRect ? (
            <section>
              <h3>圆角</h3>
              <StyleNumberControl
                label="圆角"
                value={firstCornerRadius}
                min={0}
                max={maxCornerRadius}
                step={1}
                unit="px"
                slider
                onChange={(cornerRadius) => updateCommonStyle({ cornerRadius })}
              />
            </section>
          ) : null}
        </>
      ) : null}
      {!hasSelection ? (
        <>
          <CanvasFields
            background={boardSettings.background ?? '#ffffff'}
            backgroundOpacity={Math.round(
              (boardSettings.backgroundOpacity ?? 1) * 100,
            )}
            grid={boardSettings.grid ?? 'dots'}
            guides={boardSettings.guides ?? true}
            recentColors={boardSettings.recentColors}
            onUpdate={updateBoardSettings}
            onColorUsed={onRememberColor}
          />
          <section>
            <h3>缩放</h3>
            <div className="sb-style-row">
              <span>最小值</span>
              <input
                className="sb-style-number"
                type="number"
                min={5}
                max={2000}
                step={5}
                value={Math.round((boardSettings.zoomMin ?? 0.05) * 100)}
                onChange={(event) =>
                  updateBoardSettings({
                    zoomMin: Math.max(0.05, Number(event.target.value) / 100),
                  })
                }
              />
              <em className="sb-style-value">%</em>
            </div>
            <div className="sb-style-row">
              <span>最大值</span>
              <input
                className="sb-style-number"
                type="number"
                min={5}
                max={2000}
                step={5}
                value={Math.round((boardSettings.zoomMax ?? 20) * 100)}
                onChange={(event) =>
                  updateBoardSettings({
                    zoomMax: Math.max(0.05, Number(event.target.value) / 100),
                  })
                }
              />
              <em className="sb-style-value">%</em>
            </div>
          </section>
          <section>
            <h3>新增元素</h3>
            <div className="sb-style-row">
              <span>宽度</span>
              <input
                className="sb-style-number"
                type="number"
                min={40}
                placeholder="按类型"
                value={boardSettings.defaultBlockWidth ?? ''}
                onChange={(event) =>
                  updateBoardSettings({
                    defaultBlockWidth: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div className="sb-style-row">
              <span>高度</span>
              <input
                className="sb-style-number"
                type="number"
                min={40}
                placeholder="按类型"
                value={boardSettings.defaultBlockHeight ?? ''}
                onChange={(event) =>
                  updateBoardSettings({
                    defaultBlockHeight: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </section>
        </>
      ) : null}
      {edge ? (
        <section>
          <h3>箭头</h3>
          <ColorPicker
            label="颜色"
            value={edge.color ?? '#1d1d1d'}
            recentColors={boardSettings.recentColors}
            onChange={(color) => updateEdge({ color })}
            onColorUsed={onRememberColor}
          />
          <div className="sb-style-row">
            <span>终点箭头</span>
            <div className="sb-style-buttons">
              <button
                type="button"
                className={edge.toEnd !== 'none' ? 'is-active' : undefined}
                onClick={() => updateEdge({ toEnd: 'arrow' })}
              >
                箭头
              </button>
              <button
                type="button"
                className={edge.toEnd === 'none' ? 'is-active' : undefined}
                onClick={() => updateEdge({ toEnd: 'none' })}
              >
                无
              </button>
            </div>
          </div>
          <div className="sb-style-row">
            <span>起点箭头</span>
            <div className="sb-style-buttons">
              <button
                type="button"
                className={edge.fromEnd === 'arrow' ? 'is-active' : undefined}
                onClick={() => updateEdge({ fromEnd: 'arrow' })}
              >
                箭头
              </button>
              <button
                type="button"
                className={edge.fromEnd !== 'arrow' ? 'is-active' : undefined}
                onClick={() => updateEdge({ fromEnd: 'none' })}
              >
                无
              </button>
            </div>
          </div>
          <div className="sb-style-row">
            <span>起点侧</span>
            <select
              className="sb-style-select"
              value={edge.fromSide ?? ''}
              onChange={(event) =>
                updateEdge({
                  fromSide: (event.target.value || undefined) as CanvasEdge['fromSide'],
                })
              }
            >
              <option value="">自动</option>
              <option value="top">上</option>
              <option value="right">右</option>
              <option value="bottom">下</option>
              <option value="left">左</option>
            </select>
          </div>
          <div className="sb-style-row">
            <span>终点侧</span>
            <select
              className="sb-style-select"
              value={edge.toSide ?? ''}
              onChange={(event) =>
                updateEdge({
                  toSide: (event.target.value || undefined) as CanvasEdge['toSide'],
                })
              }
            >
              <option value="">自动</option>
              <option value="top">上</option>
              <option value="right">右</option>
              <option value="bottom">下</option>
              <option value="left">左</option>
            </select>
          </div>
          <div className="sb-style-row">
            <span>标签</span>
            <input
              key={`edge-label:${edge.id}:${edge.label ?? ''}`}
              className="sb-style-input"
              defaultValue={edge.label ?? ''}
              placeholder="连线标签"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                } else if (event.key === 'Escape') {
                  event.currentTarget.value = edge.label ?? ''
                  event.currentTarget.blur()
                }
              }}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim()
                if (value !== (edge.label ?? '')) {
                  updateEdge({ label: value || undefined })
                }
              }}
            />
          </div>
          <div className="sb-style-row">
            <span>方向</span>
            <div className="sb-style-buttons">
              <button
                type="button"
                onClick={() =>
                  updateEdge({
                    fromNode: edge.toNode,
                    toNode: edge.fromNode,
                    fromSide: edge.toSide,
                    toSide: edge.fromSide,
                    fromEnd: edge.toEnd,
                    toEnd: edge.fromEnd,
                  })
                }
              >
                反转方向
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {nodes.length >= 2 ? (
        <section>
          <h3>排列</h3>
          <div className="sb-style-buttons is-row">
            <button type="button" onClick={() => align('left')}>
              左对齐
            </button>
            <button type="button" onClick={() => align('right')}>
              右对齐
            </button>
            <button type="button" onClick={() => align('top')}>
              顶部对齐
            </button>
            <button type="button" onClick={() => align('bottom')}>
              底部对齐
            </button>
          </div>
          <div className="sb-style-buttons is-row">
            <button type="button" onClick={() => align('vcenter')}>
              垂直居中
            </button>
            <button type="button" onClick={() => align('hcenter')}>
              水平居中
            </button>
          </div>
          <div className="sb-style-buttons is-row">
            <button type="button" onClick={() => distribute('h')}>
              横向分布
            </button>
            <button type="button" onClick={() => distribute('v')}>
              纵向分布
            </button>
          </div>
        </section>
      ) : null}

      {texts.length > 0 ? (
        <TextFields
          node={firstText}
          recentColors={boardSettings.recentColors}
          onChange={(patch) => styleText(texts, patch)}
          onColorUsed={onRememberColor}
        />
      ) : null}



      {mediaNodes.length > 0 ? (
        <section>
          <h3>媒体裁剪</h3>
          <div className="sb-style-buttons">
            {(
              [
                ['rect', '矩形'],
                ['rounded', '圆角'],
                ['circle', '圆形'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={firstMedia?.crop === mode ? 'is-active' : undefined}
                onClick={() => setMediaCrop({ crop: mode })}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setMediaCrop({
                  crop: 'rounded',
                  cropX: 0,
                  cropY: 0,
                  cropW: 100,
                  cropH: 100,
                  cropCorner: 8,
                })
              }
            >
              重置
            </button>
          </div>
          {firstMedia?.crop === 'circle' ? (
            <>
              <CropSlider
                label="圆心X"
                value={firstMedia.cropCx ?? 50}
                onCommit={(value) => setMediaCrop({ cropCx: value })}
              />
              <CropSlider
                label="圆心Y"
                value={firstMedia.cropCy ?? 50}
                onCommit={(value) => setMediaCrop({ cropCy: value })}
              />
              <CropSlider
                label="半径"
                value={firstMedia.cropRadius ?? 50}
                onCommit={(value) => setMediaCrop({ cropRadius: value })}
              />
            </>
          ) : (
            <>
              <CropSlider
                label="起点X"
                value={firstMedia?.cropX ?? 0}
                onCommit={(value) => setMediaCrop({ cropX: value })}
              />
              <CropSlider
                label="起点Y"
                value={firstMedia?.cropY ?? 0}
                onCommit={(value) => setMediaCrop({ cropY: value })}
              />
              <CropSlider
                label="宽度"
                value={firstMedia?.cropW ?? 100}
                onCommit={(value) => setMediaCrop({ cropW: value })}
              />
              <CropSlider
                label="高度"
                value={firstMedia?.cropH ?? 100}
                onCommit={(value) => setMediaCrop({ cropH: value })}
              />
            </>
          )}
          {firstMedia?.crop === 'rounded' ? (
            <CropSlider
              label="圆角"
              value={firstMedia.cropCorner ?? 8}
              onCommit={(value) => setMediaCrop({ cropCorner: value })}
            />
          ) : null}
        </section>
      ) : null}
      </div>
    </div>
  )
}
