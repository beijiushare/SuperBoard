import { useEffect, useRef, useState } from 'react'
import i18n from '../../i18n'
import type { BoardScope } from '../../shared/board/types'
import type { CanvasDocument } from '../model'
import {
  AUTOSAVE_DELAY,
  type CanvasListItem,
  type SaveState,
} from './appUtils'
import { WorkspaceError, writeBoard } from './workspaceApi'
import { isFolderMoveActive } from './folderMove'

const RETRY_DELAYS = [250, 800]
const CHANNEL_NAME = 'superboard-board'

interface UseCanvasSaveOptions {
  canvas: CanvasDocument | null
  items: CanvasListItem[]
  selectedSlug: string
  scope: BoardScope
}

async function writeWithRetry(item: CanvasListItem, canvas: CanvasDocument) {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    try {
      await writeBoard(item, canvas)
      return
    } catch (error) {
      lastError = error
      if (error instanceof WorkspaceError && error.status === 409) throw error
      if (attempt === RETRY_DELAYS.length) break
      await new Promise((resolve) => {
        window.setTimeout(resolve, RETRY_DELAYS[attempt])
      })
    }
  }
  throw lastError
}

export function useCanvasSave({
  canvas,
  items,
  selectedSlug,
  scope,
}: UseCanvasSaveOptions) {
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveRequest, setSaveRequest] = useState(0)
  const [conflict, setConflict] = useState(false)
  const revisionRef = useRef(0)
  const savingRef = useRef(false)
  const conflictRef = useRef(false)
  const saveStateRef = useRef<SaveState>('saved')
  const tabIdRef = useRef(Math.random().toString(36).slice(2))
  const channelRef = useRef<BroadcastChannel | null>(null)
  saveStateRef.current = saveState

  function markDirty() {
    revisionRef.current += 1
    setSaveState('dirty')
  }

  function currentItem() {
    return items.find(
      (entry) => entry.slug === selectedSlug && entry.scope === scope,
    )
  }

  function announce() {
    channelRef.current?.postMessage({
      slug: selectedSlug,
      scope,
      tabId: tabIdRef.current,
    })
  }

  function clearConflict() {
    conflictRef.current = false
    setConflict(false)
  }

  async function finishWrite(revision: number) {
    clearConflict()
    if (revisionRef.current === revision) {
      setSaveState('saved')
    } else {
      setSaveState('dirty')
      setSaveRequest((value) => value + 1)
    }
    announce()
  }

  async function save(): Promise<boolean> {
    if (isFolderMoveActive()) return false
    if (!canvas || savingRef.current) return false
    if (saveState === 'saved') return true
    if (conflictRef.current) return false
    const meta = canvas['x-superboard']?.meta
    if (!meta) return false
    const item = currentItem()
    if (!item) return false
    const revision = revisionRef.current
    savingRef.current = true
    setSaveState('saving')
    try {
      await writeWithRetry(item, canvas)
      await finishWrite(revision)
      return true
    } catch (error) {
      if (error instanceof WorkspaceError && error.status === 409) {
        conflictRef.current = true
        setConflict(true)
      }
      setSaveState('error')
      return false
    } finally {
      savingRef.current = false
    }
  }

  async function resolveConflict(confirmFirst = true): Promise<boolean> {
    if (!canvas || savingRef.current) return false
    const item = currentItem()
    if (!item) return false
    if (
      confirmFirst &&
      !window.confirm(i18n.t('editor:workspace.conflictOverwrite'))
    ) {
      return false
    }
    const revision = revisionRef.current
    savingRef.current = true
    setSaveState('saving')
    try {
      await writeBoard(item, canvas, true)
      await finishWrite(revision)
      return true
    } catch {
      setSaveState('error')
      return false
    } finally {
      savingRef.current = false
    }
  }

  useEffect(() => {
    conflictRef.current = false
    setConflict(false)
  }, [selectedSlug, scope])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { slug?: string; scope?: BoardScope; tabId?: string }
        | null
      if (!data || data.tabId === tabIdRef.current) return
      if (data.slug !== selectedSlug || data.scope !== scope) return
      if (saveStateRef.current === 'saved') return
      conflictRef.current = true
      setConflict(true)
      setSaveState('error')
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [selectedSlug, scope])

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

  return {
    saveState,
    setSaveState,
    save,
    resolveConflict,
    clearConflict,
    conflict,
    markDirty,
    savingRef,
  }
}
