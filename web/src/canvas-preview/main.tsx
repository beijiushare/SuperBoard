import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { CanvasViewer, type CanvasViewerHandle } from '../canvas/viewer/CanvasViewer'
import { initI18n } from '../i18n'
import { previewCanvas } from './fixture'

function PreviewApp() {
  const { t } = useTranslation(['editor'])
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
          {directorOpen ? t('editor:preview.hideDirector') : t('editor:preview.showDirector')}
        </button>
        {directorOpen ? (
          <>
            <button type="button" onClick={() => void playAll()}>
              {t('editor:director.playFromStart')}
            </button>
            <button type="button" onClick={stopDirector}>
              {t('editor:preview.restoreCamera')}
            </button>
          </>
        ) : null}
      </div>
    </>
  )
}

void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(<PreviewApp />)
})
