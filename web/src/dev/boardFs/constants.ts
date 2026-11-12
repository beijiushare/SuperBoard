import blankDocumentData from '../../shared/board/blank-document.json'
import type { BoardDocument } from '../../shared/board/types'

export const BOARDS_DIR = 'whiteboards'
export const BLANK_DOCUMENT = blankDocumentData as unknown as BoardDocument
export const RESERVED_FOLDER_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
