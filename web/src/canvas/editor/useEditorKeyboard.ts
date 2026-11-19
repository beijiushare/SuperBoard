import { useEffect, useRef } from 'react'
import type { CanvasDocument } from '../model'
import { TOOL_SHORTCUTS, type EditorTool } from './tools'

interface UseEditorKeyboardOptions {
  canvas: CanvasDocument | null
  presentation: boolean
  focusedGroupId: string | null
  exitPresentation: () => void
  save: () => Promise<boolean>
  undo: () => void
  redo: () => void
  copySelection: () => void
  pasteClipboard: () => void
  duplicateSelection: () => void
  deleteSelection: () => void
  selectAllUnlocked: () => void
  ungroupSelection: () => void
  toggleGroup: () => void
  toggleLockSelection: () => void
  setTool: (tool: EditorTool) => void
  reorderSelection: (mode: 'front' | 'back' | 'forward' | 'backward') => void
  enterGroup: () => void
  setSelectedIds: (ids: string[]) => void
  setSelectedEdgeId: (id: string | null) => void
  setFocusedGroupId: (id: string | null) => void
}

export function useEditorKeyboard(options: UseEditorKeyboardOptions) {
  const handlerRef = useRef<(event: KeyboardEvent) => void>(() => {})

  handlerRef.current = (event: KeyboardEvent) => {
    if (document.body.classList.contains('is-folder-moving')) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return
    }
    if (event.key === 'Escape' && options.presentation) {
      event.preventDefault()
      options.exitPresentation()
      return
    }
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && key === 's') {
      event.preventDefault()
      void options.save()
      return
    }
    if (mod && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) options.redo()
      else options.undo()
      return
    }
    if (mod && key === 'y') {
      event.preventDefault()
      options.redo()
      return
    }
    if (mod && key === 'c') {
      options.copySelection()
      return
    }
    if (mod && key === 'v') {
      event.preventDefault()
      options.pasteClipboard()
      return
    }
    if (mod && key === 'd') {
      event.preventDefault()
      options.duplicateSelection()
      return
    }
    if (mod && key === 'x') {
      event.preventDefault()
      options.copySelection()
      options.deleteSelection()
      return
    }
    if (mod && key === 'a') {
      event.preventDefault()
      options.selectAllUnlocked()
      return
    }
    if (mod && key === 'g') {
      event.preventDefault()
      if (event.shiftKey) options.ungroupSelection()
      else options.toggleGroup()
      return
    }
    if (!mod && event.shiftKey && key === 'l') {
      event.preventDefault()
      options.toggleLockSelection()
      return
    }
    if (!mod && !event.altKey && !event.shiftKey) {
      const nextTool = TOOL_SHORTCUTS[key]
      if (nextTool) {
        event.preventDefault()
        options.setTool(nextTool)
        return
      }
    }
    if (!mod && event.key === ']') {
      event.preventDefault()
      options.reorderSelection(event.altKey ? 'forward' : 'front')
      return
    }
    if (!mod && event.key === '[') {
      event.preventDefault()
      options.reorderSelection(event.altKey ? 'backward' : 'back')
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      options.deleteSelection()
      return
    }
    if (event.key === 'Enter' && !mod && !event.shiftKey) {
      if (target?.closest('button, a')) return
      event.preventDefault()
      options.enterGroup()
      return
    }
    if (event.key === 'Escape' && options.focusedGroupId) {
      event.preventDefault()
      const group = options.canvas?.nodes.find(
        (node) => node.id === options.focusedGroupId,
      )
      options.setSelectedIds([options.focusedGroupId])
      options.setSelectedEdgeId(null)
      options.setFocusedGroupId(group?.['x-superboard']?.groupId ?? null)
      return
    }
    if (event.key === 'Escape') {
      options.setSelectedIds([])
      options.setSelectedEdgeId(null)
      options.setTool('select')
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handlerRef.current(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
