import { useEditor, useValue } from 'tldraw'

const GRID_SIZE = 20

export function CanvasBackground() {
  const editor = useEditor()
  const camera = useValue('camera', () => editor.getCamera(), [editor])
  const size = GRID_SIZE * camera.z
  const radius = camera.z * 0.5 + 0.5

  return (
    <div
      className="sb-canvas-background"
      style={{
        backgroundImage: `radial-gradient(var(--sb-canvas-grid) ${radius}px, transparent 0)`,
        backgroundPosition: `${camera.x - size / 2}px ${camera.y - size / 2}px`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  )
}

export const superboardCanvasComponents = {
  Background: CanvasBackground,
}
