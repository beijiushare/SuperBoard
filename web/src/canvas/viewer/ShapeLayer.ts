import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import {
  resolveNodeStyle,
  type SuperBoardNodeExtension,
  type SuperBoardShapeKind,
} from '../model'
import { intersectsViewport, nodeWorldRect, viewportWorldRect } from './culling'

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

interface CachedShapePath {
  x: number
  y: number
  width: number
  height: number
  shape: SuperBoardShapeKind
  cornerRadius: number
  flipX: boolean
  flipY: boolean
  path: Path2D
}

function dash(ctx: CanvasRenderingContext2D, values?: number[]) {
  ctx.setLineDash(values ?? [])
}

function roundedRectPath(
  path: Path2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  path.moveTo(x + r, y)
  path.lineTo(x + width - r, y)
  path.quadraticCurveTo(x + width, y, x + width, y + r)
  path.lineTo(x + width, y + height - r)
  path.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  path.lineTo(x + r, y + height)
  path.quadraticCurveTo(x, y + height, x, y + height - r)
  path.lineTo(x, y + r)
  path.quadraticCurveTo(x, y, x + r, y)
  path.closePath()
}

function buildShapePath(
  node: ShapeNode,
  extension: SuperBoardNodeExtension,
  shape: SuperBoardShapeKind,
  cornerRadius: number,
) {
  const path = new Path2D()
  if (shape === 'ellipse') {
    path.ellipse(
      node.x + node.width / 2,
      node.y + node.height / 2,
      Math.abs(node.width / 2),
      Math.abs(node.height / 2),
      0,
      0,
      Math.PI * 2,
    )
  } else if (shape === 'diamond') {
    path.moveTo(node.x + node.width / 2, node.y)
    path.lineTo(node.x + node.width, node.y + node.height / 2)
    path.lineTo(node.x + node.width / 2, node.y + node.height)
    path.lineTo(node.x, node.y + node.height / 2)
    path.closePath()
  } else if (shape === 'line') {
    const flip = extension.lineFlip
    path.moveTo(
      node.x + (flip?.x ? node.width : 0),
      node.y + (flip?.y ? node.height : 0),
    )
    path.lineTo(
      node.x + (flip?.x ? 0 : node.width),
      node.y + (flip?.y ? 0 : node.height),
    )
  } else {
    roundedRectPath(
      path,
      node.x,
      node.y,
      node.width,
      node.height,
      cornerRadius,
    )
  }
  return path
}

export class ShapeLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly unsubscribe: () => void
  private readonly pathCache = new WeakMap<ShapeNode, CachedShapePath>()

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

  private shapePath(
    node: ShapeNode,
    extension: SuperBoardNodeExtension,
    shape: SuperBoardShapeKind,
    cornerRadius: number,
  ) {
    const flipX = extension.lineFlip?.x ?? false
    const flipY = extension.lineFlip?.y ?? false
    const cached = this.pathCache.get(node)
    if (
      cached &&
      cached.x === node.x &&
      cached.y === node.y &&
      cached.width === node.width &&
      cached.height === node.height &&
      cached.shape === shape &&
      cached.cornerRadius === cornerRadius &&
      cached.flipX === flipX &&
      cached.flipY === flipY
    ) {
      return cached.path
    }
    const path = buildShapePath(node, extension, shape, cornerRadius)
    this.pathCache.set(node, {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      shape,
      cornerRadius,
      flipX,
      flipY,
      path,
    })
    return path
  }

  private readonly draw = () => {
    this.resize()
    const { offsetX, offsetY, scale, nodeMap } = this.dm.data
    const viewport = viewportWorldRect(this.dm.data, 120)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.save()
    this.ctx.translate(offsetX, offsetY)
    this.ctx.scale(scale, scale)

    for (const item of Object.values(nodeMap)) {
      const node = item.ref
      const ext = node['x-superboard']
      if (ext?.kind !== 'shape') continue
      const style = resolveNodeStyle(ext.style)
      const shape = ext.shape ?? 'rect'
      const rotation = ext.rotation ?? 0
      const strokeWidth = style.borderWidth ?? 2
      if (
        !intersectsViewport(
          nodeWorldRect(node, rotation, Math.max(4, strokeWidth)),
          viewport,
        )
      ) {
        continue
      }
      const fillAlpha = style.opacity * style.backgroundOpacity
      const strokeAlpha = style.opacity * style.borderOpacity

      this.ctx.save()
      if (rotation) {
        const centerX = node.x + node.width / 2
        const centerY = node.y + node.height / 2
        this.ctx.translate(centerX, centerY)
        this.ctx.rotate((rotation * Math.PI) / 180)
        this.ctx.translate(-centerX, -centerY)
      }
      this.ctx.fillStyle =
        style.background && style.background !== 'none'
          ? style.background
          : 'transparent'
      this.ctx.strokeStyle = style.borderColor ?? '#1d1d1d'
      this.ctx.lineWidth = strokeWidth
      dash(this.ctx, style.borderDash)

      const path = this.shapePath(
        node,
        ext,
        shape,
        style.cornerRadius ?? 8,
      )
      if (shape === 'line') {
        this.ctx.globalAlpha = strokeAlpha
        this.ctx.stroke(path)
      } else {
        this.ctx.globalAlpha = fillAlpha
        this.ctx.fill(path)
        this.ctx.globalAlpha = strokeAlpha
        this.ctx.stroke(path)
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
