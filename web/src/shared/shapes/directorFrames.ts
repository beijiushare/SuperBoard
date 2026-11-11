import type { Editor } from 'tldraw'
import type { DirectorFrame } from '../board/types'

let animationFrame: number | null = null

export function cancelCameraAnimation() {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

function getTargetCamera(editor: Editor, frame: DirectorFrame) {
  const start = editor.getCamera()
  editor.zoomToBounds(frame, { inset: 0, force: true, immediate: true })
  const target = editor.getCamera()
  editor.setCamera(start, { force: true, immediate: true })
  return { start, target }
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function moveCameraToFrame(editor: Editor, frame: DirectorFrame, animate: boolean) {
  cancelCameraAnimation()

  if (!animate) {
    editor.zoomToBounds(frame, { inset: 0, force: true, immediate: true })
    return
  }

  const cameras = getTargetCamera(editor, frame)
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
