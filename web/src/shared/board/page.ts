import type { BoardFile, BoardListItem } from './types'

export interface SuperBoardBoardData {
  board: BoardFile
  base: string
}

export interface SuperBoardTreeData {
  mode: 'tree'
  boards: BoardListItem[]
  base: string
}

export type SuperBoardPageData = SuperBoardBoardData | SuperBoardTreeData

declare global {
  interface Window {
    __SUPERBOARD__?: SuperBoardPageData
  }
}

export function isTreePageData(data: SuperBoardPageData | undefined): data is SuperBoardTreeData {
  return Boolean(data && 'mode' in data && data.mode === 'tree')
}
