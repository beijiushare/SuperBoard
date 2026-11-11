import { SUPERBOARD_EDIT_EVENT, SUPERBOARD_MEDIA_EVENT } from './types'

interface ReadonlyEditor {
  getInstanceState: () => { isReadonly: boolean }
}

export function requestShapeEdit(editor: ReadonlyEditor, shapeId: string) {
  if (editor.getInstanceState().isReadonly) return
  window.dispatchEvent(new CustomEvent(SUPERBOARD_EDIT_EVENT, { detail: { shapeId } }))
}

export function requestMediaEdit(editor: ReadonlyEditor, shapeId: string) {
  if (editor.getInstanceState().isReadonly) return
  window.dispatchEvent(new CustomEvent(SUPERBOARD_MEDIA_EVENT, { detail: { shapeId } }))
}
