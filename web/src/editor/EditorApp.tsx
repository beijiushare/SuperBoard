import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { type Editor, type TLShapeId, type TLUiContextMenuProps, type TLUiOverrides } from 'tldraw'
import type { BoardFile, BoardListItem, BoardScope, BoardTreeFolder } from '../shared/board/types'
import { BoardTreePanel } from '../shared/board/BoardTreePanel'
import type { BoardTreeContextTarget } from '../shared/board/BoardTree'
import { buildBoardTree } from '../shared/board/tree'
import { useTreeExpansion } from '../shared/board/useTreeExpansion'
import {
  SB_FRAME_TYPE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_FRAME_EDIT_EVENT,
  SUPERBOARD_FRAME_PLAY_EVENT,
  type SbFrameShape,
} from '../shared/shapes/types'
import { getFrames, moveCameraToFrame } from '../shared/shapes/frameUtils'
import { setFrameMode } from '../shared/shapes/frameMode'
import { superboardEditorComponents } from './style-panel'
import { SuperboardMenuPanel } from './SuperboardMenuPanel'
import { EditorRail } from './EditorRail'
import { EditorCanvas } from './EditorCanvas'
import { readScopeFromUrl, updateBoardUrl, isPathInside } from './boardUrl'
import { SuperboardContextMenu } from './context-menu'
import { BoardContextMenu, type BoardContextTarget } from './BoardContextMenu'
import {
  BoardDialog,
  DeleteBoardDialog,
  DeleteFolderDialog,
  DeployDialog,
  FrameValueDialog,
  RenameFolderDialog,
  type BoardFormValues,
} from './dialogs'
import { ShapeEditor } from './shape-editor'
import { MediaDialog } from './media/MediaDialog'
import { SAVE_STATUS_LABEL, useAutoSave } from './useAutoSave'
import { useShapeEditing } from './useShapeEditing'
import { useMediaController } from './useMediaController'
import { createBoard, deleteBoard, deleteFolder, fetchBoard, fetchBoards, patchBoard, renameFolder } from './api'

type BoardDialogState =
  | { mode: 'create'; folder?: string }
  | { mode: 'rename'; board: BoardListItem }
interface ContextMenuState {
  x: number
  y: number
  target: BoardContextTarget
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
  const [menuPanelOpen, setMenuPanelOpen] = useState(false)
  const [presenterMode, setPresenterMode] = useState(false)
  const [boardDialog, setBoardDialog] = useState<BoardDialogState | null>(null)
  const [folderDialog, setFolderDialog] = useState<BoardTreeFolder | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null)
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<BoardTreeFolder | null>(null)
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingFrame, setEditingFrame] = useState<SbFrameShape | null>(null)
  const [presentation, setPresentation] = useState<{ frames: SbFrameShape[]; index: number } | null>(null)
  const [presentationMenu, setPresentationMenu] = useState<{ x: number; y: number } | null>(null)
  const appRef = useRef<HTMLDivElement | null>(null)
  const presenterLockedRef = useRef<Set<TLShapeId>>(new Set())

  const editorRef = useRef<Editor | null>(null)
  const boardRef = useRef<BoardFile | null>(null)
  const scopeRef = useRef<BoardScope>(scope)

  useEffect(() => {
    boardRef.current = board
  }, [board])

  useEffect(() => {
    scopeRef.current = scope
  }, [scope])

  useEffect(() => {
    setFrameMode(presenterMode)
  }, [presenterMode])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    if (presenterMode) {
      const shapes = editor
        .getCurrentPageShapes()
        .filter((shape) => shape.type !== SB_FRAME_TYPE && !shape.isLocked)
      for (const shape of shapes) {
        editor.updateShape({ ...shape, isLocked: true })
      }
      presenterLockedRef.current = new Set(shapes.map((shape) => shape.id))
      return
    }

    const ids = [...presenterLockedRef.current]
    for (const id of ids) {
      const shape = editor.getShape(id)
      if (shape) editor.updateShape({ ...shape, isLocked: false })
    }
    presenterLockedRef.current.clear()
  }, [presenterMode, editorReady, board?.meta.slug])

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
  const { mediaDialog, openMediaCreate, closeMediaDialog, saveMedia } = useMediaController({ editorRef })

  const editorComponents = useMemo(
    () => ({
      ...superboardEditorComponents,
      MenuPanel: SuperboardMenuPanel,
      ContextMenu: (props: TLUiContextMenuProps) => (
        <SuperboardContextMenu
          {...props}
          onAddMarkdown={() => addShape(SB_MARKDOWN_TYPE)}
          onAddPele={() => addShape(SB_PELE_TYPE)}
        />
      ),
    }),
    [addShape],
  )

  const editorUiState = useMemo(
    () => ({ stylePanelOpen, menuPanelOpen, presenterMode }),
    [stylePanelOpen, menuPanelOpen, presenterMode],
  )

  const editorOverrides = useMemo<TLUiOverrides>(
    () => ({
      tools(_editor, tools) {
        return {
          ...tools,
          asset: {
            ...tools.asset,
            onSelect: openMediaCreate,
          },
        }
      },
    }),
    [openMediaCreate],
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

  async function startPresentation(startShapeId?: string) {
    const editor = editorRef.current
    if (!editor) return
    const frames = getFrames(editor)
    if (frames.length === 0) return

    let index = 0
    if (startShapeId) {
      const found = frames.findIndex((frame) => frame.id === startShapeId)
      if (found >= 0) index = found
    }

    setPresenterMode(true)
    setEditingFrame(null)
    setContextMenu(null)
    setPresentationMenu(null)
    setPresentation({ frames, index })
    editor.selectNone()

    try {
      if (!document.fullscreenElement) await appRef.current?.requestFullscreen()
    } catch {
      // Fullscreen can be denied by the browser; presentation still works in-page.
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    moveCameraToFrame(editor, frames[index], false)
  }

  function exitPresentation() {
    setPresentation(null)
    setPresentationMenu(null)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  function advancePresentation() {
    if (!presentation) return
    const nextIndex = presentation.index + 1
    if (nextIndex >= presentation.frames.length) {
      exitPresentation()
      return
    }

    const editor = editorRef.current
    if (editor) moveCameraToFrame(editor, presentation.frames[nextIndex], true)
    setPresentation({ ...presentation, index: nextIndex })
  }

  useEffect(() => {
    if (!presentation) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      advancePresentation()
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setPresentation(null)
        setPresentationMenu(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [presentation])

  useEffect(() => {
    const onEditFrame = (event: Event) => {
      const detail = (event as CustomEvent<{ shapeId?: string }>).detail
      const editor = editorRef.current
      if (!editor || !detail?.shapeId) return
      const shape = editor.getShape(detail.shapeId as Parameters<Editor['getShape']>[0])
      if (!shape || shape.type !== SB_FRAME_TYPE) return
      setEditingFrame(shape as SbFrameShape)
    }
    const onPlayFrame = (event: Event) => {
      const detail = (event as CustomEvent<{ shapeId?: string }>).detail
      if (detail?.shapeId) void startPresentation(detail.shapeId)
    }

    window.addEventListener(SUPERBOARD_FRAME_EDIT_EVENT, onEditFrame)
    window.addEventListener(SUPERBOARD_FRAME_PLAY_EVENT, onPlayFrame)
    return () => {
      window.removeEventListener(SUPERBOARD_FRAME_EDIT_EVENT, onEditFrame)
      window.removeEventListener(SUPERBOARD_FRAME_PLAY_EVENT, onPlayFrame)
    }
  }, [])

  function handleFrameOrder(value: number) {
    const editor = editorRef.current
    if (!editor || !editingFrame) return
    editor.updateShape<SbFrameShape>({
      id: editingFrame.id,
      type: SB_FRAME_TYPE,
      props: { ...editingFrame.props, order: value },
    })
    setEditingFrame(null)
  }

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
  const menuPanelLabel = menuPanelOpen ? '隐藏顶部操作栏' : '显示顶部操作栏'
  const saveLabel =
    saveState === 'error'
      ? saveError || SAVE_STATUS_LABEL.error
      : saveState === 'dirty'
        ? '点击保存'
        : SAVE_STATUS_LABEL[saveState]

  return (
    <div
      ref={appRef}
      className={`sb-app sb-app-editor${presenterMode ? ' is-presenter-mode' : ''}${presentation ? ' is-presenting' : ''}`}
    >
      <EditorRail
        treeMode={treeMode}
        treeOpen={treeOpen}
        sidebarLabel={sidebarLabel}
        onToggleTree={enableTreeMode}
        scopeLabel={scopeLabel}
        onSwitchScope={() => void switchScope(scope === 'public' ? 'private' : 'public')}
        saveLabel={saveLabel}
        saveState={saveState}
        canSave={Boolean(board)}
        onSave={() => void saveNow()}
        stylePanelOpen={stylePanelOpen}
        onToggleStylePanel={() => setStylePanelOpen((open) => !open)}
        menuPanelOpen={menuPanelOpen}
        menuPanelLabel={menuPanelLabel}
        onToggleMenuPanel={() => setMenuPanelOpen((open) => !open)}
        presenterMode={presenterMode}
        onTogglePresenter={() => setPresenterMode((open) => !open)}
        onDeploy={() => setDeployDialogOpen(true)}
      />

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

        <EditorCanvas
          board={board}
          scope={scope}
          components={editorComponents}
          overrides={editorOverrides}
          uiState={editorUiState}
          onMount={handleMount}
        />
      </div>

      {presenterMode && !presentation ? (
        <div className="sb-presenter-hud">
          <button className="sb-button sb-button-primary" type="button" onClick={() => void startPresentation()}>
            从头播放
          </button>
          <button className="sb-button" type="button" onClick={() => setPresenterMode(false)}>
            退出讲演者
          </button>
        </div>
      ) : null}

      {editingFrame ? (
        <FrameValueDialog
          frame={editingFrame}
          existingValues={
            editorRef.current
              ? getFrames(editorRef.current)
                  .filter((frame) => frame.id !== editingFrame.id)
                  .map((frame) => frame.props.order)
              : []
          }
          onClose={() => setEditingFrame(null)}
          onSubmit={handleFrameOrder}
        />
      ) : null}

      {presentation ? (
        <div
          className="sb-presentation-overlay"
          onClick={advancePresentation}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setPresentationMenu({ x: event.clientX, y: event.clientY })
          }}
        >
          {presentationMenu ? (
            <div
              className="sb-presentation-menu"
              style={{ left: presentationMenu.x, top: presentationMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" onClick={exitPresentation}>
                停止播放
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {editing ? <ShapeEditor key={editing.id} shape={editing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}

      {mediaDialog ? (
        <MediaDialog
          initialValue={mediaDialog.mode === 'edit' ? mediaDialog.initialValue : ''}
          onClose={closeMediaDialog}
          onSave={saveMedia}
        />
      ) : null}

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

      {deployDialogOpen ? (
        <DeployDialog
          onClose={() => setDeployDialogOpen(false)}
          onConfirm={() => {
            setDeployDialogOpen(false)
            void fetch('/__deploy', { method: 'POST' }).catch(() => {})
          }}
        />
      ) : null}
    </div>
  )
}
