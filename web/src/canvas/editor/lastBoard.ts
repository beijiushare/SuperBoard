import type { BoardScope } from '../../shared/board/types'

const STORAGE_KEY = 'superboard.lastBoard.v1'

export interface LastBoardRecord {
  slug: string
  scope: BoardScope
  /** Distinguishes the read-only sample from local folders. */
  workspace?: 'sample' | 'folder'
}

/**
 * The board to reopen on launch. The desktop window always starts at `/`, so
 * the URL is not a reliable carrier here; localStorage survives restarts.
 * There is no workspace identity in the record, so callers must still verify
 * that the slug exists in the active workspace.
 */
export function readLastBoard(): LastBoardRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<LastBoardRecord> | null
    if (!value || typeof value.slug !== 'string' || !value.slug) return null
    return {
      slug: value.slug,
      scope: value.scope === 'private' ? 'private' : 'public',
      ...(value.workspace === 'sample' || value.workspace === 'folder'
        ? { workspace: value.workspace }
        : {}),
    }
  } catch {
    return null
  }
}

export function writeLastBoard(record: LastBoardRecord | null) {
  if (typeof window === 'undefined') return
  try {
    if (!record) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // localStorage may be unavailable; restoring the board is best effort.
  }
}
