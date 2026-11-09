import type { BoardFile, BoardListItem, BoardMeta } from '../shared/board/types'

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(response.ok ? '服务器返回了无效 JSON' : text || response.statusText)
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `请求失败（${response.status}）`
    throw new Error(message)
  }

  return payload as T
}

export async function fetchBoards(): Promise<BoardListItem[]> {
  const response = await fetch('/__boards', { headers: { Accept: 'application/json' } })
  const result = await readJson<{ boards: BoardListItem[] }>(response)
  return result.boards
}

export async function fetchBoard(slug: string): Promise<BoardFile> {
  const response = await fetch(`/__boards/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  })
  return readJson<BoardFile>(response)
}

export interface SaveBoardResult {
  ok: boolean
  hash: string
  meta: BoardMeta
}

export async function putBoard(slug: string, board: BoardFile): Promise<SaveBoardResult> {
  const response = await fetch(`/__boards/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(board),
  })
  return readJson<SaveBoardResult>(response)
}
