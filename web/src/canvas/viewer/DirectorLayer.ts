import { BaseModule, internal, type BaseArgs } from '../../vendor/json-canvas-viewer/src/index.ts'
import i18n from '../../i18n'
import type { CanvasFrame } from '../model'

type DataManager = {
  data: {
    container: HTMLDivElement
    offsetX: number
    offsetY: number
    scale: number
  }
}

type Controller = {
  refresh: () => void
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

interface Transform {
  x: number
  y: number
  scale: number
}

const IDENTITY: Transform = { x: 0, y: 0, scale: 1 }

/**
 * Presentation framing lives outside the canvas camera: the container gets a
 * CSS transform while the editor camera stays exactly where it was. Exiting
 * playback only removes that transform, so there is nothing to restore and no
 * "board drifted left" after the rails come back.
 */
export class DirectorLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private visible = false
  private animation = 0
  private animating = false
  private currentFrame: CanvasFrame | null = null
  private applied: Transform = { ...IDENTITY }
  private readonly unsubscribe: () => void
  private readonly observer: ResizeObserver | null

  constructor(...args: BaseArgs) {
    super(...args)
    this.dm = this.container.get(internal.DataManager as never) as DataManager
    this.controller = this.container.get(internal.Controller as never) as Controller
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'sb-canvas-director-layer'
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    })
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error(i18n.t('editor:desktop.noDirectorCanvas'))
    this.ctx = ctx
    const overlays = this.dm.data.container.querySelector('.JCV-overlays')
    if (overlays) this.dm.data.container.insertBefore(this.canvas, overlays)
    else this.dm.data.container.appendChild(this.canvas)
    this.augment({
      setDirectorVisible: this.setVisible,
      playDirectorFrame: this.playFrame,
      restoreDirectorCamera: this.restoreCamera,
    })
    this.unsubscribe = this.controller.onRefresh.subscribe(this.draw)
    this.observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(this.handleResize)
    this.observer?.observe(this.dm.data.container)
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

  private readonly setVisible = (visible: boolean) => {
    this.visible = visible
    this.draw()
  }

  private readonly draw = () => {
    this.resize()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // Keep the framed view stable if the camera or the container changes while
    // a frame is on screen.
    if (this.currentFrame && !this.animating) {
      this.snapTo(this.currentFrame)
    }
    // Frames are drawn by the DOM overlay (dashed border, handles, label).
    // Painting them here as well produced a second solid outline behind every
    // frame, which read as a stray line.
    if (!this.visible) return
  }

  private readonly handleResize = () => {
    if (this.currentFrame && !this.animating) {
      this.snapTo(this.currentFrame)
    }
  }

  private targetFor(frame: CanvasFrame): Transform {
    const { container, offsetX, offsetY, scale } = this.dm.data
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    // The frame is already laid out by the editor camera; fit that on-screen
    // rectangle into the container, then translate it to the centre.
    const framedWidth = Math.max(1, frame.width * scale)
    const framedHeight = Math.max(1, frame.height * scale)
    const outer = Math.min(width / framedWidth, height / framedHeight)
    return {
      x: (width - framedWidth * outer) / 2 - (offsetX + frame.x * scale) * outer,
      y: (height - framedHeight * outer) / 2 - (offsetY + frame.y * scale) * outer,
      scale: outer,
    }
  }

  private applyTransform(next: Transform) {
    this.applied = next
    const style = this.dm.data.container.style
    style.transformOrigin = '0 0'
    style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`
  }

  private snapTo(frame: CanvasFrame) {
    this.applyTransform(this.targetFor(frame))
  }

  private readonly playFrame = (frame: CanvasFrame, animate = true) => {
    cancelAnimationFrame(this.animation)
    this.animating = false
    this.currentFrame = frame
    this.dm.data.container.classList.add('JCV-director-playing')
    const target = this.targetFor(frame)
    if (!animate) {
      this.applyTransform(target)
      return Promise.resolve()
    }

    const start = this.applied
    const duration = 420
    const started = performance.now()
    const startLog = Math.log(start.scale)
    const targetLog = Math.log(target.scale)
    this.animating = true
    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / duration)
        const eased =
          progress < 0.5
            ? 4 * progress ** 3
            : 1 - (-2 * progress + 2) ** 3 / 2
        this.applyTransform({
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          scale: Math.exp(startLog + (targetLog - startLog) * eased),
        })
        if (progress < 1) {
          this.animation = requestAnimationFrame(tick)
        } else {
          this.animating = false
          this.applyTransform(target)
          resolve()
        }
      }
      this.animation = requestAnimationFrame(tick)
    })
  }

  /** Exiting playback drops the outer transform; the camera was never touched. */
  private readonly restoreCamera = () => {
    cancelAnimationFrame(this.animation)
    this.animating = false
    this.currentFrame = null
    this.applied = { ...IDENTITY }
    const style = this.dm.data.container.style
    style.transform = ''
    style.transformOrigin = ''
    this.dm.data.container.classList.remove('JCV-director-playing')
    this.draw()
  }

  private readonly dispose = () => {
    cancelAnimationFrame(this.animation)
    this.observer?.disconnect()
    this.unsubscribe()
    this.canvas.remove()
  }
}
