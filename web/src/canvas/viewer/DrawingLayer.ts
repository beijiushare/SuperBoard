import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import { getStroke } from 'perfect-freehand'
import {
  resolveNodeStyle,
  type SuperBoardStroke,
} from '../model'
import { intersectsViewport, nodeWorldRect, viewportWorldRect } from './culling'

type DrawingNode = {
  x: number
  y: number
  width: number
  height: number
  'x-superboard'?: {
    strokes?: SuperBoardStroke[]
    rotation?: number
    style?: Record<string, unknown>
  }
}

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: DrawingNode }>
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

interface CachedPath {
  width: number
  path: string
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function outlinePath(outline: number[][]) {
  if (outline.length < 3) return ''
  const [first, ...rest] = outline
  let path = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`
  for (const point of rest) {
    path += ` L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`
  }
  return `${path} Z`
}

export class DrawingLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly svg: SVGSVGElement
  private readonly unsubscribe: () => void
  private readonly pathCache = new WeakMap<SuperBoardStroke, CachedPath>()

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('class', 'sb-canvas-drawing-layer')
    Object.assign(this.svg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      overflow: 'visible',
      pointerEvents: 'none',
    })
    const overlays = this.dm.data.container.querySelector('.JCV-overlays')
    if (overlays) this.dm.data.container.insertBefore(this.svg, overlays)
    else this.dm.data.container.appendChild(this.svg)
    this.unsubscribe = this.controller.onRefresh.subscribe(this.draw)
    this.onStart(this.start)
    this.onRestart(this.start)
    this.onDispose(this.dispose)
  }

  private readonly start = () => {
    this.draw()
  }

  private pathFor(stroke: SuperBoardStroke, width: number) {
    const cached = this.pathCache.get(stroke)
    if (cached?.width === width) return cached.path
    const outline = getStroke(
      stroke.points.map(([x, y, pressure]) =>
        pressure === undefined ? [x, y] : [x, y, pressure],
      ) as number[][],
      {
        size: width,
        thinning: stroke.thinning,
        smoothing: stroke.smoothing,
        streamline: stroke.streamline,
        simulatePressure: stroke.simulatePressure,
        start: stroke.start === undefined ? undefined : { taper: stroke.start },
        end: stroke.end === undefined ? undefined : { taper: stroke.end },
      },
    )
    const path = outlinePath(outline)
    this.pathCache.set(stroke, { width, path })
    return path
  }

  private readonly draw = () => {
    const { offsetX, offsetY, scale, nodeMap } = this.dm.data
    const viewport = viewportWorldRect(this.dm.data, 120)
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild)
    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute(
      'transform',
      `translate(${offsetX} ${offsetY}) scale(${scale})`,
    )
    this.svg.appendChild(group)
    for (const item of Object.values(nodeMap)) {
      const node = item.ref
      const strokes = node['x-superboard']?.strokes
      if (!strokes?.length) continue
      const rotation = node['x-superboard']?.rotation ?? 0
      if (!intersectsViewport(nodeWorldRect(node, rotation, 16), viewport)) {
        continue
      }
      const resolved = resolveNodeStyle(
        node['x-superboard']?.style as never,
      )
      const nodeGroup = document.createElementNS(SVG_NS, 'g')
      const rotate = rotation
        ? ` rotate(${rotation} ${node.width / 2} ${node.height / 2})`
        : ''
      nodeGroup.setAttribute(
        'transform',
        `translate(${node.x} ${node.y})${rotate}`,
      )
      nodeGroup.setAttribute('opacity', String(resolved.opacity))
      for (const stroke of strokes) {
        const width = resolved.borderWidth ?? stroke.size
        const pathData = this.pathFor(stroke, width)
        if (!pathData) continue
        const path = document.createElementNS(SVG_NS, 'path')
        path.setAttribute('d', pathData)
        path.setAttribute(
          'fill',
          resolved.borderColor ?? stroke.color ?? '#1d1d1d',
        )
        nodeGroup.appendChild(path)
      }
      group.appendChild(nodeGroup)
    }
  }

  private readonly dispose = () => {
    this.unsubscribe()
    this.svg.remove()
  }
}
