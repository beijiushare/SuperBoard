import { createRoot } from 'react-dom/client'
import { JSONCanvasViewerComponent, parser } from '@json-canvas-viewer/react'
import type { JSONCanvas } from 'json-canvas-viewer'
import { previewCanvas } from './fixture'

createRoot(document.getElementById('root')!).render(
  <JSONCanvasViewerComponent
    canvas={previewCanvas as unknown as JSONCanvas}
    options={{ parser }}
    style={{ height: '100dvh', width: '100vw' }}
  />,
)
