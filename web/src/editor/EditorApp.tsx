import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import type { BoardFile, BoardListItem, BoardTreeFolder } from '../shared/board/types'
import { BoardTreePanel } from '../shared/board/BoardTreePanel'
import type { BoardTreeContextTarget } from '../shared/board/BoardTree'
import { buildBoardTree } from '../shared/board/tree'
import { useTreeExpansion } from '../shared/board/useTreeExpansion'
import { SB_MARKDOWN_TYPE, SB_PELE_TYPE } from '../shared/shapes/types'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'
import { superboardEditorComponents } from './BlockStylePanel'
import { BoardContextMenu, type BoardContextTarget } from './BoardContextMenu'
import { BoardToolbar } from './BoardToolbar'
import { BoardDialog, DeleteBoardDialog, RenameFolderDialog, type BoardFormValues } from './BoardDialog'
import { ShapeEditor } from './ShapeEditor'
import { useAutoSave } from './useAutoSave'
import { useShapeEditing } from './useShapeEditing'
import { createBoard, deleteBoard, fetchBoard, fetchBoards, patchBoard, renameFolder } from './api'

type BoardDialogState =
  | { mode: 'create'; folder?: string }
  | { mode: 'rename'; board: BoardListItem }
interface ContextMenuState {
  x: number
  y: number
  target: BoardContextTarget
}

function updateBoardUrl(slug: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (slug) params.set('board', slug)
  else params.delete('board')
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
  const [boardDialog, setBoardDialog] = useState<BoardDialogState | null>(null)
  const [folderDialog, setFolderDialog] = useState<BoardTreeFolder | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const boardRef = useRef<BoardFile | null>(null)

  useEffect(() => {
    boardRef.current = board
  }, [board])

  const treeNodes = useMemo(() => buildBoardTree(boards), [boards])
  const { expanded, toggleFolder, expandPath, renameExpandedPath } = useTreeExpansion(boards)
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
  } = useAutoSave({ editorRef, boardRef, setBoard, setBoards })
  const { editing, setEditing, addShape, saveEdit } = useShapeEditing({ editorRef })

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
        setTreeMode(tree)
        const requested = params.get('board')
        const slug = list.find((item) => item.slug === requested)?.slug ?? list[0]?.slug
        if (!slug) {
          if (!tree) {
            throw new Error('还没有白板。先在 whiteboards/ 下创建 .tldr.json，或运行 npm run seed。')
          }
          updateBoardUrl(null)
          return
        }

        const loaded = await fetchBoard(slug)
        if (cancelled) return
        boardRef.current = loaded
        setBoard(loaded)
        if (tree && !params.get('tree')) params.set('tree', '1')
        params.set('board', slug)
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
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    setTreeMode(true)
    setTreeOpen(true)
  }

  async function switchBoard(slug: string) {
    if (!slug || slug === boardRef.current?.meta.slug) return
    if (dirtyRef.current) await saveNow()
    const target = boards.find((item) => item.slug === slug)
    if (target) expandPath(target.path)

    setEditorReady(false)
    setEditing(null)

    try {
      const next = await fetchBoard(slug)
      boardRef.current = next
      setBoard(next)
      updateBoardUrl(slug)
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
    })
    const list = await fetchBoards()
    setBoards(list)
    expandPath(created.path)
    setEditorReady(false)
    setEditing(null)
    boardRef.current = created.board
    setBoard(created.board)
    updateBoardUrl(created.board.meta.slug)
  }

  async function handleRename(values: BoardFormValues) {
    if (!boardDialog || boardDialog.mode !== 'rename') return
    const target = boardDialog.board
    const isCurrent = target.slug === boardRef.current?.meta.slug
    if (isCurrent) await flush()

    const result = await patchBoard(target.slug, {
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
      updateBoardUrl(result.board.meta.slug)
    }
  }

  async function handleRenameFolder(name: string) {
    if (!folderDialog) return
    await flush()
    const result = await renameFolder(folderDialog.path, name)
    const list = await fetchBoards()
    setBoards(list)
    renameExpandedPath(folderDialog.path, result.path)
  }

  async function handleDelete(slug: string) {
    const isCurrent = slug === boardRef.current?.meta.slug
    if (isCurrent) cancelPendingSave()

    await deleteBoard(slug)
    const list = await fetchBoards()
    setBoards(list)

    if (!isCurrent) return

    setEditing(null)
    setEditorReady(false)
    resetSaveState()

    const nextItem = list[0]
    if (nextItem) {
      const next = await fetchBoard(nextItem.slug)
      boardRef.current = next
      setBoard(next)
      updateBoardUrl(next.meta.slug)
    } else {
      boardRef.current = null
      setBoard(null)
      updateBoardUrl(null)
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
        <p>请确认开发服务器正在运行，并且 whiteboards/ 中存在有效的 .tldr.json 文件。</p>
      </div>
    )
  }

  if (!board && !treeMode) {
    return <div className="sb-screen-message">没有可编辑的白板。</div>
  }

  return (
    <div className="sb-app">
      <BoardToolbar
        board={board}
        boards={boards}
        treeMode={treeMode}
        treeOpen={treeOpen}
        saveState={saveState}
        saveError={saveError}
        onToggleTree={enableTreeMode}
        onSwitchBoard={(slug) => void switchBoard(slug)}
        onAddMarkdown={() => addShape(SB_MARKDOWN_TYPE)}
        onAddPele={() => addShape(SB_PELE_TYPE)}
        onSaveNow={() => void saveNow()}
      />

      <div className="sb-workspace">
        {treeMode && treeOpen ? (
          <BoardTreePanel
            nodes={treeNodes}
            selectedSlug={board?.meta.slug}
            expanded={expanded}
            onToggle={toggleFolder}
            onSelect={(slug) => {
              void switchBoard(slug)
              if (window.matchMedia('(max-width: 860px)').matches) setTreeOpen(false)
            }}
            onContextMenu={openContextMenu}
            onRootContextMenu={openRootContextMenu}
            headerMeta={<span className="sb-tree-hint">右键操作</span>}
            emptyLabel="还没有白板，在空白处右键新建"
          />
        ) : null}

        <main className="sb-canvas">
          {board ? (
            <Tldraw
              key={board.meta.slug}
              shapeUtils={superboardShapeUtils}
              components={superboardEditorComponents}
              licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
              onMount={handleMount}
            />
          ) : (
            <div className="sb-canvas-empty">
              <div>
                <h2>还没有白板</h2>
                <p>在左侧目录空白处右键新建白板，或先把 .tldr.json 放进 whiteboards/。</p>
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
    </div>
  )
}
