import { useCallback, useEffect, useState, type MutableRefObject } from 'react'
import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import {
  SB_MEDIA_TYPE,
  SUPERBOARD_MEDIA_EVENT,
  type SbMediaShape,
} from '../shared/shapes/types'
import { getMediaAspect } from './media/mediaSize'
import type { MediaSource } from './media/parseMedia'

export type MediaDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; shapeId: string; initialValue: string }

interface UseMediaControllerOptions {
  editorRef: MutableRefObject<Editor | null>
}

export function useMediaController({ editorRef }: UseMediaControllerOptions) {
  const [mediaDialog, setMediaDialog] = useState<MediaDialogState | null>(null)

  useEffect(() => {
    const onEditMedia = (event: Event) => {
      const detail = (event as CustomEvent<{ shapeId?: string }>).detail
      const editor = editorRef.current
      if (!editor || !detail?.shapeId) return
      const shape = editor.getShape(detail.shapeId as TLShapeId)
      if (!shape || shape.type !== SB_MEDIA_TYPE) return
      const props = shape.props as { url?: unknown }
      setMediaDialog({
        mode: 'edit',
        shapeId: shape.id,
        initialValue: typeof props.url === 'string' ? props.url : '',
      })
    }

    window.addEventListener(SUPERBOARD_MEDIA_EVENT, onEditMedia)
    return () => window.removeEventListener(SUPERBOARD_MEDIA_EVENT, onEditMedia)
  }, [editorRef])

  const openMediaCreate = useCallback(() => {
    setMediaDialog({ mode: 'create' })
  }, [])

  const closeMediaDialog = useCallback(() => {
    setMediaDialog(null)
  }, [])

  const saveMedia = useCallback(
    async (source: MediaSource) => {
      const editor = editorRef.current
      const current = mediaDialog
      if (!editor || !current) return

      let width = 640
      let height = 360
      if (source.kind !== 'iframe') {
        const ratio = await getMediaAspect(source.url, source.kind)
        if (ratio) {
          if (ratio >= 1) {
            height = Math.round(width / ratio)
          } else {
            height = 640
            width = Math.round(height * ratio)
          }
        }
      }

      if (current.mode === 'create') {
        const id = createShapeId()
        const bounds = editor.getViewportScreenBounds()
        const center = editor.screenToPage({
          x: bounds.x + bounds.w / 2,
          y: bounds.y + bounds.h / 2,
        })
        const offset = (editor.getCurrentPageShapes().length % 6) * 24
        editor.createShape<SbMediaShape>({
          id,
          type: SB_MEDIA_TYPE,
          x: center.x - width / 2 + offset,
          y: center.y - height / 2 + offset,
          props: {
            w: width,
            h: height,
            url: source.url,
            kind: source.kind,
            crop: 'rounded',
            cropX: 0,
            cropY: 0,
            cropW: 100,
            cropH: 100,
            cropCx: 50,
            cropCy: 50,
            cropRadius: 50,
            cropCorner: 8,
          },
        })
        editor.select(id)
      } else {
        const shape = editor.getShape<SbMediaShape>(current.shapeId as TLShapeId)
        if (shape) {
          editor.updateShape<SbMediaShape>({
            id: shape.id,
            type: SB_MEDIA_TYPE,
            props: { ...shape.props, url: source.url, kind: source.kind },
          })
        }
      }

      setMediaDialog(null)
    },
    [editorRef, mediaDialog],
  )

  return { mediaDialog, openMediaCreate, closeMediaDialog, saveMedia }
}
