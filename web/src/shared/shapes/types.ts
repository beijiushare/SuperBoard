import { T, type TLBaseShape } from 'tldraw'

export const SB_MARKDOWN_TYPE = 'sb-markdown'
export const SB_KANBAN_TYPE = 'sb-kanban'
export const SB_PELE_TYPE = 'sb-pele'

export const SUPERBOARD_EDIT_EVENT = 'superboard:edit-shape'

export interface SbMarkdownProps {
  w: number
  h: number
  text: string
}

export interface SbKanbanProps {
  w: number
  h: number
  text: string
}

export interface SbPeleProps {
  w: number
  h: number
  code: string
  diagram: string
}

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'sb-markdown': SbMarkdownProps
    'sb-kanban': SbKanbanProps
    'sb-pele': SbPeleProps
  }
}

export type SbMarkdownShape = TLBaseShape<'sb-markdown', SbMarkdownProps>
export type SbKanbanShape = TLBaseShape<'sb-kanban', SbKanbanProps>
export type SbPeleShape = TLBaseShape<'sb-pele', SbPeleProps>
export type SuperboardShape = SbMarkdownShape | SbKanbanShape | SbPeleShape

export const sbMarkdownProps = {
  w: T.number,
  h: T.number,
  text: T.string,
}

export const sbKanbanProps = {
  w: T.number,
  h: T.number,
  text: T.string,
}

export const sbPeleProps = {
  w: T.number,
  h: T.number,
  code: T.string,
  diagram: T.string,
}

export const sbShapeSchemas = {
  [SB_MARKDOWN_TYPE]: { props: sbMarkdownProps },
  [SB_KANBAN_TYPE]: { props: sbKanbanProps },
  [SB_PELE_TYPE]: { props: sbPeleProps },
}

export const DEFAULT_MARKDOWN_TEXT = `# 新卡片

这里支持 **Markdown**、表格、代码块和 AsciiMath。

行内公式：$a^2 + b^2 = c^2$

$$
sum_(i=1)^n i = (n(n+1))/2
$$
`

export const DEFAULT_KANBAN_TEXT = `## 待办
- 梳理本周目标
- 收集资料

## 进行中
- 制作第一版白板

## 完成
- 创建 SuperBoard
`

export const DEFAULT_PELE_CODE = `flowchart LR
  A[想法] --> B[白板]
  B --> C{发布}
  C -->|是| D[GitHub Pages]
  C -->|否| B
`

export const PELE_DIAGRAM_OPTIONS = [
  ['flowchart', 'Flowchart'],
  ['sequence', 'Sequence'],
  ['class', 'Class'],
  ['state', 'State'],
  ['er', 'ER'],
  ['gantt', 'Gantt'],
  ['mindmap', 'Mindmap'],
  ['pie', 'Pie'],
  ['journey', 'Journey'],
  ['timeline', 'Timeline'],
  ['gitGraph', 'Git Graph'],
  ['xychart', 'XY Chart'],
  ['quadrantChart', 'Quadrant'],
  ['requirement', 'Requirement'],
  ['c4', 'C4'],
  ['sankey', 'Sankey'],
  ['block', 'Block'],
  ['kanban', 'Kanban'],
  ['architecture', 'Architecture'],
  ['radar', 'Radar'],
  ['treemap', 'Treemap'],
  ['swimlane', 'Swimlane'],
] as const
