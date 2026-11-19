import { useEffect, useRef, useState } from 'react'
import type { BoardScope } from '../../shared/board/types'
import type { CanvasDocument } from '../model'
import {
  AUTOSAVE_DELAY,
  type CanvasListItem,
  type SaveState,
} from './appUtils'
import { writeBoard } from './workspaceApi'

interface UseCanvasSaveOptions {
  canvas: CanvasDocument | null
  items: CanvasListItem[]
  selectedSlug: string
  scope: BoardScope
}

export function useCanvasSave({
  canvas,
  items,
  selectedSlug,
  scope,
}: UseCanvasSaveOptions) {
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveRequest, setSaveRequest] = useState(0)
  const revisionRef = useRef(0)
  const savingRef = useRef(false)

  function markDirty() {
    revisionRef.current += 1
    setSaveState('dirty')
  }

  async function save(): Promise<boolean> {
    if (!canvas || savingRef.current) return false
    if (saveState === 'saved') return true
    const meta = canvas['x-superboard']?.meta
    if (!meta) return false
    const item = items.find(
      (entry) => entry.slug === selectedSlug && entry.scope === scope,
    )
    if (!item) return false
    const revision = revisionRef.current
    savingRef.current = true
    setSaveState('saving')
    try {
      await writeBoard(item, canvas)
      if (revisionRef.current === revision) {
        setSaveState('saved')
      } else {
        setSaveState('dirty')
        setSaveRequest((value) => value + 1)
      }
      return true
    } catch {
      setSaveState('error')
      return false
    } finally {
      savingRef.current = false
    }
  }

  useEffect(() => {
    if (saveState !== 'dirty') return
    const timer = window.setTimeout(() => {
      if (savingRef.current) {
        setSaveRequest((value) => value + 1)
        return
      }
      void save()
    }, AUTOSAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [saveState, canvas, selectedSlug, saveRequest])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === 'saved') return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveState])

  return { saveState, setSaveState, save, markDirty, savingRef }
}
