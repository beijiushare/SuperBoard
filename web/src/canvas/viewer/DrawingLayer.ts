import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import { getStroke } from 'perfect-freehand'
import type { SuperBoardStroke } from '../model'

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: { x: number; y: number; 'x-superboard'?: { strokes?: SuperBoardStroke[] } } }>
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

export class DrawingLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly unsubscribe: () => void

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'sb-canvas-drawing-layer'
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    })
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建手写画布')
    this.ctx = ctx
    const overlays = this.dm.data.container.querySelector('.JCV-overlays')
    if (overlays) this.dm.data.container.insertBefore(this.canvas, overlays)
    else this.dm.data.container.appendChild(this.canvas)
    this.unsubscribe = this.controller.onRefresh.subscribe(this.draw)
    this.onStart(this.start)
    this.onRestart(this.start)
    this.onDispose(this.dispose)
  }

  private resize() {
    const container = this.dm.data.container
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(container.clientWidth * dpr))
    const height = Math.max(1, Math.round(container.clientHeight * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private readonly start = () => {
    this.resize()
    this.draw()
  }

  private readonly draw = () => {
    this.resize()
    const { offsetX, offsetY, scale, nodeMap } = this.dm.data
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.save()
    this.ctx.translate(offsetX, offsetY)
    this.ctx.scale(scale, scale)
    for (const item of Object.values(nodeMap)) {
      const node = item.ref
      const strokes = node['x-superboard']?.strokes
      if (!strokes?.length) continue
      this.ctx.save()
      this.ctx.translate(node.x, node.y)
      for (const stroke of strokes) {
        const outline = getStroke(
          stroke.points.map(([x, y, pressure]) =>
            pressure === undefined ? [x, y] : [x, y, pressure],
          ) as number[][],
          {
            size: stroke.size,
            thinning: stroke.thinning,
            smoothing: stroke.smoothing,
            streamline: stroke.streamline,
            simulatePressure: stroke.simulatePressure,
            start: stroke.start === undefined ? undefined : { taper: stroke.start },
            end: stroke.end === undefined ? undefined : { taper: stroke.end },
          },
        )
        if (outline.length < 3) continue
        this.ctx.beginPath()
        this.ctx.moveTo(outline[0][0], outline[0][1])
        for (let index = 1; index < outline.length; index += 1) {
          this.ctx.lineTo(outline[index][0], outline[index][1])
        }
        this.ctx.closePath()
        this.ctx.fillStyle = stroke.color
        this.ctx.fill()
      }
      this.ctx.restore()
    }
    this.ctx.restore()
  }

  private readonly dispose = () => {
    this.unsubscribe()
    this.canvas.remove()
  }
}
