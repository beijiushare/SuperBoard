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

export class DirectorLayer extends BaseModule {
  private readonly dm: DataManager
  private readonly controller: Controller
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private visible = false
  private animation = 0
  private readonly unsubscribe: () => void
  private cameraBeforePlayback: { offsetX: number; offsetY: number; scale: number } | null = null

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
      captureDirectorCamera: this.captureCamera,
      getDirectorCamera: this.getCamera,
      setDirectorCamera: this.setCamera,
    })
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

  private readonly setVisible = (visible: boolean) => {
    this.visible = visible
    this.draw()
  }

  private readonly draw = () => {
    this.resize()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (!this.visible) return
    // Frames are drawn by the DOM overlay (dashed border, handles, label).
    // Painting them here as well produced a second solid outline behind every
    // frame, which read as a stray line.
  }

  private readonly playFrame = (frame: CanvasFrame, animate = true) => {
    cancelAnimationFrame(this.animation)
    const { container } = this.dm.data
    const scale = Math.min(container.clientWidth / frame.width, container.clientHeight / frame.height)
    const target = {
      offsetX: container.clientWidth / 2 - (frame.x + frame.width / 2) * scale,
      offsetY: container.clientHeight / 2 - (frame.y + frame.height / 2) * scale,
      scale,
    }
    if (!this.cameraBeforePlayback) {
      this.cameraBeforePlayback = {
        offsetX: this.dm.data.offsetX,
        offsetY: this.dm.data.offsetY,
        scale: this.dm.data.scale,
      }
    }
    if (!animate) {
      this.dm.data.offsetX = target.offsetX
      this.dm.data.offsetY = target.offsetY
      this.dm.data.scale = target.scale
      this.controller.refresh()
      this.draw()
      return Promise.resolve()
    }

    const start = {
      offsetX: this.dm.data.offsetX,
      offsetY: this.dm.data.offsetY,
      scale: this.dm.data.scale,
    }
    const duration = 420
    const started = performance.now()
    const startLog = Math.log(start.scale)
    const targetLog = Math.log(target.scale)
    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / duration)
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
        this.dm.data.offsetX = start.offsetX + (target.offsetX - start.offsetX) * eased
        this.dm.data.offsetY = start.offsetY + (target.offsetY - start.offsetY) * eased
        this.dm.data.scale = Math.exp(startLog + (targetLog - startLog) * eased)
        this.controller.refresh()
        this.draw()
        if (progress < 1) this.animation = requestAnimationFrame(tick)
        else resolve()
      }
      this.animation = requestAnimationFrame(tick)
    })
  }

  private readonly captureCamera = () => {
    this.cameraBeforePlayback = {
      offsetX: this.dm.data.offsetX,
      offsetY: this.dm.data.offsetY,
      scale: this.dm.data.scale,
    }
  }

  private readonly getCamera = () => ({
    offsetX: this.dm.data.offsetX,
    offsetY: this.dm.data.offsetY,
    scale: this.dm.data.scale,
  })

  private readonly setCamera = (camera: {
    offsetX: number
    offsetY: number
    scale: number
  }) => {
    cancelAnimationFrame(this.animation)
    this.dm.data.offsetX = camera.offsetX
    this.dm.data.offsetY = camera.offsetY
    this.dm.data.scale = camera.scale
    this.controller.refresh()
    this.draw()
  }

  private readonly restoreCamera = () => {
    cancelAnimationFrame(this.animation)
    if (!this.cameraBeforePlayback) return
    this.dm.data.offsetX = this.cameraBeforePlayback.offsetX
    this.dm.data.offsetY = this.cameraBeforePlayback.offsetY
    this.dm.data.scale = this.cameraBeforePlayback.scale
    this.cameraBeforePlayback = null
    this.controller.refresh()
    this.draw()
  }

  private readonly dispose = () => {
    cancelAnimationFrame(this.animation)
    this.unsubscribe()
    this.canvas.remove()
  }
}
