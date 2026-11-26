import type { BoardScope } from '../../shared/board/types'
import type { CanvasNode } from '../model'
import {
  desktopDeleteFile,
  desktopFileUrl,
  desktopForgetWorkspace,
  desktopImportFile,
  desktopMode,
  desktopOpenFile,
  desktopOpenWorkspacePath,
  desktopPickFiles,
  desktopRecentWorkspaces,
  desktopRevealFile,
  desktopSetLanguage,
  desktopWorkspaceName,
  openDesktopWorkspace,
  type ImportedFile,
} from '../../desktop/platform'
import {
  browserFileUrl,
  browserWorkspaceName,
  forgetBrowserRecent,
  importBrowserFile,
  listBrowserRecent,
  openBrowserRecent,
  openBrowserWorkspace,
} from './browserFolderBackend'
import { setAppLanguage } from '../../i18n'

export function workspaceName() {
  return desktopMode() ? desktopWorkspaceName() : browserWorkspaceName()
}

export function canOpenWorkspace() {
  return desktopMode() || (typeof window !== 'undefined' && 'showDirectoryPicker' in window)
}

export async function openWorkspace() {
  if (desktopMode()) return openDesktopWorkspace()
  const handle = await openBrowserWorkspace()
  return handle.name
}

export async function importLocalFile(
  file: File,
  scope: BoardScope,
): Promise<ImportedFile> {
  if (desktopMode()) return desktopImportFile(file, scope)
  const path = await importBrowserFile(file, scope)
  return { path, name: file.name, mime: file.type, size: file.size }
}

export async function pickLocalFiles(
  scope: BoardScope,
): Promise<ImportedFile[]> {
  if (!desktopMode()) return []
  return desktopPickFiles(scope)
}

export async function resolveWorkspaceFileUrl(path: string) {
  return desktopMode() ? desktopFileUrl(path) : browserFileUrl(path)
}

export async function openWorkspaceFile(path: string) {
  if (desktopMode()) {
    await desktopOpenFile(path)
    return
  }
  const url = await browserFileUrl(path)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export async function revealWorkspaceFile(path: string) {
  if (desktopMode()) await desktopRevealFile(path)
}

export async function deleteWorkspaceFile(path: string) {
  if (desktopMode()) await desktopDeleteFile(path)
}

export function supportsDesktopFileActions() {
  return desktopMode()
}

export function nodeFilePath(node: CanvasNode | undefined) {
  if (!node) return undefined
  const media = node['x-superboard']?.media
  if (media?.file) return media.file
  return node.type === 'file' ? node.file : undefined
}

export interface WorkspaceRecentItem {
  id: string
  name: string
  path?: string
  lastOpened?: string
  available: boolean
  permission?: string
  /** `sample` is the built-in read-only workspace. */
  kind?: 'folder' | 'sample'
  /** Pinned entries cannot be removed. */
  pinned?: boolean
}

export async function listRecentWorkspaces(): Promise<WorkspaceRecentItem[]> {
  if (desktopMode()) {
    const rows = await desktopRecentWorkspaces()
    return rows.map((row) => ({
      id: row.path,
      name: row.name,
      path: row.path,
      lastOpened: row.lastOpened,
      available: row.available,
    }))
  }
  return listBrowserRecent()
}

export async function openRecentWorkspace(item: WorkspaceRecentItem) {
  if (desktopMode()) {
    return desktopOpenWorkspacePath(item.path ?? item.id)
  }
  return openBrowserRecent(item.id)
}

export async function forgetRecentWorkspace(item: WorkspaceRecentItem) {
  if (desktopMode()) {
    await desktopForgetWorkspace(item.path ?? item.id)
    return
  }
  await forgetBrowserRecent(item.id)
}

export async function changeAppLanguage(language: string) {
  const next = await setAppLanguage(language)
  if (desktopMode()) await desktopSetLanguage(next)
  return next
}
