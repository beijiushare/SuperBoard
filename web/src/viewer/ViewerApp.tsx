import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Editor } from 'tldraw'
import { isTreePageData } from '../shared/board/page'
import type { BoardFile, BoardListItem } from '../shared/board/types'
import { BoardTreePanel } from '../shared/board/BoardTreePanel'
import { buildBoardTree } from '../shared/board/tree'
import { useTreeExpansion } from '../shared/board/useTreeExpansion'
import { DirectorHud } from '../shared/director/DirectorHud'
import { PresentationOverlay } from '../shared/director/PresentationOverlay'
import { useDirectorPresentation } from '../shared/director/useDirectorPresentation'
import { EditorCanvas } from '../editor/EditorCanvas'
import { EditorRail } from '../editor/EditorRail'
import { DirectorOverlay } from '../editor/DirectorOverlay'

function boardListItem(board: BoardFile): BoardListItem {
  return {
    slug: board.meta.slug,
    title: board.meta.title,
    summary: board.meta.summary,
    order: board.meta.order,
    updatedAt: board.meta.updatedAt,
    path: '',
    scope: 'public',
  }
}

export function ViewerApp() {
  const data = window.__SUPERBOARD__

  if (!data) {
    return (
      <div className="sb-screen-message">
        <h1>没有找到白板数据</h1>
        <p>这个页面需要由 SuperBoard 构建脚本生成。</p>
      </div>
    )
  }

  if (isTreePageData(data)) {
    return <ViewerShell boards={data.boards} base={data.base} />
  }

  return <ViewerShell boards={[boardListItem(data.board)]} base={data.base} initialBoard={data.board} />
}

function ViewerShell({
  boards,
  base,
  initialBoard,
}: {
  boards: BoardListItem[]
  base: string
  initialBoard?: BoardFile
}) {
  const requested = new URLSearchParams(window.location.search).get('board')
  const initialSlug = boards.find((item) => item.slug === requested)?.slug ?? boards[0]?.slug ?? ''
  const [selected, setSelected] = useState(initialSlug)
  const [board, setBoard] = useState<BoardFile | null>(() =>
    initialBoard?.meta.slug === initialSlug ? initialBoard : null,
  )
  const [loading, setLoading] = useState(Boolean(initialSlug))
  const [error, setError] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)
  const [directorMode, setDirectorMode] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const appRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const boardRef = useRef<BoardFile | null>(board)
  boardRef.current = board
  const frames = useMemo(() => [...(board?.director?.frames ?? [])], [board?.director?.frames])
  const { expanded, toggleFolder } = useTreeExpansion(boards)
  const treeNodes = useMemo(() => buildBoardTree(boards), [boards])
  const {
    presentation,
    presentationMenu,
    setPresentationMenu,
    startPresentation,
    exitPresentation,
    advancePresentation,
  } = useDirectorPresentation({
    appRef,
    editorRef,
    frames,
    setDirectorMode,
  })

  useEffect(() => {
    if (!selected) {
      setBoard(null)
      setLoading(false)
      setEditorReady(false)
      return
    }

    if (initialBoard?.meta.slug === selected) {
      setBoard(initialBoard)
      setLoading(false)
      setError('')
      setEditorReady(false)
      document.title = `${initialBoard.meta.title} · SuperBoard`
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setBoard(null)
    setEditorReady(false)

    fetch(`${base}boards/${encodeURIComponent(selected)}.json`, {
      headers: { Accept: 'application/json' },
    })
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
  }, [base, initialBoard, selected])

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    const current = boardRef.current
    if (current) editor.loadSnapshot(current.document)
    editor.updateInstanceState({ isReadonly: true })
    editor.zoomToFit({ animation: { duration: 0 } })
    editor.setCurrentTool('select')
    setEditorReady(true)
  }, [])

  function selectBoard(slug: string) {
    if (!slug || slug === selected) {
      if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
      return
    }
    setDirectorMode(false)
    exitPresentation()
    setSelected(slug)
    const params = new URLSearchParams(window.location.search)
    params.set('board', slug)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
  }

  let emptyState: ReactNode = null
  if (loading) {
    emptyState = <div className="sb-canvas-empty">正在加载白板…</div>
  } else if (error) {
    emptyState = (
      <div className="sb-canvas-empty">
        <div>
          <h2>无法加载白板</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  } else {
    emptyState = (
      <div className="sb-canvas-empty">
        <div>
          <h2>目录为空</h2>
          <p>还没有可查看的白板。</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={appRef}
      className={`sb-app sb-app-editor${directorMode ? ' is-director-mode' : ''}${presentation ? ' is-presenting' : ''}`}
    >
      <EditorRail
        mode="view"
        treeMode
        treeOpen={treeOpen}
        sidebarLabel={treeOpen ? '收起目录' : '展开目录'}
        onToggleTree={() => setTreeOpen((open) => !open)}
        directorMode={directorMode}
        onToggleDirector={() => setDirectorMode((open) => !open)}
      />

      <div className="sb-workspace">
        {treeOpen ? (
          <BoardTreePanel
            nodes={treeNodes}
            title="SuperBoard-public"
            selectedSlug={board?.meta.slug}
            expanded={expanded}
            onToggle={toggleFolder}
            onSelect={selectBoard}
            headerMeta={<span className="sb-tree-count">{boards.length}</span>}
            emptyLabel="还没有白板"
          />
        ) : null}

        <EditorCanvas
          board={board}
          scope="public"
          readOnly
          emptyState={emptyState}
          uiState={{ stylePanelOpen: false, menuPanelOpen: false }}
          overlay={
            directorMode && !presentation && editorReady && editorRef.current ? (
              <DirectorOverlay
                editor={editorRef.current}
                frames={frames}
                selectedId={null}
                onSelect={() => {}}
                onChangeFrames={() => {}}
                onPlayFrame={(frame) => void startPresentation(frame.id)}
                readOnly
              />
            ) : undefined
          }
          onMount={handleMount}
        />
      </div>

      {directorMode && !presentation ? (
        <DirectorHud
          onPlay={() => void startPresentation()}
          onExit={() => setDirectorMode(false)}
        />
      ) : null}

      {presentation ? (
        <PresentationOverlay
          menu={presentationMenu}
          onMenu={setPresentationMenu}
          onAdvance={advancePresentation}
          onExit={exitPresentation}
        />
      ) : null}
    </div>
  )
}
