import type { BoardFile } from '../../shared/board/types'

export interface ScannedBoard {
  file: string
  folder: string
  board: BoardFile
}

export interface CreateBoardBody {
  title?: unknown
  slug?: unknown
  folder?: unknown
  summary?: unknown
}

export interface PatchBoardBody {
  title?: unknown
  slug?: unknown
  folder?: unknown
  summary?: unknown
}

export interface RenameFolderBody {
  path?: unknown
  name?: unknown
}
