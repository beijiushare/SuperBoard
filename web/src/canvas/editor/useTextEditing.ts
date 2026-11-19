import { useEffect, useRef, useState } from 'react'
import {
  TEXT_MIN_HEIGHT,
  type CanvasDocument,
  type CanvasNode,
} from '../model'
import {
  DEFAULT_BLOCK_SIZES,
  blockEditor,
} from './blocks'
import { nextFreeId } from './hierarchy'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  textStyleFromPreferences,
} from './preferences'
import { detectMediaKind } from './tools'

export interface Editing {
  id: string | null
  kind: 'text' | 'markdown' | 'pele' | 'media'
  x: number
  y: number
  width: number
  height: number
  value: string
  fontSize: number
  fontFamily?: string
  color?: string
  opacity?: number
  textAlign?: 'left' | 'center' | 'right'
}

interface UseTextEditingOptions {
  canvas: CanvasDocument
  getScale: () => number
  onBeforeChange: () => void
  onApply: (next: CanvasDocument, selection?: string[]) => void
  onExitTool: () => void
  onEditingChange?: (id: string | null) => void
}

function editKindOf(node: CanvasNode): Editing['kind'] | null {
  const editor = blockEditor(node)
  if (!editor || editor === 'schedule') return null
  return editor
}

function editingValue(node: CanvasNode, kind: Editing['kind']) {
  const extension = node['x-superboard']
  if (kind === 'media') {
    return node.type === 'link' ? (extension?.media?.url ?? node.url) : ''
  }
  if (kind === 'pele') {
    const code = extension?.code
    return typeof code === 'string' ? code : node.type === 'text' ? node.text : ''
  }
  return node.type === 'text' ? node.text : ''
}

function setTextOverlayHidden(id: string | null, hidden: boolean) {
  if (!id) return
  document.getElementById(id)?.classList.toggle('sb-text-editing-hidden', hidden)
}

export function useTextEditing({
  canvas,
  getScale,
  onBeforeChange,
  onApply,
  onExitTool,
  onEditingChange,
}: UseTextEditingOptions) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editingRef = useRef<Editing | null>(null)
  const suppressTextCreateRef = useRef(false)
  const [editing, setEditing] = useState<Editing | null>(null)

  function updateEditing(next: Editing | null) {
    const previous = editingRef.current
    if (previous?.id && (!next || next.id !== previous.id)) {
      setTextOverlayHidden(previous.id, false)
    }
    if (next?.id) setTextOverlayHidden(next.id, true)
    editingRef.current = next
    setEditing(next)
  }

  function resetEditing() {
    updateEditing(null)
  }

  function startEditing(node: CanvasNode | null, x: number, y: number) {
    suppressTextCreateRef.current = false
    const textDefaults = DEFAULT_PREFERENCES.text
    const newTextDefaults = getPreferences().text
    const kind = node ? editKindOf(node) : null
    if (node && kind) {
      const style = node['x-superboard']?.style
      updateEditing({
        id: node.id,
        kind,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        value: editingValue(node, kind),
        fontSize: style?.fontSize ?? textDefaults.fontSize,
        fontFamily: style?.fontFamily ?? textDefaults.fontFamily,
        color: style?.color ?? textDefaults.color,
        opacity: style?.opacity ?? textDefaults.opacity,
        textAlign: style?.textAlign ?? textDefaults.textAlign,
      })
      return
    }
    updateEditing({
      id: null,
      kind: 'text',
      x,
      y,
      width:
        canvas['x-superboard']?.settings?.defaultBlockWidth ??
        DEFAULT_BLOCK_SIZES.text.width,
      height:
        canvas['x-superboard']?.settings?.defaultBlockHeight ??
        DEFAULT_BLOCK_SIZES.text.height,
      value: '',
      fontSize: newTextDefaults.fontSize,
      fontFamily: newTextDefaults.fontFamily,
      color: newTextDefaults.color,
      opacity: newTextDefaults.opacity,
      textAlign: newTextDefaults.textAlign,
    })
  }

  function commitEditing() {
    const current = editingRef.current
    if (!current) return
    suppressTextCreateRef.current = true
    const textarea = textareaRef.current
    const scale = getScale()
    const measured = Math.max(
      TEXT_MIN_HEIGHT,
      (textarea?.scrollHeight ?? current.height * scale) / scale,
    )
    updateEditing(null)
    if (current.id) {
      const index = canvas.nodes.findIndex((item) => item.id === current.id)
      const node = canvas.nodes[index]
      if (!node) return
      if (current.value === '') {
        onBeforeChange()
        onApply(
          {
            ...canvas,
            nodes: canvas.nodes.filter((item) => item.id !== current.id),
          },
          [],
        )
        return
      }
      let nextNode: CanvasNode
      if (current.kind === 'media') {
        if (node.type !== 'link') return
        const extension = node['x-superboard']
        nextNode = {
          ...node,
          url: current.value,
          'x-superboard': {
            ...extension,
            kind: 'media',
            media: {
              ...extension?.media,
              kind: detectMediaKind(current.value),
              url: current.value,
            },
          },
        }
      } else if (current.kind === 'pele') {
        if (node.type !== 'text') return
        nextNode = {
          ...node,
          text: `\`\`\`mermaid\n${current.value}\n\`\`\``,
          height: measured,
          'x-superboard': { ...node['x-superboard'], kind: 'pele', code: current.value },
        }
      } else {
        if (node.type !== 'text') return
        nextNode = { ...node, text: current.value, height: measured }
      }
      onBeforeChange()
      onApply(
        {
          ...canvas,
          nodes: canvas.nodes.map((item, itemIndex) =>
            itemIndex === index ? nextNode : item,
          ),
        },
        [current.id],
      )
      return
    }
    if (current.value.trim() === '') return
    const existing = new Set<string>([
      ...canvas.nodes.map((node) => node.id),
      ...canvas.edges.map((edge) => edge.id),
    ])
    const id = nextFreeId(existing, 'text')
    const node: CanvasNode = {
      id,
      type: 'text',
      x: current.x,
      y: current.y,
      width: current.width,
      height: measured,
      text: current.value,
      'x-superboard': {
        kind: 'text',
        style: textStyleFromPreferences(),
      },
    }
    onBeforeChange()
    onApply({ ...canvas, nodes: [...canvas.nodes, node] }, [id])
    onExitTool()
  }

  useEffect(() => {
    onEditingChange?.(editing?.id ?? null)
  }, [editing?.id, onEditingChange])

  useEffect(() => {
    return () => {
      if (editingRef.current?.id) {
        setTextOverlayHidden(editingRef.current.id, false)
      }
    }
  }, [])

  useEffect(() => {
    if (!editing) return
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editing?.id, editing?.x, editing?.y, editing ? 'open' : 'closed'])

  useEffect(() => {
    const current = editingRef.current
    if (!current?.id) return
    const node = canvas.nodes.find((item) => item.id === current.id)
    if (!node) return
    const style = node['x-superboard']?.style
    updateEditing({
      ...current,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fontSize: style?.fontSize ?? current.fontSize,
      fontFamily: style?.fontFamily ?? current.fontFamily,
      color: style?.color ?? current.color,
      opacity: style?.opacity ?? current.opacity,
      textAlign: style?.textAlign ?? current.textAlign,
    })
  }, [canvas])

  return {
    editing,
    editingRef,
    textareaRef,
    suppressTextCreateRef,
    startEditing,
    commitEditing,
    updateEditing,
    resetEditing,
    editKindOf,
  }
}
