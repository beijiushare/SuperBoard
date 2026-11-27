import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
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
  desktopGetLanguage,
  installDesktopFolderBackend,
  restoreDesktopWorkspace,
} from '../../desktop/platform'
import {
  listRecentWorkspaces,
  openRecentWorkspace,
  openWorkspace,
  openWorkspaceFile,
  type WorkspaceRecentItem,
} from './workspacePlatform'
import { initI18n } from '../../i18n'
import { WelcomeLoading, WorkspaceWelcome } from './WorkspaceWelcome'
import { getPreferences } from './preferences'
import {
  installSampleWorkspace,
  sampleRecentItem,
} from './sampleWorkspace'

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

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 2500): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms)),
  ])
}

function EditorGate({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation(['editor', 'start'])
  const lockState = useSingleEditorLock()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [recent, setRecent] = useState<WorkspaceRecentItem[]>([])
  const supported =
    desktop ||
    (typeof window !== 'undefined' && 'showDirectoryPicker' in window)
  const startRequested =
    new URLSearchParams(window.location.search).get('start') === '1'
  const sampleRequested =
    new URLSearchParams(window.location.search).get('sample') === '1'

  const clearStartRequest = () => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('start') && !params.has('sample')) return
    params.delete('start')
    params.delete('sample')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    )
  }

  const finishOpen = () => {
    clearStartRequest()
    setReady(true)
  }

  const refreshRecent = () => {
    void withTimeout(listRecentWorkspaces(), [])
      .then((items) => setRecent(items))
      .catch(() => setRecent([]))
  }

  useEffect(() => {
    if (lockState !== 'ready') return
    if (sampleRequested) {
      installSampleWorkspace()
      setReady(true)
      setInitializing(false)
      return
    }
    if (!supported) {
      setInitializing(false)
      return
    }
    if (startRequested) {
      void withTimeout(listRecentWorkspaces(), [])
        .then(setRecent)
        .catch(() => setRecent([]))
        .finally(() => setInitializing(false))
      return
    }
    if (!getPreferences().autoOpenRecentWorkspace) {
      void withTimeout(listRecentWorkspaces(), [])
        .then(setRecent)
        .catch(() => setRecent([]))
        .finally(() => setInitializing(false))
      return
    }
    void (async () => {
      try {
        const restored = await withTimeout(
          (desktop ? restoreDesktopWorkspace() : restoreBrowserWorkspace()).then(
            (value) => Boolean(value),
          ),
          false,
        )
        if (restored) {
          setReady(true)
          return
        }
        // The saved workspace is gone; fall back to the most recent one that
        // needs no permission prompt. Browsers require a gesture for that.
        const items = await withTimeout(listRecentWorkspaces(), [])
        const next = items.find(
          (item) => item.available && item.permission !== 'prompt',
        )
        if (next && (await withTimeout(openRecentWorkspace(next), null))) {
          setReady(true)
          return
        }
        setRecent(items)
      } catch {
        refreshRecent()
      } finally {
        setInitializing(false)
      }
    })()
  }, [desktop, startRequested, sampleRequested, supported, lockState])

  const handleOpenFolder = () => {
    setBusy(true)
    setError('')
    void openWorkspace()
      .then((name) => {
        if (name) finishOpen()
        else refreshRecent()
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        refreshRecent()
      })
      .finally(() => setBusy(false))
  }

  const handleOpenSample = () => {
    installSampleWorkspace()
    const params = new URLSearchParams(window.location.search)
    params.delete('start')
    params.delete('board')
    params.delete('scope')
    params.set('sample', '1')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    )
    setReady(true)
  }

  const handleOpenRecent = (item: WorkspaceRecentItem) => {
    if (item.kind === 'sample') {
      handleOpenSample()
      return
    }
    setBusy(true)
    setError('')
    void openRecentWorkspace(item)
      .then((name) => {
        if (name) finishOpen()
        else refreshRecent()
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        refreshRecent()
      })
      .finally(() => setBusy(false))
  }

  if (lockState === 'blocked') {
    return (
      <div className="sb-screen-message">
        <h1>{t('editor:lock.title')}</h1>
        <p>{t('editor:lock.body')}</p>
        <p>{t('editor:lock.hint')}</p>
      </div>
    )
  }

  if (lockState === 'checking' || initializing) {
    return <WelcomeLoading desktop={desktop} />
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
    <WorkspaceWelcome
      desktop={desktop}
      busy={busy}
      error={error}
      supported={supported}
      recent={[...recent, sampleRecentItem()]}
      onOpenFolder={handleOpenFolder}
      onOpenRecent={handleOpenRecent}
    />
  )
}

async function boot() {  const desktop = await detectDesktop()
  let language: string | null = null
  if (desktop) {
    try {
      language = await desktopGetLanguage()
    } catch {
      language = null
    }
  }
  await initI18n(language)
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
