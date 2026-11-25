import type { BoardScope } from '../../shared/board/types'
import i18n from '../../i18n'
import { translateServerError } from '../../i18n/errors'
import type { CanvasDocument } from '../model'
import type { CanvasListItem } from './appUtils'
import { historySettings } from './preferences'

export interface WorkspaceFolders {
  path: string
  scope: BoardScope
}

export const WORKSPACE_VERSION_KEY = 'superboard.workspaceVersion'

export function notifyWorkspaceChanged() {
  try {
    window.localStorage.setItem(WORKSPACE_VERSION_KEY, String(Date.now()))
  } catch {
    // localStorage may be unavailable; refresh is best effort.
  }
}

let workspaceFetcher: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null =
  null

export function configureWorkspaceFetcher(
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  workspaceFetcher = fetcher
}

function request(input: RequestInfo | URL, init?: RequestInit) {
  if (workspaceFetcher) return workspaceFetcher(input, init)
  return window.fetch(input, init)
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await request(url, init)
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new WorkspaceError(
      data?.error
        ? translateServerError(data.error)
        : i18n.t('editor:workspace.requestFailed', { status: response.status }),
      response.status,
    )
  }
  return (await response.json()) as T
}

export class WorkspaceError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'WorkspaceError'
    this.status = status
  }
}

export async function loadWorkspace() {
  const [boardsResponse, foldersResponse] = await Promise.all([
    request('/__canvases'),
    request('/__folders'),
  ])
  if (!boardsResponse.ok) {
    throw new Error(i18n.t('editor:workspace.loadFailed', { status: boardsResponse.status }))
  }
  const boards = (await boardsResponse.json()) as {
    canvases: CanvasListItem[]
  }
  let folders: WorkspaceFolders[] = []
  if (foldersResponse.ok) {
    const data = (await foldersResponse.json()) as {
      folders: WorkspaceFolders[]
    }
    folders = data.folders ?? []
  }
  return { boards: boards.canvases ?? [], folders }
}

export async function readBoard(item: CanvasListItem) {
  return json<CanvasDocument>(
    `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
  )
}

export async function writeBoard(
  item: CanvasListItem,
  canvas: CanvasDocument,
  force = false,
) {
  const history = historySettings()
  return json<{ ok: true }>(
    `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}` +
      `&historyInterval=${history.intervalSeconds}` +
      `&historyLimit=${history.limit}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(force ? { 'x-superboard-force': '1' } : {}),
      },
      body: JSON.stringify(canvas),
    },
  )
}

export interface BoardHistoryEntry {
  id: string
  createdAt: string
  size: number
}

export async function listBoardHistory(item: CanvasListItem) {
  return json<{ entries: BoardHistoryEntry[]; totalSize: number }>(
    `/__canvases/${encodeURIComponent(item.slug)}/history?scope=${item.scope}`,
  )
}

export async function getBoardHistoryEntry(
  item: CanvasListItem,
  entryId: string,
) {
  return json<CanvasDocument>(
    `/__canvases/${encodeURIComponent(item.slug)}/history/${entryId}` +
      `?scope=${item.scope}`,
  )
}

export async function restoreBoardHistory(
  item: CanvasListItem,
  entryId: string,
) {
  const history = historySettings()
  return json<{ ok: true; canvas: CanvasDocument }>(
    `/__canvases/${encodeURIComponent(item.slug)}/history/${entryId}/restore` +
      `?scope=${item.scope}&historyLimit=${history.limit}`,
    { method: 'POST' },
  )
}

export async function clearBoardHistory(item: CanvasListItem) {
  return json<{ ok: true }>(
    `/__canvases/${encodeURIComponent(item.slug)}/history?scope=${item.scope}`,
    { method: 'DELETE' },
  )
}

export async function historyStats() {
  return json<{ totalSize: number; count: number }>('/__history')
}

export async function clearAllHistory() {
  return json<{ ok: true }>('/__history', { method: 'DELETE' })
}

export async function createBoard(values: {
  title: string
  slug: string
  folder?: string
  scope: BoardScope
}) {
  return json<{ canvas: CanvasDocument; path: string }>('/__canvases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
}

export async function updateBoard(
  item: CanvasListItem,
  values: {
    title: string
    slug: string
    folder: string
    summary?: string
  },
) {
  return json<{ canvas: CanvasDocument; path: string }>(
    `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    },
  )
}

export async function deleteBoard(item: CanvasListItem) {
  return json<{ ok: true }>(
    `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
    { method: 'DELETE' },
  )
}

export async function createFolder(values: {
  parent: string
  name: string
  scope: BoardScope
}) {
  return json<{ path: string }>('/__folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
}

export async function updateFolder(values: {
  path: string
  name: string
  parent: string
  scope: BoardScope
}) {
  return json<{ path: string }>('/__folders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
}

export async function deleteFolder(path: string, scope: BoardScope) {
  return json<{ ok: true }>(
    `/__folders?path=${encodeURIComponent(path)}&scope=${scope}`,
    { method: 'DELETE' },
  )
}
