import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Tldraw, type Editor, type TLUiContextMenuProps } from 'tldraw'
import UseAnimations from 'react-useanimations'
import aperture from 'react-useanimations/lib/aperture'
import checkCircle from 'react-useanimations/lib/checkCircle'
import gitBranch from 'react-useanimations/lib/gitBranch'
import sidebar from 'react-useanimations/lib/sidebar'
import type { BoardFile, BoardListItem, BoardScope, BoardTreeFolder } from '../shared/board/types'
import { isBoardScope } from '../shared/board/types'
import { BoardTreePanel } from '../shared/board/BoardTreePanel'
import type { BoardTreeContextTarget } from '../shared/board/BoardTree'
import { buildBoardTree } from '../shared/board/tree'
import { useTreeExpansion } from '../shared/board/useTreeExpansion'
import { SB_MARKDOWN_TYPE, SB_PELE_TYPE } from '../shared/shapes/types'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'
import { superboardEditorComponents, SuperboardStylePanel } from './style-panel'
import { SuperboardContextMenu } from './context-menu'
import { BoardContextMenu, type BoardContextTarget } from './BoardContextMenu'
import { BoardDialog, DeleteBoardDialog, DeleteFolderDialog, RenameFolderDialog, type BoardFormValues } from './dialogs'
import { ShapeEditor } from './shape-editor'
import { SAVE_STATUS_LABEL, useAutoSave } from './useAutoSave'
import { useShapeEditing } from './useShapeEditing'
import { createBoard, deleteBoard, deleteFolder, fetchBoard, fetchBoards, patchBoard, renameFolder } from './api'

type BoardDialogState =
  | { mode: 'create'; folder?: string }
  | { mode: 'rename'; board: BoardListItem }
interface ContextMenuState {
  x: number
  y: number
  target: BoardContextTarget
}

function readScopeFromUrl() {
  const value = new URLSearchParams(window.location.search).get('scope')
  return isBoardScope(value) ? value : 'public'
}

function isPathInside(path: string, folder: string) {
  return path === folder || path.startsWith(`${folder}/`)
}

function updateBoardUrl(slug: string | null, scope: BoardScope) {
  const params = new URLSearchParams(window.location.search)
  if (slug) params.set('board', slug)
  else params.delete('board')
  if (scope === 'private') params.set('scope', 'private')
  else params.delete('scope')
  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}

export function EditorApp() {
  const [boards, setBoards] = useState<BoardListItem[]>([])
  const [board, setBoard] = useState<BoardFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState('')
  const [editorReady, setEditorReady] = useState(false)
  const [treeMode, setTreeMode] = useState(() => new URLSearchParams(window.location.search).has('tree'))
  const [treeOpen, setTreeOpen] = useState(true)
  const [scope, setScope] = useState<BoardScope>(readScopeFromUrl)
  const [stylePanelOpen, setStylePanelOpen] = useState(false)
  const [boardDialog, setBoardDialog] = useState<BoardDialogState | null>(null)
  const [folderDialog, setFolderDialog] = useState<BoardTreeFolder | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null)
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<BoardTreeFolder | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const boardRef = useRef<BoardFile | null>(null)
  const scopeRef = useRef<BoardScope>(scope)

  useEffect(() => {
    boardRef.current = board
  }, [board])

  useEffect(() => {
    scopeRef.current = scope
  }, [scope])

  const scopedBoards = useMemo(
    () => boards.filter((item) => (item.scope ?? 'public') === scope),
    [boards, scope],
  )
  const treeNodes = useMemo(() => buildBoardTree(scopedBoards), [scopedBoards])
  const { expanded, toggleFolder, expandPath, renameExpandedPath } = useTreeExpansion(scopedBoards)
  const {
    saveState,
    saveError,
    dirtyRef,
    saveNow,
    scheduleSave,
    cancelPendingSave,
    resetSaveState,
    reportSaveError,
    flush,
  } = useAutoSave({ editorRef, boardRef, scopeRef, setBoard, setBoards })
  const { editing, setEditing, addShape, saveEdit } = useShapeEditing({ editorRef })

  const editorComponents = useMemo(
    () => ({
      ...superboardEditorComponents,
      StylePanel: stylePanelOpen ? SuperboardStylePanel : null,
      ContextMenu: (props: TLUiContextMenuProps) => (
        <SuperboardContextMenu
          {...props}
          onAddMarkdown={() => addShape(SB_MARKDOWN_TYPE)}
          onAddPele={() => addShape(SB_PELE_TYPE)}
        />
      ),
    }),
    [addShape, stylePanelOpen],
  )

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setLoading(true)
      setFatal('')
      try {
        const list = await fetchBoards()
        if (cancelled) return
        setBoards(list)

        const params = new URLSearchParams(window.location.search)
        const tree = params.has('tree')
        const initialScope = readScopeFromUrl()
        setTreeMode(tree)
        setScope(initialScope)
        scopeRef.current = initialScope
        const requested = params.get('board')
        const scoped = list.filter((item) => (item.scope ?? 'public') === initialScope)
        const slug = scoped.find((item) => item.slug === requested)?.slug ?? scoped[0]?.slug
        if (!slug) {
          updateBoardUrl(null, initialScope)
          return
        }

        const loaded = await fetchBoard(slug, initialScope)
        if (cancelled) return
        boardRef.current = loaded
        setBoard(loaded)
        if (tree && !params.get('tree')) params.set('tree', '1')
        params.set('board', slug)
        if (initialScope === 'private') params.set('scope', 'private')
        else params.delete('scope')
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
      } catch (error) {
        if (!cancelled) setFatal(error instanceof Error ? error.message : String(error))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!editorReady || !editorRef.current) return
    return editorRef.current.store.listen(
      ({ changes }) => {
        const ids = [
          ...Object.keys(changes.added),
          ...Object.keys(changes.updated),
          ...Object.keys(changes.removed),
        ]
        if (ids.length > 0 && ids.every((id) => id.startsWith('user:'))) return
        scheduleSave()
      },
      { scope: 'document' },
    )
  }, [editorReady, board?.meta.slug, scheduleSave])

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    const current = boardRef.current

    try {
      if (current) editor.loadSnapshot(current.document)
      editor.updateInstanceState({ isReadonly: false })
      editor.zoomToFit({ animation: { duration: 0 } })
      editor.setCurrentTool('select')
    } catch (error) {
      setFatal(error instanceof Error ? error.message : String(error))
      return
    }

    setEditorReady(true)
  }, [])

  function openContextMenu(event: ReactMouseEvent<HTMLElement>, target: BoardTreeContextTarget) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, target })
  }

  function openRootContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('.sb-tree-row')) return
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, target: { type: 'root' } })
  }

  function enableTreeMode() {
    if (treeMode) {
      setTreeOpen((open) => !open)
      return
    }
    const params = new URLSearchParams(window.location.search)
    params.set('tree', '1')
    if (boardRef.current) params.set('board', boardRef.current.meta.slug)
    if (scopeRef.current === 'private') params.set('scope', 'private')
    else params.delete('scope')
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    setTreeMode(true)
    setTreeOpen(true)
  }

  async function switchBoard(slug: string) {
    if (!slug || slug === boardRef.current?.meta.slug) return
    if (dirtyRef.current) await saveNow()
    const target = scopedBoards.find((item) => item.slug === slug)
    if (target) expandPath(target.path)

    setEditorReady(false)
    setEditing(null)

    try {
      const next = await fetchBoard(slug, scope)
      boardRef.current = next
      setBoard(next)
      updateBoardUrl(slug, scope)
    } catch (error) {
      reportSaveError(error)
    }
  }

  async function switchScope(nextScope: BoardScope) {
    if (nextScope === scope) return
    if (dirtyRef.current) await saveNow()

    setEditing(null)
    setEditorReady(false)
    setTreeOpen(true)

    const nextBoards = boards.filter((item) => (item.scope ?? 'public') === nextScope)
    setScope(nextScope)
    scopeRef.current = nextScope

    const currentSlug = boardRef.current?.meta.slug
    const nextItem = nextBoards.find((item) => item.slug === currentSlug) ?? nextBoards[0]
    if (!nextItem) {
      boardRef.current = null
      setBoard(null)
      updateBoardUrl(null, nextScope)
      return
    }

    try {
      const next = await fetchBoard(nextItem.slug, nextScope)
      boardRef.current = next
      setBoard(next)
      expandPath(nextItem.path)
      updateBoardUrl(nextItem.slug, nextScope)
    } catch (error) {
      reportSaveError(error)
    }
  }

  async function handleCreate(values: BoardFormValues) {
    await flush()
    const created = await createBoard({
      title: values.title,
      slug: values.slug,
      folder: values.folder || undefined,
      scope,
    })
    const list = await fetchBoards()
    setBoards(list)
    expandPath(created.path)
    setEditorReady(false)
    setEditing(null)
    boardRef.current = created.board
    setBoard(created.board)
    updateBoardUrl(created.board.meta.slug, scope)
  }

  async function handleRename(values: BoardFormValues) {
    if (!boardDialog || boardDialog.mode !== 'rename') return
    const target = boardDialog.board
    const isCurrent = target.slug === boardRef.current?.meta.slug
    if (isCurrent) await flush()

    const result = await patchBoard(target.slug, scope, {
      title: values.title,
      slug: values.slug,
      folder: values.folder,
    })
    const list = await fetchBoards()
    setBoards(list)
    expandPath(result.path)

    if (isCurrent) {
      if (result.board.meta.slug !== target.slug) setEditorReady(false)
      boardRef.current = result.board
      setBoard(result.board)
      updateBoardUrl(result.board.meta.slug, scope)
    }
  }

  async function handleRenameFolder(name: string) {
    if (!folderDialog) return
    await flush()
    const result = await renameFolder(scope, folderDialog.path, name)
    const list = await fetchBoards()
    setBoards(list)
    renameExpandedPath(folderDialog.path, result.path)
  }

  async function handleDelete(slug: string) {
    const isCurrent = slug === boardRef.current?.meta.slug
    if (isCurrent) cancelPendingSave()

    await deleteBoard(slug, scope)
    const list = await fetchBoards()
    setBoards(list)

    if (!isCurrent) return

    setEditing(null)
    setEditorReady(false)
    resetSaveState()

    const nextItem = list.find((item) => (item.scope ?? 'public') === scope)
    if (nextItem) {
      const next = await fetchBoard(nextItem.slug, scope)
      boardRef.current = next
      setBoard(next)
      updateBoardUrl(next.meta.slug, scope)
    } else {
      boardRef.current = null
      setBoard(null)
      updateBoardUrl(null, scope)
    }
  }

  async function handleDeleteFolder(path: string) {
    const currentItem = scopedBoards.find((item) => item.slug === boardRef.current?.meta.slug)
    const currentInside = currentItem ? isPathInside(currentItem.path, path) : false
    if (currentInside) {
      await flush()
      cancelPendingSave()
    }

    await deleteFolder(scope, path)
    const list = await fetchBoards()
    setBoards(list)

    if (!currentInside) return

    setEditing(null)
    setEditorReady(false)
    resetSaveState()

    const nextItem = list.find((item) => (item.scope ?? 'public') === scope)
    if (nextItem) {
      const next = await fetchBoard(nextItem.slug, scope)
      boardRef.current = next
      setBoard(next)
      updateBoardUrl(next.meta.slug, scope)
    } else {
      boardRef.current = null
      setBoard(null)
      updateBoardUrl(null, scope)
    }
  }

  if (loading) {
    return <div className="sb-screen-message">正在加载白板…</div>
  }

  if (fatal) {
    return (
      <div className="sb-screen-message">
        <h1>无法打开白板</h1>
        <pre>{fatal}</pre>
        <p>请确认开发服务器正在运行，并且 whiteboards/public/ 或 whiteboards/private/ 中存在有效的 .tldr.json 文件。</p>
      </div>
    )
  }

  const sidebarLabel = treeMode && treeOpen ? '收起目录' : '展开目录'
  const scopeLabel = scope === 'public' ? '切换到私有白板' : '切换到公开白板'
  const saveLabel =
    saveState === 'error'
      ? saveError || SAVE_STATUS_LABEL.error
      : saveState === 'dirty'
        ? '点击保存'
        : SAVE_STATUS_LABEL[saveState]

  return (
    <div className="sb-app sb-app-editor">
      <aside className="sb-rail" aria-label="编辑器操作">
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={sidebarLabel}
          aria-label={sidebarLabel}
          onClick={enableTreeMode}
        >
          <UseAnimations
            animation={sidebar}
            size={32}
            interaction="click-toggle"
            active={treeMode && treeOpen}
          />
        </button>
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={scopeLabel}
          aria-label={scopeLabel}
          onClick={() => void switchScope(scope === 'public' ? 'private' : 'public')}
        >
          <UseAnimations animation={gitBranch} size={32} />
        </button>
        <button
          type="button"
          className={`sb-rail-button sb-rail-save is-${saveState}`}
          data-tooltip={saveLabel}
          aria-label={saveLabel}
          disabled={!board}
          onClick={() => void saveNow()}
        >
          <UseAnimations animation={checkCircle} size={32} />
        </button>
        <button
          type="button"
          className="sb-rail-button"
          data-tooltip={stylePanelOpen ? '隐藏样式面板' : '显示样式面板'}
          aria-label={stylePanelOpen ? '隐藏样式面板' : '显示样式面板'}
          aria-pressed={stylePanelOpen}
          onClick={() => setStylePanelOpen((open) => !open)}
        >
          <UseAnimations animation={aperture} size={32} interaction="click-replay" />
        </button>
      </aside>

      <div className="sb-workspace">
        {treeMode ? (
          <BoardTreePanel
            nodes={treeNodes}
            title={`SuperBoard-${scope}`}
            collapsed={!treeOpen}
            selectedSlug={board?.meta.slug}
            expanded={expanded}
            onToggle={toggleFolder}
            onSelect={(slug) => {
              void switchBoard(slug)
              if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
            }}
            onContextMenu={openContextMenu}
            onRootContextMenu={openRootContextMenu}
            emptyLabel="还没有白板，在空白处右键新建"
          />
        ) : null}

        <main className="sb-canvas">
          {board ? (
            <Tldraw
              key={`${scope}:${board.meta.slug}`}
              shapeUtils={superboardShapeUtils}
              components={editorComponents}
              licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
              onMount={handleMount}
            />
          ) : (
            <div className="sb-canvas-empty">
              <div>
                <h2>还没有白板</h2>
                <p>在左侧目录空白处右键新建白板，或先把 .tldr.json 放进 whiteboards/{scope}/。</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {editing ? <ShapeEditor key={editing.id} shape={editing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}

      {contextMenu ? (
        <BoardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onCreate={(folder) => setBoardDialog({ mode: 'create', folder })}
          onRename={(node) => setBoardDialog({ mode: 'rename', board: node })}
          onRenameFolder={(folder) => setFolderDialog(folder)}
          onDelete={(node) => setPendingDelete(node)}
          onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
        />
      ) : null}

      {boardDialog ? (
        <BoardDialog
          key={
            boardDialog.mode === 'create'
              ? `create:${boardDialog.folder ?? ''}`
              : `rename:${boardDialog.board.slug}`
          }
          mode={boardDialog.mode}
          board={boardDialog.mode === 'rename' ? boardDialog.board : undefined}
          defaultFolder={
            boardDialog.mode === 'create'
              ? boardDialog.folder ?? ''
              : boardDialog.board.path
          }
          onClose={() => setBoardDialog(null)}
          onSubmit={boardDialog.mode === 'create' ? handleCreate : handleRename}
        />
      ) : null}

      {folderDialog ? (
        <RenameFolderDialog
          key={folderDialog.path}
          folder={folderDialog}
          onClose={() => setFolderDialog(null)}
          onSubmit={handleRenameFolder}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteBoardDialog
          board={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {pendingDeleteFolder ? (
        <DeleteFolderDialog
          folder={pendingDeleteFolder}
          scope={scope}
          onClose={() => setPendingDeleteFolder(null)}
          onConfirm={handleDeleteFolder}
        />
      ) : null}
    </div>
  )
}
