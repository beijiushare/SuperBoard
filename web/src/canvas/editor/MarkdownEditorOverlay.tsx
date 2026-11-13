import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { MarkdownVditor } from './MarkdownVditor'

type DataManager = {
  data: {
    offsetX: number
    offsetY: number
    scale: number
  }
}

type Controller = {
  onRefresh: { subscribe: (callback: () => void) => () => void }
}

type ViewerInternals = {
  container?: { get: (key: unknown) => unknown }
}

interface MarkdownEditorOverlayProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  nodeId: string
  onInput: (id: string, value: string) => void
  onCommit: (id: string, value: string) => void
  onRequestClose: () => void
}

export function MarkdownEditorOverlay({
  canvas,
  viewerRef,
  nodeId,
  onInput,
  onCommit,
  onRequestClose,
}: MarkdownEditorOverlayProps) {
  const node = canvas.nodes.find((item) => item.id === nodeId)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onRequestClose)
  const [view, setView] = useState({ offsetX: 0, offsetY: 0, scale: 1 })
  const [viewReady, setViewReady] = useState(false)
  const [tick, setTick] = useState(0)

  closeRef.current = onRequestClose

  useLayoutEffect(() => {
    let disposed = false
    let timer: number | undefined
    let unsubscribe: (() => void) | undefined
    const attach = () => {
      if (disposed) return
      const viewer = viewerRef.current?.viewer as ViewerInternals | undefined
      if (!viewer?.container) {
        timer = window.setTimeout(attach, 100)
        return
      }
      try {
        const dm = viewer.container.get(internal.DataManager as never) as DataManager
        const controller = viewer.container.get(
          internal.Controller as never,
        ) as Controller
        unsubscribe = controller.onRefresh.subscribe(() => {
          setView({
            offsetX: dm.data.offsetX,
            offsetY: dm.data.offsetY,
            scale: dm.data.scale,
          })
          setTick((value) => value + 1)
        })
        setView({
          offsetX: dm.data.offsetX,
          offsetY: dm.data.offsetY,
          scale: dm.data.scale,
        })
        setViewReady(true)
      } catch {
        timer = window.setTimeout(attach, 100)
      }
    }
    attach()
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      unsubscribe?.()
    }
  }, [viewerRef, canvas])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('.sb-md-editor, .sb-block-actions')) return
      closeRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  if (!node || node.type !== 'text') return null

  const width = Math.max(160, node.width)
  const height = Math.max(140, node.height)
  const contentScale = node['x-superboard']?.contentScale ?? 1
  const screenWidth = width * view.scale
  const screenHeight = height * view.scale
  const centerX = view.offsetX + (node.x + node.width / 2) * view.scale
  const centerY = view.offsetY + (node.y + node.height / 2) * view.scale
  const left = centerX - screenWidth / 2
  const top = centerY - screenHeight / 2
  const rotation = node['x-superboard']?.rotation ?? 0

  return (
    <div
      ref={wrapperRef}
      className={`sb-md-editor${
        node['x-superboard']?.markdownTheme
          ? ` sb-md-theme-${node['x-superboard'].markdownTheme}`
          : ''
      }`}
      data-tick={tick}
      style={{
        left,
        top,
        width: screenWidth,
        height: screenHeight,
        visibility: viewReady ? 'visible' : 'hidden',
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        className="sb-md-editor-inner"
        style={{
          width: width / contentScale,
          height: height / contentScale,
          zoom: contentScale,
          transform: `scale(${view.scale})`,
          transformOrigin: 'top left',
        }}
      >
        <MarkdownVditor
          key={nodeId}
          value={node.text}
          onInput={(value) => onInput(nodeId, value)}
          onCommit={(value) => onCommit(nodeId, value)}
          onRequestClose={onRequestClose}
        />
      </div>
    </div>
  )
}
