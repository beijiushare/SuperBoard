import { useCallback, useEffect, useRef, useState } from 'react'
import { Tldraw, createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { BoardFile, BoardListItem } from '../shared/board/types'
import {
  DEFAULT_KANBAN_TEXT,
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_PELE_CODE,
  SB_KANBAN_TYPE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_EDIT_EVENT,
  type SbKanbanShape,
  type SbMarkdownShape,
  type SbPeleShape,
} from '../shared/shapes/types'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'
import { fetchBoard, fetchBoards, putBoard } from './api'
import { ShapeEditor, type EditingShape } from './ShapeEditor'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

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

  const editorRef = useRef<Editor | null>(null)
  const boardRef = useRef<BoardFile | null>(null)
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const savingRef = useRef(false)
  const saveNowRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    boardRef.current = board
  }, [board])

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

        const requested = new URLSearchParams(window.location.search).get('board')
        const slug = list.find((item) => item.slug === requested)?.slug ?? list[0]?.slug
        if (!slug) {
          throw new Error('还没有白板。先在 whiteboards/ 下创建 .tldr.json，或运行 npm run seed。')
        }

        const loaded = await fetchBoard(slug)
        if (cancelled) return
        boardRef.current = loaded
        setBoard(loaded)
        const params = new URLSearchParams(window.location.search)
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
      if (shape.type !== SB_MARKDOWN_TYPE && shape.type !== SB_KANBAN_TYPE && shape.type !== SB_PELE_TYPE) {
        return
      }
      editor.select(shape.id)
      setEditing({
        id: shape.id,
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

  async function switchBoard(slug: string) {
    if (!slug || slug === boardRef.current?.meta.slug) return
    if (dirtyRef.current) await saveNowRef.current()

    setEditorReady(false)
    setEditing(null)

    try {
      const next = await fetchBoard(slug)
      boardRef.current = next
      setBoard(next)
      const params = new URLSearchParams(window.location.search)
      params.set('board', slug)
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    } catch (error) {
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }

  function addShape(type: typeof SB_MARKDOWN_TYPE | typeof SB_KANBAN_TYPE | typeof SB_PELE_TYPE) {
    const editor = editorRef.current
    if (!editor) return

    const id = createShapeId()
    const bounds = editor.getViewportScreenBounds()
    const center = editor.screenToPage({
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    })
    const offset = (editor.getCurrentPageShapes().length % 6) * 24

    if (type === SB_MARKDOWN_TYPE) {
      const props = { w: 460, h: 340, text: DEFAULT_MARKDOWN_TEXT }
      editor.createShape<SbMarkdownShape>({
        id,
        type,
        x: center.x - props.w / 2 + offset,
        y: center.y - props.h / 2 + offset,
        props,
      })
    } else if (type === SB_KANBAN_TYPE) {
      const props = { w: 780, h: 420, text: DEFAULT_KANBAN_TEXT }
      editor.createShape<SbKanbanShape>({
        id,
        type,
        x: center.x - props.w / 2 + offset,
        y: center.y - props.h / 2 + offset,
        props,
      })
    } else {
      const props = { w: 580, h: 380, code: DEFAULT_PELE_CODE, diagram: 'flowchart' }
      editor.createShape<SbPeleShape>({
        id,
        type,
        x: center.x - props.w / 2 + offset,
        y: center.y - props.h / 2 + offset,
        props,
      })
    }

    editor.select(id)
    const shape = editor.getShape(id)
    if (shape) {
      setEditing({
        id: shape.id,
        type,
        props: shape.props as unknown as Record<string, unknown>,
      })
    }
  }

  function saveEdit(patch: Record<string, unknown>) {
    const editor = editorRef.current
    const current = editing
    if (!editor || !current) return

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
    } else if (current.type === SB_KANBAN_TYPE) {
      const shape = editor.getShape<SbKanbanShape>(current.id)
      const text = typeof patch.text === 'string' ? patch.text : ''
      if (shape) {
        editor.updateShape<SbKanbanShape>({
          id: shape.id,
          type: SB_KANBAN_TYPE,
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

  if (!board) {
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

        <label className="sb-board-select">
          <span>白板</span>
          <select value={board.meta.slug} onChange={(event) => void switchBoard(event.target.value)}>
            {boards.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <div className="sb-toolbar-divider" />

        <div className="sb-add-group">
          <button className="sb-button" type="button" onClick={() => addShape(SB_MARKDOWN_TYPE)}>
            + Markdown
          </button>
          <button className="sb-button" type="button" onClick={() => addShape(SB_KANBAN_TYPE)}>
            + 看板
          </button>
          <button className="sb-button" type="button" onClick={() => addShape(SB_PELE_TYPE)}>
            + 图表
          </button>
        </div>

        <div className="sb-toolbar-spacer" />

        <button
          className={`sb-save-status sb-save-${saveState}`}
          type="button"
          onClick={() => void saveNow()}
          title={saveError || '点击立即保存'}
        >
          <span className="sb-save-dot" />
          {STATUS_LABEL[saveState]}
        </button>
      </header>

      <main className="sb-canvas">
        <Tldraw
          key={board.meta.slug}
          shapeUtils={superboardShapeUtils}
          licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
          onMount={handleMount}
        />
      </main>

      {editing ? <ShapeEditor key={editing.id} shape={editing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}
    </div>
  )
}
