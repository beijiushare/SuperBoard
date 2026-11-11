import type { BoardScope } from '../shared/board/types'
import { isBoardScope } from '../shared/board/types'

export function readScopeFromUrl() {
  const value = new URLSearchParams(window.location.search).get('scope')
  return isBoardScope(value) ? value : 'public'
}

export function updateBoardUrl(slug: string | null, scope: BoardScope) {
  const params = new URLSearchParams(window.location.search)
  if (slug) params.set('board', slug)
  else params.delete('board')
  if (scope === 'private') params.set('scope', 'private')
  else params.delete('scope')
  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}

export function isPathInside(path: string, folder: string) {
  return path === folder || path.startsWith(`${folder}/`)
}
