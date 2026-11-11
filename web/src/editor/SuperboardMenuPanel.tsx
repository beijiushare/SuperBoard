import { DefaultMenuPanel } from 'tldraw'
import { useEditorUiState } from './editorUiState'

export function SuperboardMenuPanel() {
  const { menuPanelOpen } = useEditorUiState()
  return menuPanelOpen ? <DefaultMenuPanel /> : null
}
