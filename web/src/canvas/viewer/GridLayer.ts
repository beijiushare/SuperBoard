import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    canvasData: {
      'x-superboard'?: {
        settings?: { grid?: 'none' | 'dots' | 'lines' }
      }
    }
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export class GridLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly svg: SVGSVGElement
  private readonly unsubscribe: () => void
  private sequence = 0

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('class', 'sb-canvas-grid-layer')
    Object.assign(this.svg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    })
    this.dm.data.container.insertBefore(
      this.svg,
      this.dm.data.container.firstChild,
    )
    this.unsubscribe = this.controller.onRefresh.subscribe(this.draw)
    this.onStart(this.draw)
    this.onRestart(this.draw)
    this.onDispose(this.dispose)
  }

  private pattern(step: number, color: string, alpha: number) {
    const id = `sb-grid-${this.sequence++}`
    const pattern = document.createElementNS(SVG_NS, 'pattern')
    pattern.setAttribute('id', id)
    pattern.setAttribute('width', String(step))
    pattern.setAttribute('height', String(step))
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    pattern.setAttribute('x', String(this.dm.data.offsetX % step))
    pattern.setAttribute('y', String(this.dm.data.offsetY % step))
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', `M ${step} 0 L 0 0 0 ${step}`)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', color)
    path.setAttribute('stroke-opacity', String(alpha))
    pattern.appendChild(path)
    return { id, pattern }
  }

  private readonly draw = () => {
    const settings = this.dm.data.canvasData['x-superboard']?.settings
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild)
    if (settings?.grid === 'none') return
    const scale = this.dm.data.scale
    let step = 10 * scale
    while (step < 8) step *= 2
    const major = step * 5
    const defs = document.createElementNS(SVG_NS, 'defs')
    const minor = this.pattern(step, 'rgba(0,0,0,0.10)', 1)
    const strong = this.pattern(major, 'rgba(0,0,0,0.16)', 1)
    defs.appendChild(minor.pattern)
    defs.appendChild(strong.pattern)
    this.svg.appendChild(defs)
    for (const { id } of [minor, strong]) {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('width', '100%')
      rect.setAttribute('height', '100%')
      rect.setAttribute('fill', `url(#${id})`)
      this.svg.appendChild(rect)
    }
  }

  private readonly dispose = () => {
    this.unsubscribe()
    this.svg.remove()
  }
}
