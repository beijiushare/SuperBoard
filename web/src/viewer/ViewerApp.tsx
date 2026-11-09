import { Tldraw, type Editor } from 'tldraw'
import { isTreePageData } from '../shared/board/page'
import { superboardShapeUtils } from '../shared/shapes/shapeUtils'

export function ViewerApp() {
  const data = window.__SUPERBOARD__

  if (!data || isTreePageData(data)) {
    return (
      <div className="sb-screen-message">
        <h1>没有找到白板数据</h1>
        <p>这个页面需要由 SuperBoard 构建脚本生成。</p>
      </div>
    )
  }

  const { board } = data
  document.title = `${board.meta.title} · SuperBoard`

  function handleMount(editor: Editor) {
    editor.loadSnapshot(board.document)
    editor.updateInstanceState({ isReadonly: true })
    editor.zoomToFit({ animation: { duration: 0 } })
    editor.setCurrentTool('select')
  }

  return (
    <div className="sb-viewer">
      <Tldraw
        hideUi
        shapeUtils={superboardShapeUtils}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
        onMount={handleMount}
      />
      <div className="sb-viewer-badge">
        <a href={import.meta.env.BASE_URL}>← 所有白板</a>
        <span>{board.meta.title}</span>
      </div>
    </div>
  )
}
