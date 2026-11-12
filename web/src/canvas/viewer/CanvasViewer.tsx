import { forwardRef, useCallback, useMemo, type CSSProperties } from 'react'
import {
  Controls,
  JSONCanvasViewerComponent,
  Minimap,
  parser,
  type Hook,
  type JSONCanvas,
  type JSONCanvasLinkNode,
  type JSONCanvasTextNode,
} from '../../vendor/json-canvas-viewer/react/index.ts'
import type { CanvasDocument, CanvasFrame } from '../model'
import { DirectorLayer } from './DirectorLayer'
import { DrawingLayer } from './DrawingLayer'
import { LinkSlot, TextSlot } from './NodeSlots'
import { ShapeLayer } from './ShapeLayer'

const modules = [Controls, Minimap, ShapeLayer, DrawingLayer, DirectorLayer]

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
    const options = useMemo(() => ({ parser }), [])
    const renderText = useCallback(
      ({ node, onActive }: { node: JSONCanvasTextNode; onActive: Hook }) => (
        <TextSlot node={node} onActive={onActive} onSelect={onNodeSelect} />
      ),
      [onNodeSelect],
    )
    const renderLink = useCallback(
      ({ node, onActive }: { node: JSONCanvasLinkNode; onActive: Hook }) => (
        <LinkSlot node={node} onActive={onActive} onSelect={onNodeSelect} />
      ),
      [onNodeSelect],
    )

    return (
      <JSONCanvasViewerComponent
        ref={ref}
        canvas={canvas as unknown as JSONCanvas}
        modules={modules}
        text={renderText}
        link={renderLink}
        options={options}
        theme={theme}
        className={className}
        style={style}
      />
    )
  },
)
