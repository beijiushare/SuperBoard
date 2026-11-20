import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Events } from '@wailsio/runtime'
import '../../styles/index.css'
import { CanvasEditorApp } from './CanvasEditorApp'
import { FolderMoveOverlay } from './FolderMoveOverlay'
import {
  browserFileUrl,
  installBrowserFolderBackend,
  restoreBrowserWorkspace,
} from './browserFolderBackend'
import { setFileOpener, setFileUrlResolver } from '../viewer/fileResolver'
import {
  detectDesktop,
  desktopFileUrl,
  installDesktopFolderBackend,
  restoreDesktopWorkspace,
} from '../../desktop/platform'
import { openWorkspace, openWorkspaceFile } from './workspacePlatform'

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

function EditorGate({ desktop }: { desktop: boolean }) {
  const lockState = useSingleEditorLock()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const supported =
    desktop ||
    (typeof window !== 'undefined' && 'showDirectoryPicker' in window)

  useEffect(() => {
    if (lockState !== 'ready') return
    if (!supported) {
      setBusy(false)
      return
    }
    const restore = desktop
      ? restoreDesktopWorkspace
      : () => restoreBrowserWorkspace()
    void restore()
      .then((value) => {
        if (value) setReady(true)
      })
      .finally(() => setBusy(false))
  }, [desktop, supported, lockState])

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
            void openWorkspace()
              .then((name) => {
                if (name) setReady(true)
              })
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : String(reason))
              })
              .finally(() => setBusy(false))
          }}
        >
          选择工作区文件夹
        </button>
      ) : (
        <p>
          当前浏览器不支持 File System Access API，请使用 Edge 或 Chrome 桌面版，
          或改用 SuperBoard 桌面端。
        </p>
      )}
      {error ? <p>{error}</p> : null}
    </div>
  )
}

async function boot() {
  const desktop = await detectDesktop()
  document.documentElement.dataset.platform = desktop ? 'desktop' : 'browser'
  if (desktop) {
    installDesktopFolderBackend()
    setFileUrlResolver(desktopFileUrl)
    void Events.On('superboard:open', (event) => {
      const data = (event.data ?? {}) as { scope?: string; slug?: string }
      if (!data.slug) return
      const params = new URLSearchParams(window.location.search)
      params.set('board', data.slug)
      if (data.scope === 'private') params.set('scope', 'private')
      else params.delete('scope')
      window.location.search = params.toString()
    })
  } else {
    installBrowserFolderBackend()
    setFileUrlResolver(browserFileUrl)
  }
  createRoot(document.getElementById('root')!).render(
    <EditorGate desktop={desktop} />,
  )
}

setFileOpener(openWorkspaceFile)

void boot()
