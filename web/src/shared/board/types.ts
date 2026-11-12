export type BoardScope = 'public' | 'private'

export const BOARD_SCOPES: BoardScope[] = ['public', 'private']

export function isBoardScope(value: unknown): value is BoardScope {
  return value === 'public' || value === 'private'
}

export interface DirectorFrame {
  id: string
  order: number
  name?: string
  x: number
  y: number
  w: number
  h: number
}

export interface BoardListItem {
  slug: string
  title: string
  summary?: string
  order?: number
  updatedAt?: string
  path: string
  scope?: BoardScope
}

export interface BoardTreeFile extends BoardListItem {
  type: 'file'
  name: string
}

export interface BoardTreeFolder {
  type: 'folder'
  name: string
  path: string
  children: BoardTreeNode[]
}

export type BoardTreeNode = BoardTreeFile | BoardTreeFolder

export const BOARD_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export function isValidSlug(value: string) {
  return BOARD_SLUG_PATTERN.test(value)
}
