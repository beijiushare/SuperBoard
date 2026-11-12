import { useCallback, useEffect, useRef, useState } from 'react'
import { internal } from '../../vendor/json-canvas-viewer/src/index.ts'
import {
  parseCanvas,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
} from '../model'
import { CanvasViewer, type CanvasViewerHandle } from '../viewer/CanvasViewer'
import { CanvasEditorOverlay } from './CanvasEditorOverlay'

interface CanvasListItem {
  slug: string
  title: string
  scope: 'public' | 'private'
  path: string
  updatedAt?: string
}

interface Viewport {
  offsetX: number
  offsetY: number
  scale: number
}

interface Clipboard {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

type ViewerInternals = {
  container?: { get: (key: unknown) => unknown }
}

type DataManagerLike = {
  data: Viewport
}

type ControllerLike = {
  refresh: () => void
}

const HISTORY_LIMIT = 100
const PASTE_OFFSET = 24

function readViewport(handle: CanvasViewerHandle | null): Viewport | null {
  try {
    const viewer = handle?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return null
    const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    return { offsetX: dm.data.offsetX, offsetY: dm.data.offsetY, scale: dm.data.scale }
  } catch {
    return null
  }
}

function writeViewport(handle: CanvasViewerHandle | null, viewport: Viewport) {
  try {
    const viewer = handle?.viewer as ViewerInternals | undefined
    if (!viewer?.container) return
    const dm = viewer.container.get(internal.DataManager as never) as DataManagerLike
    const controller = viewer.container.get(internal.Controller as never) as ControllerLike
    dm.data.offsetX = viewport.offsetX
    dm.data.offsetY = viewport.offsetY
    dm.data.scale = viewport.scale
    controller.refresh()
  } catch {
    // 查看器尚未挂载，忽略
  }
}

function nextId(existing: Set<string>, base: string) {
  let id = `${base}-copy`
  let index = 1
  while (existing.has(id)) {
    index += 1
    id = `${base}-copy-${index}`
  }
  existing.add(id)
  return id
}

export function CanvasEditorApp() {
  const [items, setItems] = useState<CanvasListItem[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [canvas, setCanvas] = useState<CanvasDocument | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(true)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const viewerRef = useRef<CanvasViewerHandle>(null)
  const shiftRef = useRef(false)
  const historyRef = useRef<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const clipboardRef = useRef<Clipboard | null>(null)
  const pasteCountRef = useRef(0)
  const pendingViewportRef = useRef<Viewport | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      shiftRef.current = event.shiftKey
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      if (!shiftRef.current) return [id]
      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/__canvases')
      .then((response) => response.json())
      .then((data: { canvases: CanvasListItem[] }) => {
        if (cancelled) return
        const list = data.canvases ?? []
        setItems(list)
        const requested = new URLSearchParams(window.location.search).get('board')
        const first = list.find((item) => item.slug === requested) ?? list[0]
        if (!first) {
          setLoading(false)
          return
        }
        setSelectedSlug(first.slug)
        return fetch(`/__canvases/${encodeURIComponent(first.slug)}?scope=${first.scope}`)
          .then((response) => response.text())
          .then((text) => parseCanvas(text))
          .then((next) => {
            if (!cancelled) {
              historyRef.current = { past: [], future: [] }
              setHistoryState({ canUndo: false, canRedo: false })
              setCanvas(next)
              setLoading(false)
            }
          })
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const viewport = pendingViewportRef.current
    if (!viewport) return
    pendingViewportRef.current = null
    writeViewport(viewerRef.current, viewport)
  }, [canvas])

  function syncHistoryState() {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    })
  }

  function recordHistory() {
    if (!canvas) return
    const history = historyRef.current
    history.past.push(structuredClone(canvas))
    if (history.past.length > HISTORY_LIMIT) history.past.shift()
    history.future.length = 0
    syncHistoryState()
  }

  function applyDocument(next: CanvasDocument) {
    pendingViewportRef.current = readViewport(viewerRef.current)
    setSelectedIds([])
    setCanvas(next)
    setSaved(false)
  }

  function undo() {
    if (!canvas) return
    const history = historyRef.current
    const previous = history.past.pop()
    if (!previous) return
    history.future.push(structuredClone(canvas))
    syncHistoryState()
    applyDocument(previous)
  }

  function redo() {
    if (!canvas) return
    const history = historyRef.current
    const next = history.future.pop()
    if (!next) return
    history.past.push(structuredClone(canvas))
    syncHistoryState()
    applyDocument(next)
  }

  function copySelection() {
    if (!canvas || selectedIds.length === 0) return
    const ids = new Set(selectedIds)
    clipboardRef.current = {
      nodes: canvas.nodes.filter((node) => ids.has(node.id)).map((node) => structuredClone(node)),
      edges: canvas.edges
        .filter((edge) => ids.has(edge.fromNode) && ids.has(edge.toNode))
        .map((edge) => structuredClone(edge)),
    }
    pasteCountRef.current = 0
  }

  function pasteClipboard() {
    if (!canvas || !clipboardRef.current) return
    const clipboard = clipboardRef.current
    recordHistory()
    pasteCountRef.current += 1
    const offset = PASTE_OFFSET * pasteCountRef.current
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const idMap = new Map<string, string>()
    const nodes = clipboard.nodes.map((node) => {
      const clone = structuredClone(node)
      clone.id = nextId(existing, node.id)
      clone.x = node.x + offset
      clone.y = node.y + offset
      idMap.set(node.id, clone.id)
      return clone
    })
    const edges = clipboard.edges.map((edge) => {
      const clone = structuredClone(edge)
      clone.id = nextId(existing, edge.id)
      clone.fromNode = idMap.get(edge.fromNode) ?? edge.fromNode
      clone.toNode = idMap.get(edge.toNode) ?? edge.toNode
      return clone
    })
    applyDocument({
      ...canvas,
      nodes: [...canvas.nodes, ...nodes],
      edges: [...canvas.edges, ...edges],
    })
    if (nodes.length > 0) setSelectedIds(nodes.map((node) => node.id))
  }

  function duplicateSelection() {
    copySelection()
    pasteClipboard()
  }

  function deleteSelection() {
    if (!canvas || selectedIds.length === 0) return
    const ids = new Set(selectedIds)
    recordHistory()
    applyDocument({
      ...canvas,
      nodes: canvas.nodes.filter((node) => !ids.has(node.id)),
      edges: canvas.edges.filter(
        (edge) => !ids.has(edge.fromNode) && !ids.has(edge.toNode),
      ),
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (mod && key === 'c') {
        copySelection()
        return
      }
      if (mod && key === 'v') {
        event.preventDefault()
        pasteClipboard()
        return
      }
      if (mod && key === 'd') {
        event.preventDefault()
        duplicateSelection()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelection()
        return
      }
      if (event.key === 'Escape') setSelectedIds([])
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  async function save() {
    if (!canvas) return
    const meta = canvas['x-superboard']?.meta
    if (!meta) return
    const item = items.find((entry) => entry.slug === selectedSlug)
    if (!item) return
    const response = await fetch(
      `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canvas),
      },
    )
    if (!response.ok) {
      setError(`保存失败（${response.status}）`)
      return
    }
    setSaved(true)
  }

  if (loading) return <div className="sb-screen-message">正在加载画布…</div>
  if (error) {
    return (
      <div className="sb-screen-message">
        <h1>无法打开画布</h1>
        <p>{error}</p>
      </div>
    )
  }
  if (!canvas) {
    return (
      <div className="sb-screen-message">
        <h1>还没有 .canvas</h1>
        <p>先运行 `npm run convert:canvas` 或在 `whiteboards/` 中放入 `.canvas` 文件。</p>
      </div>
    )
  }

  return (
    <div className="canvas-editor">
      <header className="canvas-editor-toolbar">
        <strong>{canvas['x-superboard']?.meta.title}</strong>
        <span className="canvas-editor-meta">{selectedSlug}</span>
        <div className="canvas-editor-actions">
          <button type="button" onClick={undo} disabled={!historyState.canUndo}>
            撤销
          </button>
          <button type="button" onClick={redo} disabled={!historyState.canRedo}>
            重做
          </button>
          <button type="button" onClick={() => void save()} disabled={saved}>
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </header>
      <main className="canvas-editor-stage">
        <CanvasViewer
          ref={viewerRef}
          canvas={canvas}
          onNodeSelect={handleNodeSelect}
          style={{ width: '100%', height: '100%' }}
        />
        <CanvasEditorOverlay
          canvas={canvas}
          viewerRef={viewerRef}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onChange={() => setSaved(false)}
          onBeforeChange={recordHistory}
        />
      </main>
    </div>
  )
}
