import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import { DEFAULT_PREFERENCES } from '../editor/preferences'
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

const SVG_NS = 'http://www.w3.org/2000/svg'

export class ShapeLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly svg: SVGSVGElement
  private readonly unsubscribe: () => void

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('class', 'sb-canvas-shape-layer')
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
    this.onStart(this.draw)
    this.onRestart(this.draw)
    this.onDispose(this.dispose)
  }

  private createShape(
    node: ShapeNode,
    shape: SuperBoardShapeKind,
    radius: number,
    borderWidth: number,
  ) {
    // Draw the stroke inside the node bounds so thick borders follow the same
    // rounded corner instead of collapsing into spikes at the corners.
    const inset = Math.max(0, borderWidth) / 2
    const innerWidth = Math.max(0, node.width - inset * 2)
    const innerHeight = Math.max(0, node.height - inset * 2)
    if (shape === 'ellipse') {
      const element = document.createElementNS(SVG_NS, 'ellipse')
      element.setAttribute('cx', String(node.width / 2))
      element.setAttribute('cy', String(node.height / 2))
      element.setAttribute('rx', String(Math.abs(innerWidth / 2)))
      element.setAttribute('ry', String(Math.abs(innerHeight / 2)))
      return element
    }
    if (shape === 'diamond') {
      const element = document.createElementNS(SVG_NS, 'polygon')
      element.setAttribute(
        'points',
        [
          `${node.width / 2},0`,
          `${node.width},${node.height / 2}`,
          `${node.width / 2},${node.height}`,
          `0,${node.height / 2}`,
        ].join(' '),
      )
      return element
    }
    if (shape === 'line') {
      const flip = node['x-superboard']?.lineFlip
      const element = document.createElementNS(SVG_NS, 'line')
      element.setAttribute('x1', String(flip?.x ? node.width : 0))
      element.setAttribute('y1', String(flip?.y ? node.height : 0))
      element.setAttribute('x2', String(flip?.x ? 0 : node.width))
      element.setAttribute('y2', String(flip?.y ? 0 : node.height))
      return element
    }
    const element = document.createElementNS(SVG_NS, 'rect')
    element.setAttribute('x', String(inset))
    element.setAttribute('y', String(inset))
    element.setAttribute('width', String(innerWidth))
    element.setAttribute('height', String(innerHeight))
    if (radius > 0) {
      element.setAttribute(
        'rx',
        String(Math.max(0, Math.min(radius - inset, innerWidth / 2, innerHeight / 2))),
      )
    }
    return element
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
      const ext = node['x-superboard']
      if (ext?.kind !== 'shape') continue
      const style = resolveNodeStyle(ext.style)
      const blockDefaults = DEFAULT_PREFERENCES.block
      const shape = ext.shape ?? 'rect'
      const rotation = ext.rotation ?? 0
      if (
        !intersectsViewport(
          nodeWorldRect(node, rotation, Math.max(4, style.borderWidth ?? 1)),
          viewport,
        )
      ) {
        continue
      }
      const background = style.background ?? blockDefaults.backgroundColor
      const backgroundOpacity = style.background
        ? style.backgroundOpacity
        : blockDefaults.backgroundOpacity
      const borderColor = style.borderColor ?? blockDefaults.borderColor
      const borderWidth = style.borderWidth ?? blockDefaults.borderWidth
      const borderOpacity = style.borderColor
        ? style.borderOpacity
        : blockDefaults.borderOpacity
      const dash =
        style.borderColor
          ? style.borderDash
          : blockDefaults.borderStyle === 'dashed'
            ? [7, 4]
            : blockDefaults.borderStyle === 'dotted'
              ? [2, 4]
              : undefined
      const nodeGroup = document.createElementNS(SVG_NS, 'g')
      const rotate = rotation
        ? ` rotate(${rotation} ${node.width / 2} ${node.height / 2})`
        : ''
      nodeGroup.setAttribute(
        'transform',
        `translate(${node.x} ${node.y})${rotate}`,
      )
      const element = this.createShape(
        node,
        shape,
        style.cornerRadius ??
          (shape === 'rect' ? DEFAULT_PREFERENCES.shapeCornerRadius : 0),
        borderWidth,
      )
      element.setAttribute(
        'fill',
        background && background !== 'none' ? background : 'transparent',
      )
      element.setAttribute('fill-opacity', String(style.opacity * backgroundOpacity))
      element.setAttribute('stroke', borderColor)
      element.setAttribute('stroke-opacity', String(style.opacity * borderOpacity))
      element.setAttribute('stroke-width', String(borderWidth))
      if (dash?.length) element.setAttribute('stroke-dasharray', dash.join(' '))
      nodeGroup.appendChild(element)
      group.appendChild(nodeGroup)
    }
  }

  private readonly dispose = () => {
    this.unsubscribe()
    this.svg.remove()
  }
}
