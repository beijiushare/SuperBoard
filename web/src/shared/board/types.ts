import type { TLStoreSnapshot } from 'tldraw'

export interface BoardMeta {
  title: string
  slug: string
  summary?: string
  order?: number
  draft?: boolean
  aliases?: string[]
  updatedAt?: string
}

export interface BoardFile {
  version: 1
  meta: BoardMeta
  document: TLStoreSnapshot
}

export interface BoardListItem {
  slug: string
  title: string
  summary?: string
  order?: number
  updatedAt?: string
}

export const BOARD_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export function isValidSlug(value: string) {
  return BOARD_SLUG_PATTERN.test(value)
}
