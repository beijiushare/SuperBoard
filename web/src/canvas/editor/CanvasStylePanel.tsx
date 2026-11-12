import type { CanvasDocument, CanvasNode, SuperBoardStyle } from '../model'

interface CanvasStylePanelProps {
  canvas: CanvasDocument
  selectedIds: string[]
  onBeforeChange: () => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
}

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
  onBeforeChange,
  onApply,
}: CanvasStylePanelProps) {
  const selected = new Set(selectedIds)
  const nodes = canvas.nodes.filter((node) => selected.has(node.id))
  if (nodes.length === 0) return null

  const shapes = nodes.filter((node) => kindOf(node) === 'shape')
  const texts = nodes.filter((node) => node.type === 'text' && (!kindOf(node) || kindOf(node) === 'text'))
  const blocks = nodes.filter((node) => {
    const kind = kindOf(node)
    return kind === 'markdown' || kind === 'pele' || kind === 'media'
  })

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

  function setBlockColor(color: string) {
    applyTo(blocks, (node) =>
      color === '0'
        ? { ...node, color: undefined }
        : { ...node, color },
    )
  }

  const firstShape = shapes[0]
  const firstText = texts[0]
  const firstBlock = blocks[0]

  return (
    <aside className="sb-style-panel">
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
                  onClick={() => styleAll(texts, { fontSize: value })}
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
    </aside>
  )
}
