import { useCallback, useEffect, useState, type MutableRefObject } from 'react'
import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import {
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_PELE_CODE,
  DEFAULT_SB_BLOCK_STYLE,
  DEFAULT_SB_PELE_STYLE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  SUPERBOARD_EDIT_EVENT,
  isSuperboardShapeType,
  type SbMarkdownShape,
  type SbPeleShape,
  type SuperboardShapeType,
} from '../shared/shapes/types'
import type { EditingShape } from './shape-editor/types'

interface UseShapeEditingOptions {
  editorRef: MutableRefObject<Editor | null>
}

export function useShapeEditing({ editorRef }: UseShapeEditingOptions) {
  const [editing, setEditing] = useState<EditingShape | null>(null)

  useEffect(() => {
    const onEdit = (event: Event) => {
      const detail = (event as CustomEvent<{ shapeId?: string }>).detail
      const editor = editorRef.current
      if (!editor || !detail?.shapeId) return
      const shape = editor.getShape(detail.shapeId as TLShapeId)
      if (!shape || !isSuperboardShapeType(shape.type)) return
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
  }, [editorRef])

  const addShape = useCallback(
    (type: SuperboardShapeType) => {
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
    },
    [editorRef],
  )

  const saveEdit = useCallback(
    (patch: Record<string, unknown>) => {
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
            props: { ...DEFAULT_SB_BLOCK_STYLE, w: 460, h: 340, baseH: 340, text },
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
    },
    [editing, editorRef],
  )

  return { editing, setEditing, addShape, saveEdit }
}
