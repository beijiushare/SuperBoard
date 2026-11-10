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

export type PeleDiagram = (typeof PELE_DIAGRAM_OPTIONS)[number][0]

export const PELE_EXAMPLES: Record<PeleDiagram, string> = {
  flowchart: `flowchart LR
  A[想法] --> B[白板]
  B --> C{发布}
  C -->|是| D[GitHub Pages]
  C -->|否| B
`,
  sequence: `sequenceDiagram
  autonumber
  participant U as 用户
  participant S as SuperBoard
  U->>S: 打开白板
  S-->>U: 渲染内容
  U->>S: 双击图表
  S-->>U: 打开源码编辑器
`,
  class: `classDiagram
  class Board {
    +String title
    +save() void
  }
  class Shape {
    +String type
    +render() void
  }
  Board "1" o-- "*" Shape : contains
`,
  state: `stateDiagram-v2
  state "草稿" as Draft
  state "进行中" as Doing
  state "已完成" as Done
  [*] --> Draft
  Draft --> Doing : 开始编辑
  Doing --> Done : 发布
  Done --> [*]
`,
  er: `erDiagram
  BOARD ||--o{ SHAPE : contains
  BOARD {
    string slug PK
    string title
  }
  SHAPE {
    string id PK
    string type
  }
`,
  gantt: `gantt
  title 项目排期
  dateFormat YYYY-MM-DD
  section 设计
  需求梳理 :a1, 2026-01-05, 3d
  视觉设计 :a2, after a1, 4d
  section 开发
  前端实现 :b1, after a2, 6d
  测试上线 :b2, after b1, 2d
`,
  mindmap: `mindmap
  root((SuperBoard))
    白板
      Markdown
      看板
      图表
    协作
      评论
      分享
`,
  pie: `pie showData
  title 时间分配
  "设计" : 30
  "开发" : 45
  "测试" : 15
  "文档" : 10
`,
  journey: `journey
  title 使用白板的一天
  section 上午
    收集灵感: 5: 我
    整理笔记: 4: 我
  section 下午
    团队同步: 3: 我, 同事
    发布方案: 5: 我
`,
  timeline: `timeline
  title SuperBoard 路线图
  2025 : 构思
  2026 : 目录树
       : 图表模板
  2027 : 实时协作
`,
  gitGraph: `gitGraph
  commit id: "init"
  branch feature
  checkout feature
  commit id: "tree"
  commit id: "charts"
  checkout main
  merge feature
  commit id: "release"
`,
  xychart: `xychart
  title "每周使用量"
  x-axis ["周一", "周二", "周三", "周四", "周五"]
  y-axis "次数" 0 --> 50
  bar "编辑" [18, 24, 20, 28, 34]
  line "分享" [6, 9, 12, 10, 16]
`,
  quadrantChart: `quadrantChart
  title 功能优先级
  x-axis 低影响 --> 高影响
  y-axis 低成本 --> 高成本
  quadrant-1 优先做
  quadrant-2 计划做
  quadrant-3 暂缓
  quadrant-4 谨慎做
  "目录树": [0.85, 0.2]
  "图表模板": [0.7, 0.35]
  "实时协作": [0.9, 0.8]
  "移动端": [0.4, 0.7]
`,
  requirement: `requirementDiagram
  requirement auto_save {
    id: 1
    text: Save the board automatically after editing
    risk: low
    verifymethod: test
  }
  element editor {
    type: component
  }
  editor - satisfies -> auto_save
`,
  c4: `C4Context
  title SuperBoard 系统上下文
  Person(user, "用户", "使用白板整理内容")
  System(board, "SuperBoard", "可视化白板工具")
  System_Ext(fs, "文件系统", "保存 .tldr.json")
  Rel(user, board, "创建、编辑")
  Rel(board, fs, "读写")
`,
  sankey: `sankey-beta
用户,打开白板,80
用户,浏览目录,20
浏览目录,打开白板,15
打开白板,编辑内容,60
`,
  block: `block-beta
  columns 2
  editor["编辑器"] canvas["画布"]
  tree["目录树"] menu["右键菜单"]
  tree --> editor
  editor --> canvas
`,
  kanban: `kanban
  todo[待办]
    t1[整理需求]
    t2[设计界面]
  doing[进行中]
    t3[实现目录树]
  done[已完成]
    t4[搭建项目]
`,
  architecture: `architecture-beta
  service client(cloud)[用户]
  service app(server)[SuperBoard]
  service files(database)[文件系统]
  client:R -- L:app
  app:R -- L:files
`,
  radar: `radar-beta
  title 产品能力
  axis design["设计"], build["开发"], docs["文档"], test["测试"]
  curve now["当前"]{4, 5, 3, 2}
  max 5
`,
  treemap: `treemap-beta
"SuperBoard"
    "编辑器"
        "Markdown": 30
        "看板": 20
        "图表": 15
    "目录树"
        "右键菜单": 15
    "静态站"
        "构建": 20
`,
  swimlane: `swimlane-beta LR
  subgraph user [用户]
    open[打开白板]
    edit[编辑内容]
  end
  subgraph app [SuperBoard]
    render[渲染画布]
    save[自动保存]
  end
  open --> render
  render --> edit
  edit --> save
`,
}

export const DEFAULT_PELE_CODE = PELE_EXAMPLES.flowchart
