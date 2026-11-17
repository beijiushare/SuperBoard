import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type { EditorTool } from './tools'
import { useFloatingPanel } from './useFloatingPanel'
import { WindowDragHandle } from './WindowDragHandle'

type ShapeTool = Extract<EditorTool, 'rect' | 'rounded-rect' | 'ellipse' | 'line' | 'diamond'>

type IconName =
  | 'select'
  | 'text'
  | 'shape'
  | 'draw'
  | 'arrow'
  | 'eraser'
  | 'insert'
  | 'export'

type Flyout = {
  kind: 'shape' | 'insert' | 'export'
  x: number
  y: number
}

const SHAPE_TOOLS: Array<{ id: ShapeTool; label: string; icon: ShapeTool }> = [
  { id: 'rect', label: '正方形', icon: 'rect' },
  { id: 'rounded-rect', label: '圆角矩形', icon: 'rounded-rect' },
  { id: 'ellipse', label: '椭圆', icon: 'ellipse' },
  { id: 'line', label: '线条', icon: 'line' },
  { id: 'diamond', label: '菱形', icon: 'diamond' },
]

const SHAPE_IDS = new Set<EditorTool>(SHAPE_TOOLS.map((item) => item.id))

const ICON_PATHS: Record<IconName, string[]> = {
  select: [
    'M245.1 184.5l362.8 362.8 100.3 100.3H436.9l-14.6 14.6-177.2 177.3v-655m-50-120.7v896.3l262.5-262.5h371.3L643.3 512 195.1 63.8z',
  ],
  text: [
    'M792.149333 289.557333V157.696a8.256 8.256 0 0 0-8.234666-8.256H223.424a8.256 8.256 0 0 0-8.234667 8.256v131.861333c0 4.544 3.690667 8.256 8.234667 8.256h57.706667a8.256 8.256 0 0 0 8.234666-8.256v-65.92h173.098667v576.96h-94.805333a8.256 8.256 0 0 0-8.234667 8.234667v57.706667c0 4.522667 3.712 8.234667 8.234667 8.234666h272a8.256 8.256 0 0 0 8.256-8.234666v-57.706667a8.256 8.256 0 0 0-8.256-8.234667h-94.784V223.637333h173.098666v65.92c0 4.544 3.712 8.256 8.234667 8.256h57.706667a8.256 8.256 0 0 0 8.234666-8.256z',
  ],
  shape: [
    'M962 962H62V62h900v900zM162 862h700V162H162v700z',
  ],
  draw: [
    'M192 341.333333c44.373333 0 99.84-64 181.333333-64 64.853333 0 117.333333 52.48 117.333334 117.333334 0 87.04-84.906667 134.4-166.826667 180.053333C231.253333 625.92 170.666667 664.32 170.666667 725.333333c0 46.933333 38.4 85.333333 85.333333 85.333334v85.333333c-94.293333 0-170.666667-76.373333-170.666667-170.666667 0-115.626667 109.226667-176.64 197.12-225.28 60.586667-33.706667 122.88-68.266667 122.88-105.386666 0-17.493333-14.506667-32-32-32C320 362.666667 266.666667 426.666667 192 426.666667A106.666667 106.666667 0 0 1 85.333333 320C85.333333 232.533333 177.92 120.746667 213.333333 85.333333l60.16 60.16C230.826667 188.586667 170.666667 274.346667 170.666667 320c0 11.946667 9.386667 21.333333 21.333333 21.333333zM341.333333 896h160l343.893334-343.893333-160-160L341.333333 736V896z m85.333334-124.586667l258.56-258.56 39.253333 39.253334L465.92 810.666667H426.666667v-39.253334zM869.12 268.373333a42.496 42.496 0 0 0-60.16 0l-78.08 78.08 160 160 78.08-78.08a42.496 42.496 0 0 0 0-60.16l-99.84-99.84z',
  ],
  arrow: [
    'M139.08607033 853.67240896l468.62281276-468.62281277L651.09988438 428.44059749 182.47707162 897.06341025l-43.39100128-43.3910013z',
    'M475.22620999 257.84308963L875.75699299 153.70508632l-100.13269568 404.53609063-300.39808732-300.39808732z',
  ],
  eraser: [
    'M366.336 377.770667l-211.2 211.2L376.746667 810.666667l49.92-0.042667v-0.042667h49.962666l161.237334-161.237333-271.530667-271.530667zM426.666667 317.44l271.530666 271.530667 120.661334-120.661334-271.530667-271.530666L426.666667 317.44z m170.666666 493.098667h298.666667v85.333333h-384l-170.581333 0.085333-276.778667-276.821333a42.666667 42.666667 0 0 1 0-60.330667L517.12 106.282667a42.666667 42.666667 0 0 1 60.330667 0l331.904 331.861333a42.666667 42.666667 0 0 1 0 60.330667L597.333333 810.538667z',
  ],
  insert: [
    'M512 0C229.831111 0 0 229.831111 0 512S229.831111 1024 512 1024 1024 794.168889 1024 512 794.168889 0 512 0z m0 955.733333C266.24 955.733333 68.266667 757.76 68.266667 512S266.24 68.266667 512 68.266667 955.733333 266.24 955.733333 512 757.76 955.733333 512 955.733333z',
    'M750.933333 477.866667h-204.8v-204.8c0-18.204444-15.928889-34.133333-34.133333-34.133334S477.866667 254.862222 477.866667 273.066667v204.8h-204.8c-18.204444 0-34.133333 15.928889-34.133334 34.133333S254.862222 546.133333 273.066667 546.133333h204.8v204.8c0 18.204444 15.928889 34.133333 34.133333 34.133334S546.133333 769.137778 546.133333 750.933333v-204.8h204.8c18.204444 0 34.133333-15.928889 34.133334-34.133333S769.137778 477.866667 750.933333 477.866667z',
  ],
  export: [
    'M987.428571 0h-292.571428c-21.942857 0-36.571429 14.628571-36.571429 36.571429s14.628571 36.571429 36.571429 36.571428h204.8L431.542857 541.257143c-14.628571 14.628571-14.628571 36.571429 0 51.2 14.628571 14.628571 36.571429 14.628571 51.2 0L950.857143 124.342857v204.8c0 21.942857 14.628571 36.571429 36.571428 36.571429s36.571429-14.628571 36.571429-36.571429v-292.571428c0-21.942857-14.628571-36.571429-36.571429-36.571429z',
    'M987.428571 512c-21.942857 0-36.571429 14.628571-36.571428 36.571429V877.714286c0 43.885714-29.257143 73.142857-73.142857 73.142857H146.285714c-43.885714 0-73.142857-29.257143-73.142857-73.142857V146.285714c0-43.885714 29.257143-73.142857 73.142857-73.142857h329.142857c21.942857 0 36.571429-14.628571 36.571429-36.571428S497.371429 0 475.428571 0H146.285714C65.828571 0 0 65.828571 0 146.285714v731.428572c0 80.457143 65.828571 146.285714 146.285714 146.285714h731.428572c80.457143 0 146.285714-65.828571 146.285714-146.285714V548.571429c0-21.942857-14.628571-36.571429-36.571429-36.571429z',
  ],
}

function ToolIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className="canvas-tool-icon"
      viewBox="0 0 1024 1024"
      focusable="false"
    >
      {ICON_PATHS[name].map((path, index) => (
        <path key={index} d={path} fill="currentColor" />
      ))}
    </svg>
  )
}

function ShapeIcon({ shape }: { shape: ShapeTool }) {
  return (
    <svg
      aria-hidden="true"
      className="canvas-tool-shape-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      focusable="false"
    >
      {shape === 'ellipse' ? (
        <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />
      ) : shape === 'line' ? (
        <line x1="4" y1="19" x2="20" y2="5" />
      ) : shape === 'diamond' ? (
        <polygon points="12,3 21,12 12,21 3,12" />
      ) : (
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx={shape === 'rounded-rect' ? 4 : 0}
        />
      )}
    </svg>
  )
}

interface CanvasToolPaletteProps {
  tool: EditorTool
  onToolChange: (tool: EditorTool) => void
  onInsertMarkdown: () => void
  onInsertPele: () => void
  onInsertSchedule: () => void
  onInsertMedia: () => void
}

export function CanvasToolPalette({
  tool,
  onToolChange,
  onInsertMarkdown,
  onInsertPele,
  onInsertSchedule,
  onInsertMedia,
}: CanvasToolPaletteProps) {
  const { rootRef, position, handleProps } = useFloatingPanel()
  const [flyout, setFlyout] = useState<Flyout | null>(null)

  useEffect(() => {
    if (!flyout) return
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.canvas-tool-palette, .canvas-tool-flyout')) return
      setFlyout(null)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [flyout])

  function openFlyout(
    kind: Flyout['kind'],
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect()
    setFlyout({
      kind,
      x: Math.min(rect.right + 8, window.innerWidth - 210),
      y: Math.min(rect.top, window.innerHeight - 190),
    })
  }

  function chooseShape(shape: ShapeTool) {
    onToolChange(shape)
    setFlyout(null)
  }

  const shapeActive = SHAPE_IDS.has(tool)

  return (
    <>
      <div
        ref={rootRef}
        className="canvas-tool-palette"
        style={{ left: position.x, top: position.y }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div
          className="canvas-tool-palette-handle"
          role="button"
          tabIndex={-1}
          aria-label="拖动操作栏"
          {...handleProps}
        >
          <WindowDragHandle />
        </div>
        <button
          type="button"
          className={`canvas-tool-button${tool === 'select' ? ' is-active' : ''}`}
          title="选择（V）"
          aria-label="选择"
          onClick={() => onToolChange('select')}
        >
          <ToolIcon name="select" />
        </button>
        <button
          type="button"
          className={`canvas-tool-button${tool === 'text' ? ' is-active' : ''}`}
          title="文本（T）"
          aria-label="文本"
          onClick={() => onToolChange('text')}
        >
          <ToolIcon name="text" />
        </button>
        <button
          type="button"
          className={`canvas-tool-button canvas-tool-button--shape${
            shapeActive ? ' is-active' : ''
          }`}
          title="形状（右键选择）"
          aria-label="形状"
          onClick={() => onToolChange('rect')}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openFlyout('shape', event)
          }}
        >
          <ToolIcon name="shape" />
          <span className="canvas-tool-corner" />
        </button>
        <button
          type="button"
          className={`canvas-tool-button${tool === 'draw' ? ' is-active' : ''}`}
          title="自由绘图"
          aria-label="自由绘图"
          onClick={() => onToolChange('draw')}
        >
          <ToolIcon name="draw" />
        </button>
        <button
          type="button"
          className={`canvas-tool-button${tool === 'arrow' ? ' is-active' : ''}`}
          title="箭头"
          aria-label="箭头"
          onClick={() => onToolChange('arrow')}
        >
          <ToolIcon name="arrow" />
        </button>
        <button
          type="button"
          className={`canvas-tool-button${tool === 'eraser' ? ' is-active' : ''}`}
          title="橡皮擦"
          aria-label="橡皮擦"
          onClick={() => onToolChange('eraser')}
        >
          <ToolIcon name="eraser" />
        </button>
        <span className="canvas-tool-divider" />
        <button
          type="button"
          className="canvas-tool-button"
          title="插入"
          aria-label="插入"
          onClick={(event) => openFlyout('insert', event)}
        >
          <ToolIcon name="insert" />
          <span className="canvas-tool-corner" />
        </button>
        <button
          type="button"
          className="canvas-tool-button"
          title="导出"
          aria-label="导出"
          onClick={(event) => openFlyout('export', event)}
        >
          <ToolIcon name="export" />
          <span className="canvas-tool-corner" />
        </button>
      </div>

      {flyout ? (
        <div
          className="canvas-tool-flyout"
          style={{ left: flyout.x, top: flyout.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
        >
          {flyout.kind === 'shape'
            ? SHAPE_TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`canvas-tool-flyout-item${
                    tool === item.id ? ' is-active' : ''
                  }`}
                  onClick={() => chooseShape(item.id)}
                >
                  <ShapeIcon shape={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))
            : null}
          {flyout.kind === 'insert' ? (
            <>
              <button
                type="button"
                className="canvas-tool-flyout-item"
                onClick={() => {
                  setFlyout(null)
                  onInsertMarkdown()
                }}
              >
                插入 Markdown
              </button>
              <button
                type="button"
                className="canvas-tool-flyout-item"
                onClick={() => {
                  setFlyout(null)
                  onInsertPele()
                }}
              >
                插入 Pele 图表
              </button>
              <button
                type="button"
                className="canvas-tool-flyout-item"
                onClick={() => {
                  setFlyout(null)
                  onInsertSchedule()
                }}
              >
                插入日程表
              </button>
              <button
                type="button"
                className="canvas-tool-flyout-item"
                onClick={() => {
                  setFlyout(null)
                  onInsertMedia()
                }}
              >
                插入媒体
              </button>
            </>
          ) : null}
          {flyout.kind === 'export' ? (
            <>
              <button
                type="button"
                className="canvas-tool-flyout-item"
                onClick={() => {
                  setFlyout(null)
                  window.alert('功能开发中')
                }}
              >
                导出 HTML
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
