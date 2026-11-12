import { BaseModule, internal, type BaseArgs } from 'json-canvas-viewer'
import type { SuperBoardNodeExtension } from '../canvas/model'

type ShapeNode = {
  x: number
  y: number
  width: number
  height: number
  'x-superboard'?: SuperBoardNodeExtension
}

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
    nodeMap: Record<string, { ref: ShapeNode }>
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

function dash(ctx: CanvasRenderingContext2D, values?: number[]) {
  ctx.setLineDash(values ?? [])
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export class ShapeLayer extends BaseModule {
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
    this.canvas.className = 'sb-canvas-shape-layer'
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    })
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建形状画布')
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
    const { offsetX, offsetY, scale, nodeMap, container } = this.dm.data
    const background = getComputedStyle(container).backgroundColor || '#fafafa'
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.save()
    this.ctx.translate(offsetX, offsetY)
    this.ctx.scale(scale, scale)

    for (const item of Object.values(nodeMap)) {
      const node = item.ref
      const ext = node['x-superboard']
      if (ext?.kind !== 'shape') continue
      const style = ext.style ?? {}
      const shape = ext.shape ?? 'rect'
      const opacity = style.opacity ?? 1

      this.ctx.save()
      this.ctx.globalAlpha = opacity
      this.ctx.fillStyle = background
      this.ctx.fillRect(node.x - 1, node.y - 1, node.width + 2, node.height + 2)
      this.ctx.fillStyle = style.fill && style.fill !== 'none' ? style.fill : 'transparent'
      this.ctx.strokeStyle = style.stroke ?? '#1d1d1d'
      this.ctx.lineWidth = style.strokeWidth ?? 2
      dash(this.ctx, style.strokeDash)

      if (shape === 'ellipse') {
        this.ctx.beginPath()
        this.ctx.ellipse(
          node.x + node.width / 2,
          node.y + node.height / 2,
          Math.abs(node.width / 2),
          Math.abs(node.height / 2),
          0,
          0,
          Math.PI * 2,
        )
        this.ctx.fill()
        this.ctx.stroke()
      } else if (shape === 'diamond') {
        this.ctx.beginPath()
        this.ctx.moveTo(node.x + node.width / 2, node.y)
        this.ctx.lineTo(node.x + node.width, node.y + node.height / 2)
        this.ctx.lineTo(node.x + node.width / 2, node.y + node.height)
        this.ctx.lineTo(node.x, node.y + node.height / 2)
        this.ctx.closePath()
        this.ctx.fill()
        this.ctx.stroke()
      } else if (shape === 'line') {
        this.ctx.beginPath()
        this.ctx.moveTo(node.x, node.y)
        this.ctx.lineTo(node.x + node.width, node.y + node.height)
        this.ctx.stroke()
      } else {
        roundedRect(this.ctx, node.x, node.y, node.width, node.height, style.cornerRadius ?? 8)
        this.ctx.fill()
        this.ctx.stroke()
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
