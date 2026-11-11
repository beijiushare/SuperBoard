import { createShapeId, type Editor } from 'tldraw'
import { SB_FRAME_TYPE, type SbFrameShape } from './types'

const FRAME_WIDTH = 1280
const FRAME_HEIGHT = 720

let animationFrame: number | null = null

export function getFrames(editor: Editor): SbFrameShape[] {
  return editor
    .getCurrentPageShapes()
    .filter((shape): shape is SbFrameShape => shape.type === SB_FRAME_TYPE)
    .sort((a, b) => a.props.order - b.props.order)
}

export function nextFrameOrder(editor: Editor) {
  return getFrames(editor).reduce((max, frame) => Math.max(max, frame.props.order), 0) + 1
}

export function createFrameAt(editor: Editor, point: { x: number; y: number }) {
  const id = createShapeId()
  editor.createShape<SbFrameShape>({
    id,
    type: SB_FRAME_TYPE,
    x: point.x - FRAME_WIDTH / 2,
    y: point.y - FRAME_HEIGHT / 2,
    props: { w: FRAME_WIDTH, h: FRAME_HEIGHT, order: nextFrameOrder(editor) },
  })
  editor.select(id)
  return id
}

export function cancelCameraAnimation() {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

function getTargetCamera(editor: Editor, frame: SbFrameShape) {
  const bounds = editor.getShapePageBounds(frame)
  if (!bounds) return null

  const start = editor.getCamera()
  editor.zoomToBounds(bounds, { inset: 0, force: true, immediate: true })
  const target = editor.getCamera()
  editor.setCamera(start, { force: true, immediate: true })
  return { start, target }
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function moveCameraToFrame(editor: Editor, frame: SbFrameShape, animate: boolean) {
  cancelCameraAnimation()

  if (!animate) {
    const bounds = editor.getShapePageBounds(frame)
    if (bounds) editor.zoomToBounds(bounds, { inset: 0, force: true, immediate: true })
    return
  }

  const cameras = getTargetCamera(editor, frame)
  if (!cameras) return

  const { start, target } = cameras
  const pageDistance = Math.hypot(target.x - start.x, target.y - start.y)
  const zoomDelta = Math.abs(Math.log(target.z / start.z))
  const duration = Math.min(650, Math.max(280, 280 + pageDistance * 0.06 + zoomDelta * 120))
  const startLogZoom = Math.log(start.z)
  const targetLogZoom = Math.log(target.z)
  const startedAt = performance.now()

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = easeInOutCubic(progress)
    editor.setCamera(
      {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        z: Math.exp(startLogZoom + (targetLogZoom - startLogZoom) * eased),
      },
      { force: true, immediate: true },
    )

    if (progress < 1) {
      animationFrame = requestAnimationFrame(tick)
    } else {
      animationFrame = null
    }
  }

  animationFrame = requestAnimationFrame(tick)
}
