import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type Vditor from 'vditor'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import type { CanvasDocument } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'

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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<Vditor | null>(null)
  const valueRef = useRef('')
  const dirtyRef = useRef(false)
  const closeRef = useRef(onRequestClose)
  const inputRef = useRef(onInput)
  const commitRef = useRef(onCommit)
  const [view, setView] = useState({ offsetX: 0, offsetY: 0, scale: 1 })
  const [tick, setTick] = useState(0)

  closeRef.current = onRequestClose
  inputRef.current = onInput
  commitRef.current = onCommit

  const node = canvas.nodes.find((item) => item.id === nodeId)

  useLayoutEffect(() => {
    const overlay = document.getElementById(nodeId)
    overlay?.classList.add('sb-md-editing-hidden')
    return () => {
      window.setTimeout(() => {
        overlay?.classList.remove('sb-md-editing-hidden')
      }, 320)
    }
  }, [nodeId])

  useEffect(() => {
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
    if (!node || node.type !== 'text' || !editorRef.current) return
    let debounce: number | undefined
    let cancelled = false
    const element = editorRef.current
    valueRef.current = node.text
    dirtyRef.current = false
    void import('vditor').then(async ({ default: VditorClass }) => {
      await import('vditor/dist/index.css')
      if (cancelled || !element) return
      const vditor = new VditorClass(element, {
        cdn: '/__vditor',
        mode: 'ir',
        value: node.text,
        height: '100%',
        minHeight: 40,
        toolbar: [],
        counter: { enable: false },
        cache: { enable: false },
        outline: { enable: false, position: 'left' },
        preview: {
          markdown: {
            inlineMath: false,
            mathBlockPreview: false,
          },
        },
        input: (value) => {
          valueRef.current = value
          dirtyRef.current = true
          if (debounce) window.clearTimeout(debounce)
          debounce = window.setTimeout(() => {
            inputRef.current(nodeId, value)
          }, 350)
        },
        after: () => {
          window.setTimeout(() => {
            vditorRef.current?.focus()
            const ir = element.querySelector('.vditor-ir') as HTMLElement | null
            if (ir) ir.scrollTop = 0
          }, 0)
        },
      })
      vditorRef.current = vditor
    })
    return () => {
      cancelled = true
      if (debounce) window.clearTimeout(debounce)
      const value = valueRef.current
      const dirty = dirtyRef.current
      const vditor = vditorRef.current
      vditorRef.current = null
      try {
        vditor?.destroy()
      } catch (error) {
        console.error('[SuperBoard] 销毁 Vditor 失败', error)
      }
      if (dirty) {
        window.setTimeout(() => {
          try {
            commitRef.current(nodeId, value)
          } catch (error) {
            console.error('[SuperBoard] 提交 Markdown 失败', error)
          }
        }, 0)
      }
    }
  }, [nodeId])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('.sb-md-editor, .sb-block-actions')) return
      event.preventDefault()
      event.stopPropagation()
      closeRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  if (!node) return null

  const width = Math.max(160, node.width)
  const height = Math.max(140, node.height)
  const contentScale = node['x-superboard']?.contentScale ?? 1
  const screenWidth = width * view.scale
  const screenHeight = height * view.scale
  const centerX = view.offsetX + (node.x + node.width / 2) * view.scale
  const centerY = view.offsetY + (node.y + node.height / 2) * view.scale
  const left = centerX - screenWidth / 2
  const top = centerY - screenHeight / 2

  return (
    <div
      ref={wrapperRef}
      className="sb-md-editor"
      data-tick={tick}
      style={{
        left,
        top,
        width: screenWidth,
        height: screenHeight,
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
        <div ref={editorRef} style={{ height: '100%' }} />
      </div>
    </div>
  )
}
