import { useEffect, useState } from 'react'
import {
  resolveNodeStyle,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
  type SuperBoardMedia,
  type SuperBoardStyle,
} from '../model'
import { collectDescendants } from './hierarchy'
import { ColorPicker } from './ColorPicker'
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

  const shapes = nodes.filter((node) => kindOf(node) === 'shape')
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

  function styleAll(targets: CanvasNode[], patch: Partial<SuperBoardStyle>) {
    applyTo(
      targets,
      (node) => withStyle(node, patch),
      patchHistoryKey('style', patch),
    )
  }

  function styleText(targets: CanvasNode[], patch: Partial<SuperBoardStyle>) {
    applyTo(
      targets,
      (node) => {
        const next = withStyle(node, patch)
        if (node.type !== 'text' || !patch.fontSize) return next
        const fontSize = patch.fontSize
        const charsPerLine = Math.max(
          1,
          Math.floor((node.width - 32) / (fontSize * 0.62)),
        )
        const lines = node.text
          .split('\n')
          .reduce(
            (sum, line) =>
              sum + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)),
            0,
          )
        return {
          ...next,
          height: Math.max(40, Math.round(lines * fontSize * 1.45 + 28)),
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
  const firstIsShape = firstKind === 'shape'
  const firstIsDrawing = firstKind === 'drawing'
  const firstIsLine =
    firstIsShape && firstNode?.['x-superboard']?.shape === 'line'
  const firstResolved = resolveNodeStyle(firstNode?.['x-superboard']?.style)
  const firstBorderColor = firstResolved.borderColor ?? '#1d1d1d'
  const firstBorderWidth = firstResolved.borderWidth ?? (firstIsShape ? 2 : 0)
  const firstBorderOpacity = Math.round(firstResolved.borderOpacity * 100)
  const firstBorderStyle = firstResolved.borderStyle
  const firstBackgroundColor = firstResolved.background ?? '#ffffff'
  const firstBackgroundOpacity = Math.round(firstResolved.backgroundOpacity * 100)
  const firstOpacity = Math.round(firstResolved.opacity * 100)
  const firstShape = shapes[0]
  const firstShapeResolved = resolveNodeStyle(firstShape?.['x-superboard']?.style)
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
          <section>
            <h3>变换</h3>
            <StyleNumberControl
              label="角度"
              value={firstNode['x-superboard']?.rotation ?? 0}
              min={-360}
              max={360}
              step={1}
              unit="°"
              slider
              onChange={(rotation) => updateGeometry({ rotation })}
            />
            <StyleNumberControl
              label="宽度"
              value={firstNode.width}
              min={1}
              max={10000}
              step={1}
              unit="px"
              onChange={(width) => updateGeometry({ width })}
            />
            <StyleNumberControl
              label="高度"
              value={firstNode.height}
              min={1}
              max={10000}
              step={1}
              unit="px"
              onChange={(height) => updateGeometry({ height })}
            />
          </section>
          <section>
            <h3>外观</h3>
            <StyleNumberControl
              label="透明度"
              value={firstOpacity}
              min={0}
              max={100}
              step={1}
              unit="%"
              slider
              onChange={(value) => updateCommonStyle({ opacity: value / 100 })}
            />
            {!firstIsDrawing && !firstIsLine ? (
              <>
                <ColorPicker
                  label="背景颜色(C)"
                  value={firstBackgroundColor}
                  allowNone
                  recentColors={boardSettings.recentColors}
                  onChange={(backgroundColor) =>
                    updateCommonStyle({ backgroundColor })
                  }
                  onColorUsed={onRememberColor}
                />
                <StyleNumberControl
                  label="背景透明度"
                  value={firstBackgroundOpacity}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  slider
                  onChange={(value) =>
                    updateCommonStyle({ backgroundOpacity: value / 100 })
                  }
                />
              </>
            ) : null}
            <ColorPicker
              label="边框颜色(C)"
              value={firstBorderColor}
              allowNone
              recentColors={boardSettings.recentColors}
              onChange={(borderColor) => updateCommonStyle({ borderColor })}
              onColorUsed={onRememberColor}
            />
            <StyleNumberControl
              label="边框透明度"
              value={firstBorderOpacity}
              min={0}
              max={100}
              step={1}
              unit="%"
              slider
              onChange={(value) =>
                updateCommonStyle({ borderOpacity: value / 100 })
              }
            />
            <StyleNumberControl
              label="边框粗细"
              value={firstBorderWidth}
              min={0}
              max={40}
              step={0.5}
              unit="px"
              onChange={(borderWidth) => updateCommonStyle({ borderWidth })}
            />
            {!firstIsDrawing ? (
              <div className="sb-style-row">
                <span>线条类型</span>
                <div className="sb-style-buttons">
                  {([
                    ['solid', '实线'],
                    ['dashed', '虚线'],
                    ['dotted', '点线'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={firstBorderStyle === value ? 'is-active' : undefined}
                      onClick={() => updateCommonStyle({ borderStyle: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
      {!hasSelection ? (
        <>
          <section>
            <h3>画布</h3>
            <ColorPicker
              label="背景(C)"
              value={boardSettings.background ?? '#ffffff'}
              recentColors={boardSettings.recentColors}
              onChange={(background) => updateBoardSettings({ background })}
              onColorUsed={onRememberColor}
            />
            <div className="sb-style-row">
              <span>网格</span>
              <div className="sb-style-buttons">
                {([
                  ['none', '无'],
                  ['dots', '点'],
                  ['lines', '线'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      (boardSettings.grid ?? 'dots') === value
                        ? 'is-active'
                        : undefined
                    }
                    onClick={() => updateBoardSettings({ grid: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sb-style-row">
              <span>对齐提示</span>
              <button
                type="button"
                className={`sb-style-toggle${
                  (boardSettings.guides ?? true) ? ' is-active' : ''
                }`}
                onClick={() =>
                  updateBoardSettings({
                    guides: !(boardSettings.guides ?? true),
                  })
                }
              >
                {(boardSettings.guides ?? true) ? '开启' : '关闭'}
              </button>
            </div>
          </section>
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
            label="颜色(C)"
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
          <div className="sb-style-buttons">
            <button type="button" onClick={() => align('left')}>
              左对齐
            </button>
            <button type="button" onClick={() => align('hcenter')}>
              水平居中
            </button>
            <button type="button" onClick={() => align('right')}>
              右对齐
            </button>
            <button type="button" onClick={() => align('top')}>
              顶部
            </button>
            <button type="button" onClick={() => align('vcenter')}>
              垂直居中
            </button>
            <button type="button" onClick={() => align('bottom')}>
              底部
            </button>
            <button type="button" onClick={() => distribute('h')}>
              横向分布
            </button>
            <button type="button" onClick={() => distribute('v')}>
              纵向分布
            </button>
          </div>
        </section>
      ) : null}

      {shapes.length > 0 ? (
        <section>
          <h3>形状</h3>
          <ColorPicker
            label="填充(C)"
            value={firstShapeResolved.background ?? '#ffffff'}
            allowNone
            recentColors={boardSettings.recentColors}
            onChange={(backgroundColor) => styleAll(shapes, { backgroundColor })}
            onColorUsed={onRememberColor}
          />
          <ColorPicker
            label="描边(C)"
            value={firstShapeResolved.borderColor ?? '#1d1d1d'}
            allowNone
            recentColors={boardSettings.recentColors}
            onChange={(borderColor) => styleAll(shapes, { borderColor })}
            onColorUsed={onRememberColor}
          />
          <div className="sb-style-row">
            <span>线宽</span>
            <div className="sb-style-buttons">
              {[1, 2, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={firstShapeResolved.borderWidth === value ? 'is-active' : undefined}
                  onClick={() => styleAll(shapes, { borderWidth: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="sb-style-row">
            <span>圆角</span>
            <div className="sb-style-buttons">
              {[0, 8, 16].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={firstShapeResolved.cornerRadius === value ? 'is-active' : undefined}
                  onClick={() => styleAll(shapes, { cornerRadius: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="sb-style-row">
            <span>透明</span>
            <div className="sb-style-buttons">
              {[1, 0.7, 0.4].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    firstShapeResolved.opacity === value
                      ? 'is-active'
                      : undefined
                  }
                  onClick={() => styleAll(shapes, { opacity: value })}
                >
                  {Math.round(value * 100)}%
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {texts.length > 0 ? (
        <section>
          <h3>文本</h3>
          <div className="sb-style-row">
            <span>字体</span>
            <select
              className="sb-style-select"
              value={firstText?.['x-superboard']?.style?.fontFamily ?? ''}
              onChange={(event) =>
                styleText(texts, { fontFamily: event.target.value || undefined })
              }
            >
              <option value="">默认</option>
              <option value="PingFang SC, Microsoft YaHei, sans-serif">苹方</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="ui-monospace, Consolas, monospace">等宽</option>
            </select>
          </div>
          <div className="sb-style-row">
            <span>字号</span>
            <div className="sb-style-buttons">
              {[14, 16, 20, 28].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    (firstText?.['x-superboard']?.style?.fontSize ?? 16) === value
                      ? 'is-active'
                      : undefined
                  }
                  onClick={() => styleText(texts, { fontSize: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <ColorPicker
            label="颜色(C)"
            value={firstText?.['x-superboard']?.style?.color ?? '#1d1d1d'}
            recentColors={boardSettings.recentColors}
            onChange={(color) => styleAll(texts, { color })}
            onColorUsed={onRememberColor}
          />
          <div className="sb-style-row">
            <span>样式</span>
            <div className="sb-style-buttons">
              <button
                type="button"
                className={
                  Number(firstText?.['x-superboard']?.style?.fontWeight ?? 400) >=
                  700
                    ? 'is-active'
                    : undefined
                }
                onClick={() =>
                  styleAll(texts, {
                    fontWeight:
                      Number(
                        firstText?.['x-superboard']?.style?.fontWeight ?? 400,
                      ) >= 700
                        ? 400
                        : 700,
                  })
                }
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className={
                  firstText?.['x-superboard']?.style?.fontStyle === 'italic'
                    ? 'is-active'
                    : undefined
                }
                onClick={() =>
                  styleAll(texts, {
                    fontStyle:
                      firstText?.['x-superboard']?.style?.fontStyle === 'italic'
                        ? 'normal'
                        : 'italic',
                  })
                }
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className={
                  firstText?.['x-superboard']?.style?.textDecoration ===
                  'underline'
                    ? 'is-active'
                    : undefined
                }
                onClick={() =>
                  styleAll(texts, {
                    textDecoration:
                      firstText?.['x-superboard']?.style?.textDecoration ===
                      'underline'
                        ? 'none'
                        : 'underline',
                  })
                }
              >
                <u>U</u>
              </button>
            </div>
          </div>
          <div className="sb-style-row">
            <span>对齐</span>
            <div className="sb-style-buttons">
              {(
                [
                  ['left', '左'],
                  ['center', '中'],
                  ['right', '右'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    (firstText?.['x-superboard']?.style?.textAlign ?? 'left') === value
                      ? 'is-active'
                      : undefined
                  }
                  onClick={() => styleAll(texts, { textAlign: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
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
