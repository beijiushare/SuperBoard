import { createRoot } from 'react-dom/client'
import { JSONCanvasViewerComponent, parser } from '@json-canvas-viewer/react'
import type { JSONCanvas } from 'json-canvas-viewer'
import { DrawingLayer } from './DrawingLayer'
import { LinkSlot, TextSlot } from './NodeSlots'
import { ShapeLayer } from './ShapeLayer'
import { previewCanvas } from './fixture'

createRoot(document.getElementById('root')!).render(
  <JSONCanvasViewerComponent
    canvas={previewCanvas as unknown as JSONCanvas}
    modules={[ShapeLayer, DrawingLayer]}
    text={({ node }) => <TextSlot node={node} />}
    link={({ node }) => <LinkSlot node={node} />}
    options={{ parser }}
    style={{ height: '100dvh', width: '100vw' }}
  />,
)
