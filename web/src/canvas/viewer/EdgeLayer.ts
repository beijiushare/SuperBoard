import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasEdge, CanvasNode } from '../model'
import { edgeGeometry, edgePath } from '../editor/edges'
import { viewportWorldRect } from './culling'
import { warnUnpaintedGraphics } from './paintInvariant'

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: CanvasNode }>
    edgeMap: Record<string, { ref: CanvasEdge }>
    canvasData: { edges?: CanvasEdge[] }
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export class EdgeLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly svg: SVGSVGElement
  private readonly unsubscribe: () => void

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('class', 'sb-canvas-edge-layer')
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

  private readonly draw = () => {
    const { offsetX, offsetY, scale, nodeMap } = this.dm.data
    const viewport = viewportWorldRect(this.dm.data, 200)
    const map = new Map(
      Object.values(nodeMap).map((item) => [item.ref.id, item.ref]),
    )
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild)
    const defs = document.createElementNS(SVG_NS, 'defs')
    this.svg.appendChild(defs)
    const markerIds = new Map<string, string>()
    let markerIndex = 0
    const markerFor = (color: string) => {
      const existing = markerIds.get(color)
      if (existing) return existing
      const id = `sb-edge-arrow-${markerIndex++}`
      markerIds.set(color, id)
      const marker = document.createElementNS(SVG_NS, 'marker')
      marker.setAttribute('id', id)
      marker.setAttribute('viewBox', '0 0 10 10')
      marker.setAttribute('refX', '9')
      marker.setAttribute('refY', '5')
      marker.setAttribute('markerWidth', '7')
      marker.setAttribute('markerHeight', '7')
      marker.setAttribute('orient', 'auto-start-reverse')
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z')
      path.setAttribute('fill', color)
      path.setAttribute('stroke', 'none')
      marker.appendChild(path)
      defs.appendChild(marker)
      return id
    }

    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute(
      'transform',
      `translate(${offsetX} ${offsetY}) scale(${scale})`,
    )
    this.svg.appendChild(group)
    for (const item of Object.values(this.dm.data.edgeMap)) {
      const edge = item.ref
      const from = map.get(edge.fromNode)
      const to = map.get(edge.toNode)
      if (!from || !to) continue
      const geometry = edgeGeometry(edge, map)
      if (!geometry) continue
      const box = {
        left: Math.min(geometry.start.x, geometry.end.x),
        right: Math.max(geometry.start.x, geometry.end.x),
        top: Math.min(geometry.start.y, geometry.end.y),
        bottom: Math.max(geometry.start.y, geometry.end.y),
      }
      if (
        box.right < viewport.left ||
        box.left > viewport.right ||
        box.bottom < viewport.top ||
        box.top > viewport.bottom
      ) {
        continue
      }
      const pathData = edgePath(edge, map)
      if (!pathData) continue
      const color = edge.color ?? '#1d1d1d'
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', pathData)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linecap', 'round')
      if (edge.toEnd !== 'none') {
        path.setAttribute('marker-end', `url(#${markerFor(color)})`)
      }
      if (edge.fromEnd === 'arrow') {
        path.setAttribute('marker-start', `url(#${markerFor(color)})`)
      }
      group.appendChild(path)
      if (edge.label) {
        const label = document.createElementNS(SVG_NS, 'text')
        label.setAttribute(
          'x',
          String((geometry.start.x + geometry.end.x) / 2),
        )
        label.setAttribute(
          'y',
          String((geometry.start.y + geometry.end.y) / 2 - 6),
        )
        label.setAttribute('fill', color)
        label.setAttribute('stroke', 'none')
        label.setAttribute('font-size', '13')
        label.setAttribute('text-anchor', 'middle')
        label.textContent = edge.label
        group.appendChild(label)
      }
    }
    warnUnpaintedGraphics(this.svg)
  }

  private readonly dispose = () => {
    this.unsubscribe()
    this.svg.remove()
  }
}
