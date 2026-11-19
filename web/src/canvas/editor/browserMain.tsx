import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../styles/index.css'
import { CanvasEditorApp } from './CanvasEditorApp'
import { FolderMoveOverlay } from './FolderMoveOverlay'
import {
  installBrowserFolderBackend,
  openBrowserWorkspace,
  restoreBrowserWorkspace,
} from './browserFolderBackend'

installBrowserFolderBackend()

const LOCK_NAME = 'superboard-editor'

type LockState = 'checking' | 'ready' | 'blocked'

function useSingleEditorLock(): LockState {
  const [state, setState] = useState<LockState>('checking')

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('locks' in navigator)) {
      setState('ready')
      return
    }
    let cancelled = false
    let release: (() => void) | null = null
    void navigator.locks.request(
      LOCK_NAME,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (cancelled) return
        if (!lock) {
          setState('blocked')
          return
        }
        setState('ready')
        await new Promise<void>((resolve) => {
          release = resolve
          window.addEventListener('pagehide', () => resolve(), { once: true })
        })
      },
    )
    return () => {
      cancelled = true
      release?.()
    }
  }, [])

  return state
}

function BrowserEditorGate() {
  const lockState = useSingleEditorLock()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const supported =
    typeof window !== 'undefined' && 'showDirectoryPicker' in window

  useEffect(() => {
    if (lockState !== 'ready') return
    if (!supported) {
      setBusy(false)
      return
    }
    void restoreBrowserWorkspace()
      .then((handle) => {
        if (handle) setReady(true)
      })
      .finally(() => setBusy(false))
  }, [supported, lockState])

  if (lockState === 'blocked') {
    return (
      <div className="sb-screen-message">
        <h1>SuperBoard 已在其他标签页打开</h1>
        <p>为避免同时写入同一批文件，编辑器只允许一个标签页运行。</p>
        <p>请关闭原来的标签页，然后刷新本页。</p>
      </div>
    )
  }

  if (lockState === 'checking') {
    return (
      <div className="sb-screen-message">
        <h1>SuperBoard 编辑器</h1>
        <p>正在检查编辑锁…</p>
      </div>
    )
  }

  if (ready) {
    return (
      <>
        <CanvasEditorApp />
        <FolderMoveOverlay />
      </>
    )
  }

  return (
    <div className="sb-screen-message">
      <h1>SuperBoard 编辑器</h1>
      <p>
        选择一个文件夹作为工作区。建议其中包含 <code>public</code> 和{' '}
        <code>private</code> 子目录；不存在会自动创建。
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
