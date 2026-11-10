import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import type { Editor } from 'tldraw'
import type { BoardFile, BoardListItem } from '../shared/board/types'
import { putBoard } from './api'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export const SAVE_STATUS_LABEL: Record<SaveState, string> = {
  saved: '已保存',
  dirty: '未保存',
  saving: '保存中…',
  error: '保存失败',
}

interface UseAutoSaveOptions {
  editorRef: MutableRefObject<Editor | null>
  boardRef: MutableRefObject<BoardFile | null>
  setBoard: Dispatch<SetStateAction<BoardFile | null>>
  setBoards: Dispatch<SetStateAction<BoardListItem[]>>
}

export function useAutoSave({ editorRef, boardRef, setBoard, setBoards }: UseAutoSaveOptions) {
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const savingRef = useRef(false)
  const saveNowRef = useRef<() => Promise<void>>(async () => {})

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
  }, [boardRef, editorRef, setBoard, setBoards])

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

  const cancelPendingSave = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    dirtyRef.current = false
  }, [])

  const resetSaveState = useCallback(() => {
    cancelPendingSave()
    setSaveState('saved')
    setSaveError('')
  }, [cancelPendingSave])

  const reportSaveError = useCallback((error: unknown) => {
    setSaveState('error')
    setSaveError(error instanceof Error ? error.message : String(error))
  }, [])

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return
    await saveNowRef.current()
    if (dirtyRef.current) {
      throw new Error('当前白板保存失败，请先处理保存错误')
    }
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

  return {
    saveState,
    saveError,
    dirtyRef,
    saveNow,
    scheduleSave,
    cancelPendingSave,
    resetSaveState,
    reportSaveError,
    flush,
  }
}
