import { useCallback, useRef, type RefObject } from 'react'
import type { CanvasDocument } from '../model'
import { HISTORY_LIMIT, HISTORY_MERGE_MS } from './appUtils'

interface UseCanvasHistoryOptions {
  canvasRef: RefObject<CanvasDocument | null>
  onRestore: (canvas: CanvasDocument) => void
}

export function useCanvasHistory({
  canvasRef,
  onRestore,
}: UseCanvasHistoryOptions) {
  const historyRef = useRef<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const mergeRef = useRef<{ key: string; at: number } | null>(null)

  const recordHistory = useCallback(
    (mergeKey?: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const now = Date.now()
      if (mergeKey) {
        const merged = mergeRef.current
        if (merged?.key === mergeKey && now - merged.at < HISTORY_MERGE_MS) {
          merged.at = now
          return
        }
        mergeRef.current = { key: mergeKey, at: now }
      } else {
        mergeRef.current = null
      }
      const history = historyRef.current
      history.past.push(structuredClone(canvas))
      if (history.past.length > HISTORY_LIMIT) history.past.shift()
      history.future.length = 0
    },
    [canvasRef],
  )

  const undo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    mergeRef.current = null
    const history = historyRef.current
    const previous = history.past.pop()
    if (!previous) return
    history.future.push(structuredClone(canvas))
    onRestore(previous)
  }, [canvasRef, onRestore])

  const redo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    mergeRef.current = null
    const history = historyRef.current
    const next = history.future.pop()
    if (!next) return
    history.past.push(structuredClone(canvas))
    onRestore(next)
  }, [canvasRef, onRestore])

  const resetHistory = useCallback(() => {
    historyRef.current = { past: [], future: [] }
    mergeRef.current = null
  }, [])

  return { recordHistory, undo, redo, resetHistory }
}
