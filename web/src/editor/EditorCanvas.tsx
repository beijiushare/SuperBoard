import { Tldraw, type Editor, type TLUiComponents, type TLUiOverrides } from 'tldraw'
import type { BoardFile, BoardScope } from '../shared/board/types'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'
import { EditorUiStateContext, type EditorUiState } from './editorUiState'

interface EditorCanvasProps {
  board: BoardFile | null
  scope: BoardScope
  components: Partial<TLUiComponents>
  overrides: TLUiOverrides
  uiState: EditorUiState
  onMount: (editor: Editor) => void
}

export function EditorCanvas({ board, scope, components, overrides, uiState, onMount }: EditorCanvasProps) {
  if (!board) {
    return (
      <main className="sb-canvas">
        <div className="sb-canvas-empty">
          <div>
            <h2>还没有白板</h2>
            <p>在左侧目录空白处右键新建白板，或先把 .tldr.json 放进 whiteboards/{scope}/。</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="sb-canvas">
      <EditorUiStateContext.Provider value={uiState}>
        <Tldraw
          key={`${scope}:${board.meta.slug}`}
          shapeUtils={superboardShapeUtils}
          components={components}
          overrides={overrides}
          licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
          onMount={onMount}
        />
      </EditorUiStateContext.Provider>
    </main>
  )
}
