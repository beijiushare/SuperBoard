import type { SuperBoardMediaKind } from '../model'

export type EditorTool =
  | 'select'
  | 'text'
  | 'rect'
  | 'rounded-rect'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'draw'
  | 'eraser'
  | 'arrow'

export interface ToolDefinition {
  id: EditorTool
  shortcut: string
}

export const TOOLS: ToolDefinition[] = [
  { id: 'select', shortcut: 'V' },
  { id: 'text', shortcut: 'T' },
  { id: 'rect', shortcut: 'R' },
  { id: 'ellipse', shortcut: 'O' },
  { id: 'diamond', shortcut: 'Y' },
  { id: 'line', shortcut: 'L' },
  { id: 'draw', shortcut: 'P' },
  { id: 'eraser', shortcut: 'E' },
  { id: 'arrow', shortcut: 'A' },
]

export const TOOL_SHORTCUTS: Record<string, EditorTool> = Object.fromEntries(
  TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
)

export function detectMediaKind(url: string): SuperBoardMediaKind {
  if (/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i.test(url)) return 'image'
  if (/\.(?:mp4|webm|ogv|mov|m4v)(?:[?#]|$)/i.test(url)) return 'video'
  return 'iframe'
}
