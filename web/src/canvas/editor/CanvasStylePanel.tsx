import { useEffect, useState } from 'react'
import type {
  CanvasDocument,
  CanvasEdge,
  CanvasNode,
  SuperBoardMedia,
  SuperBoardStyle,
} from '../model'
import { collectDescendants } from './hierarchy'
import { useFloatingPanel } from './useFloatingPanel'

interface CanvasStylePanelProps {
  canvas: CanvasDocument
  selectedIds: string[]
  selectedEdgeId?: string | null
  onBeforeChange: () => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
}

const EDGE_COLORS = [
  { value: '#6b7280', label: '灰色' },
  { value: '#1d1d1d', label: '黑色' },
  { value: '#2f80ed', label: '蓝色' },
  { value: '#e03131', label: '红色' },
  { value: '#2f9e44', label: '绿色' },
]

const FILLS = [
  { value: '#ffffff', label: '白色' },
  { value: '#f6f5f1', label: '纸色' },
  { value: '#fecaca', label: '红色' },
  { value: '#fed7aa', label: '橙色' },
  { value: '#fef08a', label: '黄色' },
  { value: '#bbf7d0', label: '绿色' },
  { value: '#bfdbfe', label: '蓝色' },
  { value: '#e9d5ff', label: '紫色' },
  { value: 'none', label: '无填充' },
]

const STROKES = [
  { value: '#1d1d1d', label: '黑色' },
  { value: '#6b7280', label: '灰色' },
  { value: '#2f80ed', label: '蓝色' },
  { value: '#e03131', label: '红色' },
  { value: '#2f9e44', label: '绿色' },
  { value: 'none', label: '无描边' },
]

const TEXT_COLORS = [
  { value: '#1d1d1d', label: '黑色' },
  { value: '#6b7280', label: '灰色' },
  { value: '#2f80ed', label: '蓝色' },
  { value: '#e03131', label: '红色' },
  { value: '#2f9e44', label: '绿色' },
]

const BLOCK_COLORS = [
  { value: '0', label: '默认', css: '#ffffff' },
  { value: '1', label: '红', css: '#fecaca' },
  { value: '2', label: '橙', css: '#fed7aa' },
  { value: '3', label: '黄', css: '#fef08a' },
  { value: '4', label: '绿', css: '#bbf7d0' },
  { value: '5', label: '蓝', css: '#bfdbfe' },
  { value: '6', label: '紫', css: '#e9d5ff' },
]

function kindOf(node: CanvasNode) {
  return node['x-superboard']?.kind
}

function fallbackKind(node: CanvasNode) {
  return node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media'
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
  if (nodes.length === 0 && !edge) return null

  const shapes = nodes.filter((node) => kindOf(node) === 'shape')
  const texts = nodes.filter((node) => node.type === 'text' && (!kindOf(node) || kindOf(node) === 'text'))
  const blocks = nodes.filter((node) => {
    const kind = kindOf(node)
    return kind === 'markdown' || kind === 'pele' || kind === 'media'
  })
  const mediaNodes = nodes.filter(
    (node) => node['x-superboard']?.kind === 'media' && node['x-superboard']?.media,
  )

  function applyTo(targets: CanvasNode[], change: (node: CanvasNode) => CanvasNode) {
    if (targets.length === 0) return
    const targetIds = new Set(targets.map((node) => node.id))
    onBeforeChange()
    onApply(
      {
        ...canvas,
        nodes: canvas.nodes.map((node) => (targetIds.has(node.id) ? change(node) : node)),
      },
      selectedIds,
    )
  }

  function styleAll(targets: CanvasNode[], patch: Partial<SuperBoardStyle>) {
    applyTo(targets, (node) => withStyle(node, patch))
  }

  function styleText(targets: CanvasNode[], patch: Partial<SuperBoardStyle>) {
    applyTo(targets, (node) => {
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
          (sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)),
          0,
        )
      return {
        ...next,
        height: Math.max(40, Math.round(lines * fontSize * 1.45 + 28)),
      }
    })
  }

  function updateEdge(patch: Partial<CanvasEdge>) {
    if (!edge) return
    onBeforeChange()
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
    applyTo(mediaNodes, (node) => {
      const extension = node['x-superboard']
      if (!extension?.media) return node
      return {
        ...node,
        'x-superboard': {
          ...extension,
          media: { ...extension.media, ...patch },
        },
      }
    })
  }

  function setBlockColor(color: string) {
    applyTo(blocks, (node) =>
      color === '0'
        ? { ...node, color: undefined }
        : { ...node, color },
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

  const firstShape = shapes[0]
  const firstText = texts[0]
  const firstBlock = blocks[0]
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
          <span className="sb-window-dots" />
        </div>
        <span className="sb-style-panel-icon" aria-hidden="true" />
        <strong>样式面板</strong>
      </div>
      <div className="sb-style-panel-content">
      {edge ? (
        <section>
          <h3>箭头</h3>
          <div className="sb-style-row">
            <span>颜色</span>
            <div className="sb-style-swatches">
              {EDGE_COLORS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  className={(edge.color ?? '#1d1d1d') === item.value ? 'is-active' : undefined}
                  style={{ background: item.value }}
                  onClick={() => updateEdge({ color: item.value })}
                />
              ))}
            </div>
          </div>
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
          <div className="sb-style-row">
            <span>填充</span>
            <div className="sb-style-swatches">
              {FILLS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  className={firstShape?.['x-superboard']?.style?.fill === item.value ? 'is-active' : undefined}
                  style={{ background: item.value === 'none' ? '#fff' : item.value }}
                  onClick={() => styleAll(shapes, { fill: item.value })}
                />
              ))}
            </div>
          </div>
          <div className="sb-style-row">
            <span>描边</span>
            <div className="sb-style-swatches">
              {STROKES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  className={firstShape?.['x-superboard']?.style?.stroke === item.value ? 'is-active' : undefined}
                  style={{ background: item.value === 'none' ? '#fff' : item.value }}
                  onClick={() => styleAll(shapes, { stroke: item.value })}
                />
              ))}
            </div>
          </div>
          <div className="sb-style-row">
            <span>线宽</span>
            <div className="sb-style-buttons">
              {[1, 2, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={firstShape?.['x-superboard']?.style?.strokeWidth === value ? 'is-active' : undefined}
                  onClick={() => styleAll(shapes, { strokeWidth: value })}
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
                  className={firstShape?.['x-superboard']?.style?.cornerRadius === value ? 'is-active' : undefined}
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
                    (firstShape?.['x-superboard']?.style?.opacity ?? 1) === value
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
          <div className="sb-style-row">
            <span>颜色</span>
            <div className="sb-style-swatches">
              {TEXT_COLORS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  className={firstText?.['x-superboard']?.style?.color === item.value ? 'is-active' : undefined}
                  style={{ background: item.value }}
                  onClick={() => styleAll(texts, { color: item.value })}
                />
              ))}
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

      {blocks.length > 0 ? (
        <section>
          <h3>块颜色</h3>
          <div className="sb-style-swatches">
            {BLOCK_COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                title={item.label}
                className={(firstBlock?.color ?? '0') === item.value ? 'is-active' : undefined}
                style={{ background: item.css }}
                onClick={() => setBlockColor(item.value)}
              />
            ))}
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
