import { createShapeId, type Editor } from 'tldraw'
import { SB_FRAME_TYPE, type SbFrameShape } from './types'

const FRAME_WIDTH = 1280
const FRAME_HEIGHT = 720

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

export function moveCameraToFrame(editor: Editor, frame: SbFrameShape, animate: boolean) {
  const bounds = editor.getShapePageBounds(frame)
  if (!bounds) return

  editor.zoomToBounds(bounds, {
    inset: 0,
    force: true,
    ...(animate
      ? { animation: { duration: 280, easing: (t: number) => t } }
      : {}),
  })
}
