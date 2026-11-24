import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react'
import {
  Controls,
  JSONCanvasViewerComponent,
  Minimap,
  parser,
  type Hook,
  type JSONCanvas,
  type JSONCanvasFileNode,
  type JSONCanvasLinkNode,
  type JSONCanvasTextNode,
} from '../../vendor/json-canvas-viewer/react/index.ts'
import type {
  CanvasDocument,
  CanvasFrame,
  SuperBoardScheduleEvent,
  SuperBoardTreeData,
} from '../model'
import { DirectorLayer } from './DirectorLayer'
import { DrawingLayer } from './DrawingLayer'
import { EdgeLayer } from './EdgeLayer'
import { GridLayer } from './GridLayer'
import { GroupLayer } from './GroupLayer'
import { FileSlot, LinkSlot, TextSlot } from './NodeSlots'
import { ShapeLayer } from './ShapeLayer'

const modules = [Controls, Minimap, GridLayer, EdgeLayer, ShapeLayer, DrawingLayer, GroupLayer, DirectorLayer]

export interface CanvasViewerHandle {
  viewer?: {
    container?: { get: (key: unknown) => unknown }
    refresh?: () => void
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
  onScheduleEventsChange?: (
    id: string,
    events: SuperBoardScheduleEvent[],
  ) => void
  onTreeSize?: (id: string, size: { width: number; height: number }) => void
  onTreeChange?: (id: string, data: SuperBoardTreeData) => void
}

export const CanvasViewer = forwardRef<CanvasViewerHandle, CanvasViewerProps>(
  function CanvasViewer({
    canvas,
    theme = 'light',
    className,
    style,
    onNodeSelect,
    onScheduleEventsChange,
    onTreeSize,
    onTreeChange,
  }, ref) {
    const onNodeSelectRef = useRef(onNodeSelect)
    const onScheduleEventsChangeRef = useRef(onScheduleEventsChange)
    const onTreeSizeRef = useRef(onTreeSize)
    const onTreeChangeRef = useRef(onTreeChange)
    onNodeSelectRef.current = onNodeSelect
    onScheduleEventsChangeRef.current = onScheduleEventsChange
    onTreeSizeRef.current = onTreeSize
    onTreeChangeRef.current = onTreeChange

    const options = useMemo(
      () => ({
        parser,
        controlsCollapsed: true,
        minimapCollapsed: true,
        pointeract: {
          proControlSchema: true,
        },
      }),
      [],
    )
    const renderText = useCallback(
      ({ node, onActive }: { node: JSONCanvasTextNode; onActive: Hook }) => (
        <TextSlot
          node={node}
          onActive={onActive}
          onSelect={(id) => onNodeSelectRef.current?.(id)}
          onScheduleEventsChange={(events) =>
            onScheduleEventsChangeRef.current?.(node.id, events)
          }
          onTreeSize={(size) => onTreeSizeRef.current?.(node.id, size)}
          onTreeChange={(data) => onTreeChangeRef.current?.(node.id, data)}
        />
      ),
      [],
    )
    const renderLink = useCallback(
      ({ node, onActive }: { node: JSONCanvasLinkNode; onActive: Hook }) => (
        <LinkSlot
          node={node}
          onActive={onActive}
          onSelect={(id) => onNodeSelectRef.current?.(id)}
        />
      ),
      [],
    )
    const renderFile = useCallback(
      ({ node, onActive }: { node: JSONCanvasFileNode; onActive: Hook }) => (
        <FileSlot
          node={node}
          onActive={onActive}
          onSelect={(id) => onNodeSelectRef.current?.(id)}
        />
      ),
      [],
    )

    return (
      <JSONCanvasViewerComponent
        ref={ref}
        canvas={canvas as unknown as JSONCanvas}
        modules={modules}
        text={renderText}
        link={renderLink}
        file={renderFile}
        options={options}
        theme={theme}
        className={className}
        style={style}
      />
    )
  },
)
