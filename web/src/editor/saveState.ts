export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export const SAVE_STATUS_LABEL: Record<SaveState, string> = {
  saved: '已保存',
  dirty: '未保存',
  saving: '保存中…',
  error: '保存失败',
}
