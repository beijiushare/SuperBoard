import { useEffect, useRef, useState } from 'react'
import { parseCanvas, type CanvasDocument } from '../model'
import { CanvasViewer, type CanvasViewerHandle } from '../viewer/CanvasViewer'
import { CanvasEditorOverlay } from './CanvasEditorOverlay'

interface CanvasListItem {
  slug: string
  title: string
  scope: 'public' | 'private'
  path: string
  updatedAt?: string
}

export function CanvasEditorApp() {
  const [items, setItems] = useState<CanvasListItem[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [canvas, setCanvas] = useState<CanvasDocument | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(true)
  const viewerRef = useRef<CanvasViewerHandle>(null)

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
        <button type="button" onClick={() => void save()} disabled={saved}>
          {saved ? '已保存' : '保存'}
        </button>
      </header>
      <main className="canvas-editor-stage">
        <CanvasViewer
          ref={viewerRef}
          canvas={canvas}
          onNodeSelect={(id) => setSelectedId(id)}
          style={{ width: '100%', height: '100%' }}
        />
        <CanvasEditorOverlay
          canvas={canvas}
          viewerRef={viewerRef}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onChange={() => setSaved(false)}
        />
      </main>
    </div>
  )
}
