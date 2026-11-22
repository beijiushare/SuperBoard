import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import { resolveNodeStyle, type SuperBoardStyle } from '../model'

type GroupNode = {
  type: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  label?: string
  'x-superboard'?: {
    kind?: string
    style?: SuperBoardStyle
    rotation?: number
  }
}

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: GroupNode }>
  }
}

type StyleManager = {
  getColor: (color?: string) => {
    background: string
    border: string
    active: string
    text: string
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

/**
 * Group backgrounds, borders and labels used to be painted on the main
 * canvas. Rendering them as a transformed DOM layer keeps them crisp in the
 * editor and in exported HTML.
 */
export class GroupLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly sm: StyleManager
  private readonly controller: Controller
  private readonly layer: HTMLDivElement
  private readonly unsubscribe: () => void

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.sm = this.container.get(internal.StyleManager as never) as StyleManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.layer = document.createElement('div')
    this.layer.className = 'sb-canvas-group-layer'
    Object.assign(this.layer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      transformOrigin: '0 0',
      willChange: 'transform',
    })
    const overlays = this.dm.data.container.querySelector('.JCV-overlays')
    if (overlays) this.dm.data.container.insertBefore(this.layer, overlays)
    else this.dm.data.container.appendChild(this.layer)
    this.unsubscribe = this.controller.onRefresh.subscribe(this.draw)
    this.onStart(this.draw)
    this.onRestart(this.draw)
    this.onDispose(this.dispose)
  }

  private readonly draw = () => {
    const { offsetX, offsetY, scale, nodeMap } = this.dm.data
    while (this.layer.firstChild) this.layer.removeChild(this.layer.firstChild)
    this.layer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
    for (const item of Object.values(nodeMap)) {
      const node = item.ref
      if (node.type !== 'group') continue
      const kind = node['x-superboard']?.kind
      if (kind === 'shape' || kind === 'drawing') continue
      const colors = this.sm.getColor(node.color)
      const style = resolveNodeStyle(node['x-superboard']?.style)
      const background = style.background ?? colors.background
      const backgroundOpacity = style.backgroundOpacity
      const borderColor = style.borderColor ?? colors.border
      const borderWidth = style.borderWidth ?? 2
      const borderStyle = style.borderStyle || 'solid'
      const radius = Math.min(
        (style.cornerRadius ?? 12) + borderWidth,
        node.width / 2,
        node.height / 2,
      )
      const box = document.createElement('div')
      box.className = 'sb-canvas-group'
      Object.assign(box.style, {
        position: 'absolute',
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
        boxSizing: 'border-box',
        borderRadius: `${radius}px`,
        border: borderWidth
          ? `${borderWidth}px ${borderStyle} color-mix(in srgb, ${borderColor} ${
              style.borderOpacity * 100
            }%, transparent)`
          : undefined,
        backgroundColor: background
          ? `color-mix(in srgb, ${background} ${
              backgroundOpacity * 100
            }%, transparent)`
          : undefined,
        opacity: String(style.opacity),
      })
      if (node.label) {
        const label = document.createElement('div')
        label.className = 'sb-canvas-group-label'
        label.textContent = node.label
        Object.assign(label.style, {
          position: 'absolute',
          left: '0',
          bottom: '100%',
          marginBottom: '8px',
          height: '30px',
          padding: '0 6px',
          borderRadius: '6px',
          background: colors.active,
          color: colors.text,
          fontFamily: "'Inter', sans-serif",
          fontSize: '16px',
          lineHeight: '30px',
          whiteSpace: 'nowrap',
        })
        box.appendChild(label)
      }
      this.layer.appendChild(box)
    }
  }

  private readonly dispose = () => {
    this.unsubscribe()
    this.layer.remove()
  }
}
