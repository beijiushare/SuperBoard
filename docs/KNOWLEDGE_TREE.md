# 知识树块（`kind: 'tree'`）

知识树不是思维导图，是**思考树**：根节点是一个问题起点，每个节点都是一次「提问 → 回答」，节点之间靠父子路径串联。AI 的上下文只取「根 → 当前节点」这条路径，同层分支不进入上下文。

## 1. 定位

- 一个树块 = 一个问题起点（单根）。
- 节点是卡片，卡片结构固定：`title` + 引用块（我问的问题）+ Markdown 回答。
- 树由父子关系实时派生连线，**不写 `CanvasEdge`**：连线不能单独选中、删除或改样式，否则用户删掉一条线但父子关系还在，树就断了。
- 树块整体无边框、无背景；卡片自带背景和边框。

## 2. 数据

树数据存在块节点的 `x-superboard.tree`，节点本身仍是 `type: 'text'` 的块（`text` 留空）。

```ts
export type SuperBoardTreeNodeStatus =
  | 'draft'       // 刚创建，等待提问
  | 'generating'  // 请求中
  | 'done'        // 已有回答
  | 'error'       // 请求失败，可重试

export interface SuperBoardTreeQuote {
  /** 被引用的原文片段。 */
  text: string
  /** 来源卡片 id；来自其它块时为 undefined。 */
  nodeId?: string
  /** 来源卡片标题，用于展示。 */
  title?: string
}

export interface SuperBoardTreeNode {
  id: string
  parentId: string | null
  title: string
  /** 我问的问题，渲染成引用块。 */
  question: string
  /** 回答正文，Markdown。 */
  answer: string
  quote?: SuperBoardTreeQuote
  status: SuperBoardTreeNodeStatus
  createdAt: string
  /** 折叠后代分支。 */
  branchCollapsed?: boolean
  /** 折叠正文：保留标题、引用和回答前几行。 */
  bodyCollapsed?: boolean
  /** 单卡颜色覆盖；缺省跟随全局块默认色。 */
  style?: { background?: string; border?: string }
}

export interface SuperBoardTreeData {
  version: 1
  rootId: string
  /** 数组顺序即同级顺序。 */
  nodes: SuperBoardTreeNode[]
}
```

约定：

- `nodes` 的数组顺序决定同级排序，不额外存 `order`。
- 布局、连线、路径都是**派生**的，不存进文档。
- 块节点的 `width` / `height` 会被写成布局结果，方便画布选择框、导出边界工作；但它不是可拖拽调整的尺寸。

## 3. 布局

方向固定：**左 → 右**。

```
父卡片 ──▶ 子卡片（右一列，垂直居中于自己的子树）
```

- 卡片宽度固定：`CARD_WIDTH = 340`。
- 卡片高度：内容决定，上限 `CARD_MAX_HEIGHT = 420`，超出卡片内部滚动。
- 列间距 `COLUMN_GAP = 76`，行间距 `ROW_GAP = 24`。
- 子树高度 = `max(自身高度, 子节点高度之和 + 行间距)`；父卡片相对自己的子树垂直居中。
- 整块尺寸 = 布局边界 + `BLOCK_PADDING`。

纯函数：

```ts
layoutTree(nodes: SuperBoardTreeNode[], heights: Record<string, number>): TreeLayout
// TreeLayout = { positions: Record<string, {x, y}>, width, height }
```

高度由 DOM 测量（`ResizeObserver`）后传入；未测量时用 `DEFAULT_CARD_HEIGHT`。

不自动避让画布上的其它块：树块变大允许覆盖邻近块，由用户自己挪。

## 4. 交互

| 操作 | 行为 |
| --- | --- |
| 鼠标移入卡片 | 右上角出现「＋」 |
| 点「＋」 | 在子节点位置新建草稿卡（输入框），布局已预留位置 |
| 输入 `Enter` | 提交问题：卡片原地变成「标题 + 引用 + 回答区」，开始生成 |
| `Shift + Enter` | 换行 |
| `Esc` | 取消并删除草稿节点 |
| 选中卡片文字 → 右键 | 「解释概念」/「据此提问」 |
| 双击正文 | 进入单卡 raw textarea 编辑（保存 / 取消） |
| 双击标题 | 就地改标题 |
| 拖块左上抓手 | 移动整个树块 |

手势约束：

- 卡片内的**左键**用于选文字，不移动块、不框选。
- 中键 / 右键拖 = 画布平移；滚轮 = 画布缩放；`Alt + 滚轮` = 滚动卡片内容。全部沿用现有规则，卡片不拦截。
- 树块的命中层（`sb-editor-block-hitbox`）必须常驻 `pointer-events: none`，移动靠左上抓手。

### 4.1 折叠

- `branchCollapsed`：隐藏所有后代，卡片保留。
- `bodyCollapsed`：保留标题、引用与回答前 3 行（`line-clamp`），高度随之缩小。
- 折叠按钮上的数量只统计真实问答卡，摘要卡不计入。

### 4.2 删除

有子节点时给两个选项：「删除整个分支」/「提升子节点到父级」。根节点不能删除最后一张卡。

## 5. 渲染

- 卡片正文统一用 `MarkdownVditorPreview`，显式传 `callout: true`，并补 `.vditor-callout` 样式（当前预览链路没打开 callout，导致 `> [!WARNING]` 退化成普通引用）。
- 卡片宽度固定，表格横向滚动，代码块横向滚动。
- 标题层级在卡片内整体降一级，避免比卡片标题还大。
- 连线：贝塞尔曲线 + 小箭头，和画布块间箭头同款样式，颜色跟随主题，不支持单独改色。
- 样式前缀统一用 `.sb-kt-`（`.sb-tree-*` 已被文件侧栏目录树占用）。

性能：

- 折叠分支的后代、不可见卡片不渲染正文，只渲染占位。
- 渲染结果按内容 hash 缓存。
- 卡片编辑态用纯 `textarea`，不挂 Vditor 编辑实例。

## 6. AI

### 6.1 上下文

只拼「根 → 当前节点」路径，祖先按 `user` / `assistant` 交替，当前问题放最后。

- 引用来自**祖先**：已在上下文中，只标记引用位置，不重复整段。
- 引用来自**兄弟分支或其它块**：不在路径上，必须整段附上。
- 路径过长时优先截断最早的问答，并提示是否改用「路径摘要」。

请求前展示将发送的路径（`a → b → e`）与粗略 token 估算。

### 6.2 提示词

```
system: 只输出 GFM Markdown，不输出 HTML；需要对比时用表格；
        注意点用引用块；不要重复问题本身。
user/assistant: 祖先问答（按路径）
user: [引用片段] + 当前问题
```

标题不交给 AI 生成：默认取问题文本前 20 字，可手动改。

### 6.3 路径摘要

- 路径 token 超过阈值时先压缩，再提问。
- 摘要卡是真实卡片，挂在当前问题的最深祖先下，覆盖「根 → 该祖先」，后代继承。
- 已有可用摘要时不再从头总结：把摘要之后新增的问答合并进同一张卡，并把卡片移到新的最深祖先下，一条路径始终只有一张摘要。
- 摘要失败时保留红卡；下次提问自动复用同一张卡重试，不叠加第二张。

### 6.3 凭据与请求

- Key 存系统凭据库（Windows Credential Manager / macOS Keychain / Linux Secret Service，Go 侧用 `github.com/zalando/go-keyring`）。
- **Key 永不返回前端**，最多返回 `sk-...abcd` 掩码。
- 请求由 Go 发出（`desktop/services/ai.go`），统一走 OpenAI 兼容的 `/chat/completions`，覆盖 OpenAI、任意兼容端点、Ollama、LM Studio。
- 第一版非流式；之后用 `runtime.EventsEmit` 推流并支持取消。
- 错误映射：401 Key 无效、429 频率限制、网络失败。任何失败都不能让卡片空白。

## 7. 导出

- PNG / SVG 导出入口已移除，不处理。
- HTML 导出是对真实渲染 DOM 的快照：
  - 导出前展开所有折叠分支；
  - 卡片正文、引用和问题临时解除折叠，导出完整内容；
  - 等待若干帧让 Markdown、媒体和重新测量的卡片高度稳定后再克隆 DOM。

## 8. 分期

1. 规格与数据层（本文档 + 类型 + `layoutTree` + 测试）。
2. 静态渲染：卡片、连线、折叠、颜色。
3. 编辑交互：草稿卡、增删、键盘、正文编辑、上下文菜单。
4. AI：凭据库、配置页、上下文拼装、生成与重试。
5. 打磨：搜索、路径预览、导出校验。

## 9. 测试清单（手动）

- [ ] 插入树块，默认单根，块无边框无背景
- [ ] 新建子节点后父卡片垂直居中于子分支
- [ ] 长回答卡片高度不超上限，在卡片内滚动（`Alt + 滚轮`）
- [ ] 折叠分支后整块尺寸收缩，展开后恢复
- [ ] 折叠正文保留标题、引用与前 3 行
- [ ] 删除有子节点的卡片出现两个选项
- [ ] 卡片内可选中文字，右键出现两个菜单项
- [ ] 拖左上抓手可移动整块，卡片内左键不移动块
- [ ] 画布滚轮缩放、中右键平移在树块上照常工作
- [ ] 卡片背景色 / 边框色修改后保存、重载、导出 HTML 一致
- [ ] 导出 HTML 后树结构完整、正文未截断
