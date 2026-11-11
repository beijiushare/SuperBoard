import { createContext, useContext } from 'react'

export interface EditorUiState {
  stylePanelOpen: boolean
  menuPanelOpen: boolean
}

export const EditorUiStateContext = createContext<EditorUiState>({
  stylePanelOpen: false,
  menuPanelOpen: false,
})

export function useEditorUiState() {
  return useContext(EditorUiStateContext)
}
