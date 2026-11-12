import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { JSONCanvasViewerComponent, parser } from '../vendor/json-canvas-viewer/react/index.ts'
import type { JSONCanvas } from '../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasFrame } from '../canvas/model'
import { DirectorLayer } from './DirectorLayer'
import { DrawingLayer } from './DrawingLayer'
import { LinkSlot, TextSlot } from './NodeSlots'
import { ShapeLayer } from './ShapeLayer'
import { previewCanvas } from './fixture'

interface ViewerHandle {
  viewer?: {
    setDirectorVisible?: (visible: boolean) => void
    playDirectorFrame?: (frame: CanvasFrame, animate?: boolean) => Promise<void>
    restoreDirectorCamera?: () => void
  }
}

function PreviewApp() {
  const viewerRef = useRef<ViewerHandle>(null)
  const [directorOpen, setDirectorOpen] = useState(false)
  const frames = previewCanvas['x-superboard']?.director?.frames ?? []

  function toggleDirector() {
    const next = !directorOpen
    setDirectorOpen(next)
    viewerRef.current?.viewer?.setDirectorVisible?.(next)
  }

  async function playAll() {
    const viewer = viewerRef.current?.viewer
    if (!viewer?.playDirectorFrame) return
    for (const frame of frames) {
      await viewer.playDirectorFrame(frame, true)
    }
  }

  function stopPlayback() {
    viewerRef.current?.viewer?.restoreDirectorCamera?.()
  }

  return (
    <>
      <JSONCanvasViewerComponent
        ref={viewerRef}
        canvas={previewCanvas as unknown as JSONCanvas}
        modules={[ShapeLayer, DrawingLayer, DirectorLayer]}
        text={({ node }) => <TextSlot node={node} />}
        link={({ node }) => <LinkSlot node={node} />}
        options={{ parser }}
        theme="light"
        style={{ height: '100dvh', width: '100vw' }}
      />
      <div className="preview-controls">
        <button type="button" onClick={toggleDirector}>
          {directorOpen ? '隐藏导演幕布' : '显示导演幕布'}
        </button>
        {directorOpen ? (
          <>
            <button type="button" onClick={() => void playAll()}>
              从头播放
            </button>
            <button type="button" onClick={stopPlayback}>
              恢复镜头
            </button>
          </>
        ) : null}
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<PreviewApp />)
