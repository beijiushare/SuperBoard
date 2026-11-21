import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../styles/index.css'
import i18n from '../../i18n'
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
    console.error('[SuperBoard] editor crashed', error, info.componentStack)
  }

  render() {
    if (this.state.message) {
      return (
        <div className="sb-screen-message">
          <h1>{i18n.t('editor:error.title')}</h1>
          <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {this.state.message}
          </pre>
          <button type="button" onClick={() => window.location.reload()}>
            {i18n.t('editor:error.reload')}
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
