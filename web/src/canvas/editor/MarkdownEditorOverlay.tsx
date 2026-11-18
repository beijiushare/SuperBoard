import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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
  const innerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onRequestClose)
  const nodeRef = useRef(node)
  const viewRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 })
  const [viewReady, setViewReady] = useState(false)

  closeRef.current = onRequestClose
  nodeRef.current = node

  const applyLayout = useCallback(() => {
    const current = nodeRef.current
    const wrapper = wrapperRef.current
    const inner = innerRef.current
    if (!current || current.type !== 'text' || !wrapper || !inner) return
    const { offsetX, offsetY, scale } = viewRef.current
    const width = Math.max(160, current.width)
    const height = Math.max(140, current.height)
    const screenWidth = width * scale
    const screenHeight = height * scale
    const centerX = offsetX + (current.x + current.width / 2) * scale
    const centerY = offsetY + (current.y + current.height / 2) * scale
    const rotation = current['x-superboard']?.rotation ?? 0
    wrapper.style.left = `${centerX - screenWidth / 2}px`
    wrapper.style.top = `${centerY - screenHeight / 2}px`
    wrapper.style.width = `${screenWidth}px`
    wrapper.style.height = `${screenHeight}px`
    wrapper.style.transform = rotation ? `rotate(${rotation}deg)` : ''
    inner.style.width = `${width}px`
    inner.style.height = `${height}px`
    inner.style.transform = `scale(${scale})`
  }, [])

  useLayoutEffect(() => {
    if (viewReady) applyLayout()
  })

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
        const sync = () => {
          viewRef.current = {
            offsetX: dm.data.offsetX,
            offsetY: dm.data.offsetY,
            scale: dm.data.scale,
          }
          applyLayout()
        }
        unsubscribe = controller.onRefresh.subscribe(sync)
        sync()
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
  }, [applyLayout, nodeId, viewerRef])

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

  const contentScale = node['x-superboard']?.contentScale ?? 1

  return (
    <div
      ref={wrapperRef}
      className="sb-md-editor sb-md-docs"
      style={{
        visibility: viewReady ? 'visible' : 'hidden',
        transformOrigin: 'center center',
        ['--sb-content-scale' as string]: String(contentScale),
        ['--sb-markdown-font-size' as string]: `${16 * contentScale}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        ref={innerRef}
        className="sb-md-editor-inner"
        style={{ transformOrigin: 'top left' }}
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
