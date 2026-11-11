import { createContext, useContext } from 'react'

export interface EditorUiState {
  stylePanelOpen: boolean
  menuPanelOpen: boolean
  presenterMode: boolean
}

export const EditorUiStateContext = createContext<EditorUiState>({
  stylePanelOpen: false,
  menuPanelOpen: false,
  presenterMode: false,
})

export function useEditorUiState() {
  return useContext(EditorUiStateContext)
}
