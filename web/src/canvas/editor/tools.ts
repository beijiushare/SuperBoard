export type EditorTool =
  | 'select'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'draw'
  | 'eraser'
  | 'arrow'

export interface ToolDefinition {
  id: EditorTool
  label: string
  shortcut: string
}

export const TOOLS: ToolDefinition[] = [
  { id: 'select', label: '选择', shortcut: 'V' },
  { id: 'text', label: '文本', shortcut: 'T' },
  { id: 'rect', label: '矩形', shortcut: 'R' },
  { id: 'ellipse', label: '椭圆', shortcut: 'O' },
  { id: 'diamond', label: '菱形', shortcut: 'Y' },
  { id: 'line', label: '线条', shortcut: 'L' },
  { id: 'draw', label: '手写', shortcut: 'P' },
  { id: 'eraser', label: '橡皮擦', shortcut: 'E' },
  { id: 'arrow', label: '箭头', shortcut: 'A' },
]

export const TOOL_SHORTCUTS: Record<string, EditorTool> = Object.fromEntries(
  TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
)
