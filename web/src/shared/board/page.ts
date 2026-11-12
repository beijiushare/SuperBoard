import type { CanvasDocument } from '../../canvas/model'

export interface CanvasTreeItem {
  slug: string
  title: string
  summary?: string
  order?: number
  updatedAt?: string
  path: string
}

export interface SuperBoardBoardData {
  canvas: CanvasDocument
  base: string
}

export interface SuperBoardTreeData {
  mode: 'tree'
  canvases: CanvasTreeItem[]
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
