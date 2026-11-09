import { useEffect, useMemo, useState } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import { BoardTree } from '../shared/board/BoardTree'
import { isTreePageData } from '../shared/board/page'
import { ancestorFolderPaths, buildBoardTree } from '../shared/board/tree'
import type { BoardFile, BoardListItem } from '../shared/board/types'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'

const TREE_EXPANDED_KEY = 'superboard.tree.expanded'

function loadExpandedFolders(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(TREE_EXPANDED_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return null
  }
}

export function TreeViewerApp() {
  const data = window.__SUPERBOARD__

  if (!isTreePageData(data)) {
    return (
      <div className="sb-screen-message">
        <h1>没有找到目录数据</h1>
        <p>这个页面需要由 SuperBoard 构建脚本生成。</p>
      </div>
    )
  }

  return <TreeViewer boards={data.boards} base={data.base} />
}

function TreeViewer({ boards, base }: { boards: BoardListItem[]; base: string }) {
  const requested = new URLSearchParams(window.location.search).get('board')
  const initialSlug = boards.find((item) => item.slug === requested)?.slug ?? boards[0]?.slug ?? ''
  const [selected, setSelected] = useState(initialSlug)
  const [board, setBoard] = useState<BoardFile | null>(null)
  const [loading, setLoading] = useState(Boolean(initialSlug))
  const [error, setError] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedReady, setExpandedReady] = useState(false)

  const treeNodes = useMemo(() => buildBoardTree(boards), [boards])

  useEffect(() => {
    if (expandedReady) return
    const saved = loadExpandedFolders()
    if (saved) {
      setExpanded(saved)
    } else {
      const next = new Set<string>()
      for (const item of boards) {
        for (const path of ancestorFolderPaths(item.path)) next.add(path)
      }
      setExpanded(next)
    }
    setExpandedReady(true)
  }, [boards, expandedReady])

  useEffect(() => {
    if (!expandedReady) return
    try {
      window.localStorage.setItem(TREE_EXPANDED_KEY, JSON.stringify([...expanded]))
    } catch {
      // localStorage may be unavailable in private mode
    }
  }, [expanded, expandedReady])

  useEffect(() => {
    if (!selected) {
      setBoard(null)
      setLoading(false)
      document.title = '白板目录 · SuperBoard'
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    fetch(`${base}boards/${encodeURIComponent(selected)}.json`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`加载白板失败（${response.status}）`)
        return (await response.json()) as BoardFile
      })
      .then((next) => {
        if (cancelled) return
        setBoard(next)
        document.title = `${next.meta.title} · SuperBoard`
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
  }, [base, selected])

  function selectBoard(slug: string) {
    setSelected(slug)
    const params = new URLSearchParams(window.location.search)
    params.set('board', slug)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
  }

  function toggleFolder(path: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div className="sb-app">
      <header className="sb-toolbar">
        <div className="sb-brand">
          <span className="sb-brand-mark">SB</span>
          <span>SuperBoard</span>
        </div>

        <div className="sb-toolbar-divider" />

        <button
          className="sb-button sb-button-ghost"
          type="button"
          onClick={() => setTreeOpen((open) => !open)}
          aria-expanded={treeOpen}
          title={treeOpen ? '收起目录' : '展开目录'}
        >
          {treeOpen ? '收起目录' : '目录'}
        </button>

        <div className="sb-toolbar-divider" />

        <span className="sb-current-board">{board?.meta.title ?? '白板目录'}</span>

        <div className="sb-toolbar-spacer" />

        <a className="sb-button" href={base}>
          全部白板
        </a>
      </header>

      <div className="sb-workspace">
        {treeOpen ? (
          <aside className="sb-tree-panel">
            <div className="sb-tree-header">
              <span className="sb-tree-heading">白板目录</span>
              <span className="sb-tree-count">{boards.length}</span>
            </div>
            <div className="sb-tree-scroll">
              <BoardTree
                nodes={treeNodes}
                selectedSlug={selected}
                expanded={expanded}
                onToggle={toggleFolder}
                onSelect={selectBoard}
                emptyLabel="还没有白板"
              />
            </div>
          </aside>
        ) : null}

        <main className="sb-canvas">
          {loading ? (
            <div className="sb-canvas-empty">正在加载白板…</div>
          ) : error ? (
            <div className="sb-canvas-empty">
              <div>
                <h2>无法加载白板</h2>
                <p>{error}</p>
              </div>
            </div>
          ) : board ? (
            <TreeBoard board={board} />
          ) : (
            <div className="sb-canvas-empty">
              <div>
                <h2>目录为空</h2>
                <p>还没有可查看的白板。</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function TreeBoard({ board }: { board: BoardFile }) {
  function handleMount(editor: Editor) {
    editor.loadSnapshot(board.document)
    editor.updateInstanceState({ isReadonly: true })
    editor.zoomToFit({ animation: { duration: 0 } })
    editor.setCurrentTool('select')
  }

  return (
    <Tldraw
      key={board.meta.slug}
      hideUi
      shapeUtils={superboardShapeUtils}
      licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
      onMount={handleMount}
    />
  )
}
