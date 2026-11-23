import { useEffect, useState } from 'react'
import { desktopMode, desktopWorkspacePath } from '../../desktop/platform'
import {
  forgetRecentWorkspace,
  listRecentWorkspaces,
  openRecentWorkspace,
  openWorkspace,
  workspaceName,
  type WorkspaceRecentItem,
} from './workspacePlatform'

/** Workspace list, switching and removal used by the general settings tab. */
export function usePreferencesWorkspace() {
  const [switching, setSwitching] = useState(false)
  const [workspacePath, setWorkspacePath] = useState('')
  const [recent, setRecent] = useState<WorkspaceRecentItem[]>([])
  const [protectedWorkspace, setProtectedWorkspace] =
    useState<WorkspaceRecentItem | null>(null)

  const refreshRecent = () => {
    void listRecentWorkspaces()
      .then(setRecent)
      .catch(() => setRecent([]))
  }

  useEffect(() => {
    refreshRecent()
  }, [])

  useEffect(() => {
    if (!desktopMode()) return
    let alive = true
    void desktopWorkspacePath().then((path) => {
      if (alive) setWorkspacePath(path)
    })
    return () => {
      alive = false
    }
  }, [])

  const currentWorkspace = workspacePath || workspaceName()

  function isCurrentWorkspace(item: WorkspaceRecentItem) {
    return item.path
      ? item.path === currentWorkspace
      : item.name === currentWorkspace
  }

  function openFolder() {
    setSwitching(true)
    void openWorkspace()
      .then(() => window.location.reload())
      .catch(() => setSwitching(false))
  }

  function switchToRecent(item: WorkspaceRecentItem) {
    if (!item.available || switching) return
    setSwitching(true)
    void openRecentWorkspace(item)
      .then(() => window.location.reload())
      .catch(() => setSwitching(false))
  }

  function removeRecent(item: WorkspaceRecentItem) {
    if (isCurrentWorkspace(item)) {
      setProtectedWorkspace(item)
      return
    }
    void forgetRecentWorkspace(item).then(refreshRecent)
  }

  function goStart() {
    const params = new URLSearchParams(window.location.search)
    params.set('start', '1')
    params.delete('board')
    params.delete('scope')
    window.location.href = `${window.location.pathname}?${params.toString()}`
  }

  return {
    recent,
    workspacePath,
    currentWorkspace,
    switching,
    protectedWorkspace,
    setProtectedWorkspace,
    isCurrentWorkspace,
    openFolder,
    switchToRecent,
    removeRecent,
    goStart,
  }
}
