import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Tldraw, createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { BoardFile, BoardListItem, BoardTreeFolder } from '../shared/board/types'
import { BoardTreePanel } from '../shared/board/BoardTreePanel'
import type { BoardTreeContextTarget } from '../shared/board/BoardTree'
import { buildBoardTree } from '../shared/board/tree'
import { useTreeExpansion } from '../shared/board/useTreeExpansion'
import {
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_PELE_CODE,
  DEFAULT_SB_BLOCK_STYLE,
  DEFAULT_SB_PELE_STYLE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_EDIT_EVENT,
  type SbMarkdownShape,
  type SbPeleShape,
} from '../shared/shapes/types'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'
import { superboardEditorComponents } from './BlockStylePanel'
import { BoardDialog, DeleteBoardDialog, RenameFolderDialog, type BoardFormValues } from './BoardDialog'
import { BoardContextMenu, type BoardContextTarget } from './BoardContextMenu'
import { createBoard, deleteBoard, fetchBoard, fetchBoards, patchBoard, putBoard, renameFolder } from './api'
import { ShapeEditor, type EditingShape } from './ShapeEditor'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
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

const STATUS_LABEL: Record<SaveState, string> = {
  saved: '已保存',
  dirty: '未保存',
  saving: '保存中…',
  error: '保存失败',
}

export function EditorApp() {
  const [boards, setBoards] = useState<BoardListItem[]>([])
  const [board, setBoard] = useState<BoardFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState('')
  const [editorReady, setEditorReady] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const [editing, setEditing] = useState<EditingShape | null>(null)
  const [treeMode, setTreeMode] = useState(() => new URLSearchParams(window.location.search).has('tree'))
  const [treeOpen, setTreeOpen] = useState(true)
  const [boardDialog, setBoardDialog] = useState<BoardDialogState | null>(null)
  const [folderDialog, setFolderDialog] = useState<BoardTreeFolder | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const boardRef = useRef<BoardFile | null>(null)
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const savingRef = useRef(false)
  const saveNowRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    boardRef.current = board
  }, [board])

  const treeNodes = useMemo(() => buildBoardTree(boards), [boards])
  const { expanded, toggleFolder, expandPath, renameExpandedPath } = useTreeExpansion(boards)

  const saveNow = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const editor = editorRef.current
    const current = boardRef.current
    if (!editor || !current || savingRef.current || !dirtyRef.current) return

    savingRef.current = true
    setSaveState('saving')
    setSaveError('')

    const document = editor.store.getStoreSnapshot('document')
    const store = document.store as unknown as Record<string, unknown>
    for (const id of Object.keys(store)) {
      if (id.startsWith('user:')) delete store[id]
    }
    const payload: BoardFile = {
      ...current,
      meta: {
        ...current.meta,
        updatedAt: new Date().toISOString(),
      },
      document,
    }

    dirtyRef.current = false

    try {
      const result = await putBoard(current.meta.slug, payload)
      const next = { ...payload, meta: result.meta }
      boardRef.current = next
      setBoard(next)
      setBoards((items) =>
        items.map((item) =>
          item.slug === next.meta.slug
            ? {
                ...item,
                title: next.meta.title,
                summary: next.meta.summary,
                updatedAt: next.meta.updatedAt,
              }
            : item,
        ),
      )
      if (!dirtyRef.current) setSaveState('saved')
    } catch (error) {
      dirtyRef.current = true
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      savingRef.current = false
      if (dirtyRef.current) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          void saveNowRef.current()
        }, 600)
      }
    }
  }, [])

  saveNowRef.current = saveNow

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    setSaveState('dirty')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void saveNowRef.current()
    }, 800)
  }, [])

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

  useEffect(() => {
    const onEdit = (event: Event) => {
      const detail = (event as CustomEvent<{ shapeId?: string }>).detail
      const editor = editorRef.current
      if (!editor || !detail?.shapeId) return
      const shape = editor.getShape(detail.shapeId as TLShapeId)
      if (!shape) return
      if (shape.type !== SB_MARKDOWN_TYPE && shape.type !== SB_PELE_TYPE) {
        return
      }
      editor.select(shape.id)
      setEditing({
        id: shape.id,
        mode: 'edit',
        type: shape.type,
        props: shape.props as unknown as Record<string, unknown>,
      })
    }

    window.addEventListener(SUPERBOARD_EDIT_EVENT, onEdit)
    return () => window.removeEventListener(SUPERBOARD_EDIT_EVENT, onEdit)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNowRef.current()
      }
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        void saveNowRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

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

  async function flushCurrentBoard() {
    if (!dirtyRef.current) return
    await saveNowRef.current()
    if (dirtyRef.current) {
      throw new Error('当前白板保存失败，请先处理保存错误')
    }
  }

  async function switchBoard(slug: string) {
    if (!slug || slug === boardRef.current?.meta.slug) return
    if (dirtyRef.current) await saveNowRef.current()
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
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleCreate(values: BoardFormValues) {
    await flushCurrentBoard()
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
    if (isCurrent) await flushCurrentBoard()

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
    await flushCurrentBoard()
    const result = await renameFolder(folderDialog.path, name)
    const list = await fetchBoards()
    setBoards(list)
    renameExpandedPath(folderDialog.path, result.path)
  }

  async function handleDelete(slug: string) {
    const isCurrent = slug === boardRef.current?.meta.slug
    if (isCurrent) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      dirtyRef.current = false
    }

    await deleteBoard(slug)
    const list = await fetchBoards()
    setBoards(list)

    if (!isCurrent) return

    setEditing(null)
    setEditorReady(false)
    setSaveState('saved')
    setSaveError('')

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

  function addShape(type: typeof SB_MARKDOWN_TYPE | typeof SB_PELE_TYPE) {
    const editor = editorRef.current
    if (!editor) return

    const id = createShapeId()
    const bounds = editor.getViewportScreenBounds()
    const center = editor.screenToPage({
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    })
    const offset = (editor.getCurrentPageShapes().length % 6) * 24
    let props: Record<string, unknown>
    let width: number
    let height: number

    if (type === SB_MARKDOWN_TYPE) {
      width = 460
      height = 340
      props = { ...DEFAULT_SB_BLOCK_STYLE, w: width, h: height, text: DEFAULT_MARKDOWN_TEXT }
    } else {
      width = 580
      height = 380
      props = {
        ...DEFAULT_SB_PELE_STYLE,
        w: width,
        h: height,
        code: DEFAULT_PELE_CODE,
        diagram: 'flowchart',
      }
    }

    setEditing({
      id,
      mode: 'create',
      type,
      props,
      position: { x: center.x - width / 2 + offset, y: center.y - height / 2 + offset },
    })
  }

  function saveEdit(patch: Record<string, unknown>) {
    const editor = editorRef.current
    const current = editing
    if (!editor || !current) return

    if (current.mode === 'create') {
      const { id, type, position } = current
      if (type === SB_MARKDOWN_TYPE) {
        const text = typeof patch.text === 'string' ? patch.text : DEFAULT_MARKDOWN_TEXT
        editor.createShape<SbMarkdownShape>({
          id,
          type,
          x: position.x,
          y: position.y,
          props: { ...DEFAULT_SB_BLOCK_STYLE, w: 460, h: 340, text },
        })
      } else {
        const code = typeof patch.code === 'string' ? patch.code : DEFAULT_PELE_CODE
        const diagram = typeof patch.diagram === 'string' ? patch.diagram : 'flowchart'
        editor.createShape<SbPeleShape>({
          id,
          type,
          x: position.x,
          y: position.y,
          props: { ...DEFAULT_SB_PELE_STYLE, w: 580, h: 380, code, diagram },
        })
      }

      editor.select(id)
      setEditing(null)
      return
    }

    if (current.type === SB_MARKDOWN_TYPE) {
      const shape = editor.getShape<SbMarkdownShape>(current.id)
      const text = typeof patch.text === 'string' ? patch.text : ''
      if (shape) {
        editor.updateShape<SbMarkdownShape>({
          id: shape.id,
          type: SB_MARKDOWN_TYPE,
          props: { ...shape.props, text },
        })
      }
    } else {
      const shape = editor.getShape<SbPeleShape>(current.id)
      const code = typeof patch.code === 'string' ? patch.code : ''
      const diagram = typeof patch.diagram === 'string' ? patch.diagram : 'flowchart'
      if (shape) {
        editor.updateShape<SbPeleShape>({
          id: shape.id,
          type: SB_PELE_TYPE,
          props: { ...shape.props, code, diagram },
        })
      }
    }

    setEditing(null)
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
      <header className="sb-toolbar">
        <div className="sb-brand">
          <span className="sb-brand-mark">SB</span>
          <span>SuperBoard</span>
        </div>

        <div className="sb-toolbar-divider" />

        <button
          className="sb-button sb-button-ghost sb-tree-toggle"
          type="button"
          onClick={enableTreeMode}
          aria-expanded={treeMode && treeOpen}
          title={treeMode ? (treeOpen ? '收起目录' : '展开目录') : '打开目录视图'}
        >
          {treeMode && treeOpen ? '收起目录' : '目录'}
        </button>

        <div className="sb-toolbar-divider" />

        {treeMode ? (
          <span className="sb-current-board" title={board ? `${board.meta.title} (${board.meta.slug})` : undefined}>
            {board?.meta.title ?? '未选择白板'}
          </span>
        ) : (
          <label className="sb-board-select">
            <span>白板</span>
            <select value={board?.meta.slug ?? ''} onChange={(event) => void switchBoard(event.target.value)}>
              {boards.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="sb-toolbar-divider" />

        <div className="sb-add-group">
          <button className="sb-button" type="button" onClick={() => addShape(SB_MARKDOWN_TYPE)} disabled={!board}>
            + Markdown
          </button>
          <button className="sb-button" type="button" onClick={() => addShape(SB_PELE_TYPE)} disabled={!board}>
            + 图表
          </button>
        </div>

        <div className="sb-toolbar-spacer" />

        <button
          className={`sb-save-status sb-save-${saveState}`}
          type="button"
          onClick={() => void saveNow()}
          title={saveError || '点击立即保存'}
          disabled={!board}
        >
          <span className="sb-save-dot" />
          {STATUS_LABEL[saveState]}
        </button>
      </header>

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
