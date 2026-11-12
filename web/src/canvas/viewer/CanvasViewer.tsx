import { forwardRef, type CSSProperties } from 'react'
import {
  JSONCanvasViewerComponent,
  parser,
  type JSONCanvas,
} from '../../vendor/json-canvas-viewer/react/index.ts'
import type { CanvasDocument, CanvasFrame } from '../model'
import { DirectorLayer } from './DirectorLayer'
import { DrawingLayer } from './DrawingLayer'
import { LinkSlot, TextSlot } from './NodeSlots'
import { ShapeLayer } from './ShapeLayer'

const modules = [ShapeLayer, DrawingLayer, DirectorLayer]

export interface CanvasViewerHandle {
  viewer?: {
    setDirectorVisible?: (visible: boolean) => void
    playDirectorFrame?: (frame: CanvasFrame, animate?: boolean) => Promise<void>
    restoreDirectorCamera?: () => void
  }
}

interface CanvasViewerProps {
  canvas: CanvasDocument
  theme?: 'light' | 'dark'
  className?: string
  style?: CSSProperties
  onNodeSelect?: (id: string) => void
}

export const CanvasViewer = forwardRef<CanvasViewerHandle, CanvasViewerProps>(
  function CanvasViewer({ canvas, theme = 'light', className, style, onNodeSelect }, ref) {
    return (
      <JSONCanvasViewerComponent
        ref={ref}
        canvas={canvas as unknown as JSONCanvas}
        modules={modules}
        text={({ node, onActive }) => (
          <TextSlot node={node} onActive={onActive} onSelect={onNodeSelect} />
        )}
        link={({ node, onActive }) => (
          <LinkSlot node={node} onActive={onActive} onSelect={onNodeSelect} />
        )}
        options={{ parser }}
        theme={theme}
        className={className}
        style={style}
      />
    )
  },
)
