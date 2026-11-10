import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  DocumentRecordType,
  PageRecordType,
  TLDOCUMENT_ID,
  createShapeId,
  createTLSchema,
  createTLStore,
  defaultShapeSchemas,
  type IndexKey,
  type TLPageId,
  type TLRecord,
} from 'tldraw'
import {
  DEFAULT_MARKDOWN_TEXT,
  DEFAULT_PELE_CODE,
  DEFAULT_SB_BLOCK_STYLE,
  DEFAULT_SB_PELE_STYLE,
  SB_MARKDOWN_TYPE,
  SB_PELE_TYPE,
  sbShapeSchemas,
} from '../web/src/shared/shapes/types'

const root = process.cwd()
const boardsDir = path.join(root, 'whiteboards', 'public')
const pageId = 'page:main' as TLPageId

const intro = `# SuperBoard

一个用 **tldraw** 搭建的本地白板工作台。

- 本地编辑，自动保存到 \`whiteboards/public/*.tldr.json\`
- 提交到 Git 后自动部署为只读分享站
- 右键画布可添加 Markdown 和图表卡片
- 双击卡片即可编辑

## AsciiMath

行内公式：$E = mc^2$

$$
sum_(i=1)^n i = (n(n+1))/2
$$

## 表格

| 能力 | 状态 |
| --- | --- |
| Markdown | 已支持 |
| AsciiMath | 已支持 |
| 图表 | Pelé / Mermaid |

\`\`\`ts
const board = await fetch('/__boards/superboard-demo')
console.log(board.meta.title)
\`\`\`
`

const editingGuide = `## 编辑方式

1. 拖动卡片改变位置
2. 拖动角点调整大小
3. **双击**卡片打开源码编辑器
4. 右侧实时预览，保存后写回 shape props

## 提示

- Markdown 支持 GFM 表格、任务列表、代码高亮
- 数学统一使用 AsciiMath：\`$...$\` 和 \`$$...$$\`
- 图表卡片保存 Mermaid 源码

> 预览页和编辑器使用同一套渲染器，所见即所得。
`

const kanban = `kanban
  灵感
    把零散笔记放进白板
    记录待读文章
  进行中
    [搭建 SuperBoard 示例]
    [验证 Markdown / AsciiMath]
  已完成
    本地读取与保存
    静态站构建流程
  稍后
    [申请 tldraw Hobby license]
    [配置 GitHub Pages]
`

const flow = `flowchart LR
  A[本地编辑] --> B[自动保存 JSON]
  B --> C[git commit]
  C --> D[GitHub Actions]
  D --> E[构建静态站]
  E --> F[GitHub Pages]
  E --> G[beijiu.top]
`

const sequence = `sequenceDiagram
  participant U as 用户
  participant E as 编辑器
  participant API as 本地 API
  participant FS as JSON 文件
  U->>E: 拖动 / 编辑卡片
  E->>E: 800ms debounce
  E->>API: PUT /__boards/:slug
  API->>FS: 原子写入
  FS-->>API: 完成
  API-->>E: 保存结果
`

function shape(type: string, id: string, x: number, y: number, index: string, props: Record<string, unknown>) {
  return {
    id: createShapeId(id),
    typeName: 'shape',
    type,
    x,
    y,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    props,
    parentId: pageId,
    index: index as IndexKey,
  } as unknown as TLRecord
}

async function main() {
  const schema = createTLSchema({
    shapes: {
      ...defaultShapeSchemas,
      ...sbShapeSchemas,
    },
  })
  const store = createTLStore({ schema })

  store.put([DocumentRecordType.create({ id: TLDOCUMENT_ID, name: 'SuperBoard Demo' })])
  store.put([PageRecordType.create({ id: pageId, name: '示例白板', index: 'a1' as IndexKey })])

  store.put([
    shape(SB_MARKDOWN_TYPE, 'intro', 0, 0, 'a1', {
      ...DEFAULT_SB_BLOCK_STYLE,
      w: 520,
      h: 430,
      baseH: 430,
      text: intro,
    }),
    shape(SB_MARKDOWN_TYPE, 'guide', 560, 0, 'a2', {
      ...DEFAULT_SB_BLOCK_STYLE,
      w: 470,
      h: 430,
      baseH: 430,
      text: editingGuide,
    }),
    shape(SB_PELE_TYPE, 'kanban', 0, 470, 'a3', {
      ...DEFAULT_SB_PELE_STYLE,
      w: 780,
      h: 430,
      baseH: 430,
      code: kanban,
      diagram: 'kanban',
    }),
    shape(SB_PELE_TYPE, 'flow', 820, 470, 'a4', {
      ...DEFAULT_SB_PELE_STYLE,
      w: 570,
      h: 430,
      baseH: 430,
      code: flow || DEFAULT_PELE_CODE,
      diagram: 'flowchart',
    }),
    shape(SB_PELE_TYPE, 'sequence', 0, 940, 'a5', {
      ...DEFAULT_SB_PELE_STYLE,
      w: 700,
      h: 410,
      baseH: 410,
      code: sequence,
      diagram: 'sequence',
    }),
    shape(SB_MARKDOWN_TYPE, 'blank', 740, 940, 'a6', {
      ...DEFAULT_SB_BLOCK_STYLE,
      w: 440,
      h: 300,
      baseH: 300,
      text: DEFAULT_MARKDOWN_TEXT,
    }),
  ])

  const document = store.getStoreSnapshot('document')
  const board = {
    version: 1,
    meta: {
      title: 'SuperBoard 示例',
      slug: 'superboard-demo',
      summary: 'Markdown、AsciiMath 与图表卡片的演示白板。',
      order: 0,
      updatedAt: new Date().toISOString(),
    },
    document,
  }

  await fs.mkdir(boardsDir, { recursive: true })
  await fs.writeFile(path.join(boardsDir, 'superboard-demo.tldr.json'), `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  console.log('SuperBoard: 已生成 whiteboards/public/superboard-demo.tldr.json')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
