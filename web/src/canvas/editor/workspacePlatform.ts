import type { BoardScope } from '../../shared/board/types'
import {
  desktopDeleteFile,
  desktopFileUrl,
  desktopImportFile,
  desktopMode,
  desktopOpenFile,
  desktopRevealFile,
  desktopWorkspaceName,
  openDesktopWorkspace,
  type ImportedFile,
} from '../../desktop/platform'
import {
  browserFileUrl,
  browserWorkspaceName,
  importBrowserFile,
  openBrowserWorkspace,
} from './browserFolderBackend'

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
