# 数据格式

白板文件是 JSON Canvas 1.0 的超集，扩展字段统一放在 `x-superboard`。

## 顶层

```json
{
  "nodes": [],
  "edges": [],
  "x-superboard": {
    "version": 1,
    "meta": { "title": "示例", "slug": "example" },
    "director": { "frames": [] },
    "settings": {}
  }
}
```

- `nodes` / `edges` 遵循 JSON Canvas 标准；标准查看器可以打开。
- `x-superboard` 是 SuperBoard 的扩展根，缺失时按默认值处理。
- `version` 目前固定为 `1`。
- `meta.title` 不能为空，`meta.slug` 必须匹配 `^[a-z0-9][a-z0-9-]*$`。

## 根扩展

```ts
interface SuperBoardRootExtension {
  version: 1
  meta: CanvasMeta
  director?: { frames: CanvasFrame[] }
  settings?: SuperBoardCanvasSettings
}

interface CanvasMeta {
  title: string
  slug: string
  summary?: string
  order?: number
  draft?: boolean
  aliases?: string[]
  updatedAt?: string
}

interface SuperBoardCanvasSettings {
  background?: string
  backgroundOpacity?: number
  grid?: 'none' | 'dots' | 'lines'
  zoomMin?: number
  zoomMax?: number
  defaultBlockWidth?: number
  defaultBlockHeight?: number
  viewport?: { offsetX: number; offsetY: number; scale: number }
}
```

`settings.viewport` 是白板自己的相机；前端另外在 `localStorage` 里按 `scope:slug` 存一份视口，用于快速恢复。

## 节点

标准节点有 `text` / `file` / `link` / `group`。SuperBoard 用 `x-superboard.kind` 决定具体渲染：

| kind | 标准节点 | 用途 |
| --- | --- | --- |
| `text` | `text` | 普通文本，支持字体、字号、颜色、对齐 |
| `markdown` | `text` | Markdown，Vditor 渲染 |
| `pele` | `text` | Pele 图表，源码在 `node.text` 或 `x-superboard.diagram` |
| `schedule` | `text` | 日程表，事件在 `x-superboard.scheduleEvents` |
| `media` | `link` / `file` | 图片、视频、iframe、工作区附件 |
| `tree` | `text` | 知识树，数据在 `x-superboard.tree` |
| `shape` | `group` | 矩形、椭圆、菱形、线条 |
| `drawing` | `group` | 手绘，笔触在 `x-superboard.strokes` |
| `group` | `group` | 编组 |
| `frame` | `group` | 预留，未启用 |

```ts
interface SuperBoardNodeExtension {
  kind: SuperBoardNodeKind
  rotation?: number
  locked?: boolean
  markdownLocked?: boolean
  ratioLocked?: boolean
  narrow?: boolean
  contentScale?: number
  style?: SuperBoardStyle
  shape?: 'rect' | 'ellipse' | 'diamond' | 'line'
  roundedRect?: boolean
  lineFlip?: { x: boolean; y: boolean }
  media?: SuperBoardMedia
  strokes?: SuperBoardStroke[]
  groupId?: string
  diagram?: string
  scheduleEvents?: SuperBoardScheduleEvent[]
  tree?: SuperBoardTreeData
  [key: string]: unknown
}
```

### 样式

```ts
interface SuperBoardStyle {
  backgroundColor?: string
  backgroundOpacity?: number
  borderColor?: string
  borderOpacity?: number
  borderWidth?: number | string
  borderStyle?: string
  color?: string
  opacity?: number
  cornerRadius?: number
  padding?: number
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDash?: number[]
}
```

`fill` / `stroke` / `strokeDash` 是旧字段，读取时由 `resolveNodeStyle` 兼容到新字段。

### 媒体

```ts
interface SuperBoardMedia {
  kind: 'image' | 'video' | 'iframe' | 'file'
  url: string
  file?: string          // 工作区内相对路径，如 public/assets/files/x.png
  name?: string
  mime?: string
  size?: number
  crop?: 'rect' | 'rounded' | 'circle'
  cropX?: number
  cropY?: number
  cropW?: number
  cropH?: number
  cropCx?: number
  cropCy?: number
  cropRadius?: number
  cropCorner?: number
}
```

附件文件放在 `<scope>/assets/files/`，白板只保存相对路径。媒体块不内嵌二进制。

### 手绘

```ts
interface SuperBoardStroke {
  id: string
  color: string
  size: number
  thinning?: number
  smoothing?: number
  streamline?: number
  easing?: number
  simulatePressure?: boolean
  start?: number
  end?: number
  points: Array<[number, number, number?]>
}
```

点坐标是节点内部坐标，第三个值是压感。轮廓由 `perfect-freehand` 在渲染时生成。

## 知识树

```ts
interface SuperBoardTreeData {
  version: 1
  rootId: string
  nodes: SuperBoardTreeNode[]
}

interface SuperBoardTreeNode {
  id: string
  parentId: string | null
  title: string
  question: string       // 用户问题，渲染为引用
  answer: string         // Markdown 正文
  quote?: { text: string; nodeId?: string; title?: string }
  status: 'draft' | 'generating' | 'done' | 'error'
  createdAt: string
  error?: string
  branchCollapsed?: boolean
  bodyCollapsed?: boolean
  quoteCollapsed?: boolean
  questionCollapsed?: boolean
  role?: 'summary'
  style?: { background?: string; border?: string }
}
```

- `nodes` 的数组顺序就是同级顺序；父子关系由 `parentId` 决定，不存连线。
- `role: 'summary'` 是生成的摘要卡：真实卡片、不可提问、不可删除。
- 详情见 `KNOWLEDGE_TREE.md`。

## 导演帧

```ts
interface CanvasFrame {
  id: string
  order: number
  name?: string
  x: number
  y: number
  width: number
  height: number
}
```

- 存在根级 `x-superboard.director.frames`，不占用节点。
- `order` 决定播放顺序；`x/y/width/height` 是世界坐标。
- 放映时只对查看器容器做外层 `transform`，不改相机。

## 边

```ts
interface CanvasEdge {
  id: string
  fromNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  fromEnd?: 'none' | 'arrow'
  toNode: string
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  toEnd?: 'none' | 'arrow'
  color?: string
  label?: string
}
```

## 校验与兼容

- `web/src/canvas/model/validate.ts` 负责结构校验，加载与保存都会执行。
- 未知的 `x-superboard` 字段会保留，不主动删除。
- 标准查看器忽略扩展时，节点至少显示文本、链接或分组框。
- 坐标允许小数；导入外部文件时不在数据层强制取整。
- 修改格式时必须同步 `scripts/test-canvas-model.ts` 与本文档。
