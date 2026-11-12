import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CanvasViewer, type CanvasViewerHandle } from '../canvas/viewer/CanvasViewer'
import { previewCanvas } from './fixture'

function PreviewApp() {
  const viewerRef = useRef<CanvasViewerHandle>(null)
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

  function stopDirector() {
    viewerRef.current?.viewer?.restoreDirectorCamera?.()
  }

  return (
    <>
      <CanvasViewer
        ref={viewerRef}
        canvas={previewCanvas}
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
            <button type="button" onClick={stopDirector}>
              恢复镜头
            </button>
          </>
        ) : null}
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<PreviewApp />)
