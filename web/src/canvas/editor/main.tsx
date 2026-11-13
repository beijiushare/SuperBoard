import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../styles/index.css'
import { CanvasEditorApp } from './CanvasEditorApp'

class EditorErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[SuperBoard] 编辑器崩溃', error, info.componentStack)
  }

  render() {
    if (this.state.message) {
      return (
        <div className="sb-screen-message">
          <h1>编辑器出错</h1>
          <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {this.state.message}
          </pre>
          <button type="button" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <EditorErrorBoundary>
    <CanvasEditorApp />
  </EditorErrorBoundary>,
)
