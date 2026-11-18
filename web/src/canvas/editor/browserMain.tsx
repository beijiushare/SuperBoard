import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../styles/index.css'
import { CanvasEditorApp } from './CanvasEditorApp'
import {
  installBrowserFolderBackend,
  openBrowserWorkspace,
  restoreBrowserWorkspace,
} from './browserFolderBackend'

installBrowserFolderBackend()

function BrowserEditorGate() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const supported =
    typeof window !== 'undefined' && 'showDirectoryPicker' in window

  useEffect(() => {
    if (!supported) {
      setBusy(false)
      return
    }
    void restoreBrowserWorkspace()
      .then((handle) => {
        if (handle) setReady(true)
      })
      .finally(() => setBusy(false))
  }, [supported])

  if (ready) return <CanvasEditorApp />

  return (
    <div className="sb-screen-message">
      <h1>SuperBoard 编辑器</h1>
      <p>
        选择一个本地文件夹作为工作区。会自动创建
        <code>whiteboards/public</code> 和 <code>whiteboards/private</code>。
      </p>
      {busy ? <p>正在检查上次的工作区…</p> : null}
      {supported ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError('')
            void openBrowserWorkspace()
              .then(() => setReady(true))
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : String(reason))
              })
              .finally(() => setBusy(false))
          }}
        >
          打开本地文件夹
        </button>
      ) : (
        <p>当前浏览器不支持 File System Access API，请使用 Edge 或 Chrome 桌面版。</p>
      )}
      {error ? <p>{error}</p> : null}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<BrowserEditorGate />)
