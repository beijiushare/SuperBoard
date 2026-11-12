import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardListItem } from '../shared/board/types'
import { buildBoardTree } from '../shared/board/tree'
import { useTreeExpansion } from '../shared/board/useTreeExpansion'
import { BoardTreePanel } from '../shared/board/BoardTreePanel'
import { CanvasViewer, type CanvasViewerHandle } from '../canvas/viewer/CanvasViewer'
import { parseCanvas, type CanvasDocument } from '../canvas/model'
import { isTreePageData, type CanvasTreeItem } from '../shared/board/page'
import { EditorRail } from '../editor/EditorRail'
import { DirectorHud } from '../shared/director/DirectorHud'

function asBoardListItem(item: CanvasTreeItem): BoardListItem {
  return { ...item, scope: 'public' }
}

export function CanvasViewerApp() {
  const data = window.__SUPERBOARD__
  if (!data) {
    return (
      <div className="sb-screen-message">
        <h1>没有找到白板数据</h1>
        <p>这个页面需要由 SuperBoard 构建脚本生成。</p>
      </div>
    )
  }

  return isTreePageData(data) ? (
    <CanvasViewerShell items={data.canvases} base={data.base} />
  ) : (
    <CanvasViewerShell
      items={[{ ...data.canvas['x-superboard']!.meta, path: '' }]}
      base={data.base}
      initialCanvas={data.canvas}
    />
  )
}

function CanvasViewerShell({
  items,
  base,
  initialCanvas,
}: {
  items: CanvasTreeItem[]
  base: string
  initialCanvas?: CanvasDocument
}) {
  const boards = useMemo(() => items.map(asBoardListItem), [items])
  const requested = new URLSearchParams(window.location.search).get('board')
  const initialSlug = boards.find((item) => item.slug === requested)?.slug ?? boards[0]?.slug ?? ''
  const [selected, setSelected] = useState(initialSlug)
  const [canvas, setCanvas] = useState<CanvasDocument | null>(() =>
    initialCanvas?.['x-superboard']?.meta.slug === initialSlug ? initialCanvas : null,
  )
  const [loading, setLoading] = useState(Boolean(initialSlug))
  const [error, setError] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)
  const [directorOpen, setDirectorOpen] = useState(false)
  const viewerRef = useRef<CanvasViewerHandle>(null)
  const { expanded, toggleFolder } = useTreeExpansion(boards)
  const treeNodes = useMemo(() => buildBoardTree(boards), [boards])
  const frames = canvas?.['x-superboard']?.director?.frames ?? []

  useEffect(() => {
    if (!selected) {
      setCanvas(null)
      setLoading(false)
      return
    }

    if (initialCanvas?.['x-superboard']?.meta.slug === selected) {
      setCanvas(initialCanvas)
      setLoading(false)
      setError('')
      document.title = `${initialCanvas['x-superboard']!.meta.title} · SuperBoard`
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setCanvas(null)
    setDirectorOpen(false)

    fetch(`${base}boards/${encodeURIComponent(selected)}.json`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`加载白板失败（${response.status}）`)
        return parseCanvas(await response.text())
      })
      .then((next) => {
        if (cancelled) return
        setCanvas(next)
        document.title = `${next['x-superboard']?.meta.title ?? selected} · SuperBoard`
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [base, initialCanvas, selected])

  function selectBoard(slug: string) {
    if (!slug || slug === selected) return
    viewerRef.current?.viewer?.restoreDirectorCamera?.()
    setDirectorOpen(false)
    setSelected(slug)
    const params = new URLSearchParams(window.location.search)
    params.set('board', slug)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
  }

  function toggleDirector() {
    const next = !directorOpen
    setDirectorOpen(next)
    viewerRef.current?.viewer?.setDirectorVisible?.(next)
  }

  async function playAll() {
    const viewer = viewerRef.current?.viewer
    if (!viewer?.playDirectorFrame) return
    for (const frame of frames) await viewer.playDirectorFrame(frame, true)
  }

  return (
    <div className="sb-app sb-app-editor">
      <EditorRail
        mode="view"
        treeMode
        treeOpen={treeOpen}
        sidebarLabel={treeOpen ? '收起目录' : '展开目录'}
        onToggleTree={() => setTreeOpen((open) => !open)}
        directorMode={directorOpen}
        onToggleDirector={toggleDirector}
      />

      <div className="sb-workspace">
        {treeOpen ? (
          <BoardTreePanel
            nodes={treeNodes}
            title="SuperBoard-public"
            selectedSlug={selected}
            expanded={expanded}
            onToggle={toggleFolder}
            onSelect={selectBoard}
            headerMeta={<span className="sb-tree-count">{boards.length}</span>}
            emptyLabel="还没有白板"
          />
        ) : null}

        <main className="sb-canvas">
          {loading ? <div className="sb-canvas-empty">正在加载白板…</div> : null}
          {error ? (
            <div className="sb-canvas-empty">
              <div>
                <h2>无法加载白板</h2>
                <p>{error}</p>
              </div>
            </div>
          ) : null}
          {canvas ? (
            <CanvasViewer
              ref={viewerRef}
              canvas={canvas}
              style={{ width: '100%', height: '100%' }}
            />
          ) : null}
        </main>
      </div>

      {directorOpen ? (
        <DirectorHud
          onPlay={() => void playAll()}
          onExit={() => {
            viewerRef.current?.viewer?.restoreDirectorCamera?.()
            viewerRef.current?.viewer?.setDirectorVisible?.(false)
            setDirectorOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
