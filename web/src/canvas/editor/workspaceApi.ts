import type { BoardScope } from '../../shared/board/types'
import type { CanvasDocument } from '../model'
import type { CanvasListItem } from './appUtils'

export interface WorkspaceFolders {
  path: string
  scope: BoardScope
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`请求失败（${response.status}）`)
  }
  return (await response.json()) as T
}

export async function loadWorkspace() {
  const [boardsResponse, foldersResponse] = await Promise.all([
    fetch('/__canvases'),
    fetch('/__folders'),
  ])
  if (!boardsResponse.ok) {
    throw new Error(`加载失败（${boardsResponse.status}）`)
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

export async function writeBoard(item: CanvasListItem, canvas: CanvasDocument) {
  return json<{ ok: true }>(
    `/__canvases/${encodeURIComponent(item.slug)}?scope=${item.scope}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(canvas),
    },
  )
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
