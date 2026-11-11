# SuperBoard 架构（JSON Canvas 方向）

> 本文描述迁移目标架构；当前仓库仍保留 tldraw 旧实现，迁移期间以稳定提交为准。

## 1. 两端分离

### 本地编辑器

- 只在 Vite dev server 运行
- 直接读写 `whiteboards/public/` 和 `whiteboards/private/`
- 负责选择、变换、手写、编辑、样式、保存、导出
- 不参与线上构建

### 线上查看器

- 构建期生成静态数据
- 只读
- 只负责画布、内容渲染、缩放、平移、导演幕布播放
- 不挂载编辑器代码

## 2. 数据流

```text
.canvas
  -> parser/validator
  -> CanvasDocument
  -> editor renderer
  -> dev file API
```

```text
.canvas
  -> build script
  -> embedded JSON
  -> viewer renderer
```

编辑器和查看器共享：

- JSON Canvas 类型
- `x-superboard` 扩展类型
- Markdown / Pele / Media 块渲染
- 导演幕布播放逻辑

不共享：

- 编辑工具
- 历史记录
- 样式编辑面板

## 3. 画布渲染

- 节点位置、尺寸、层级由模型决定
- 文本/媒体等富内容用 DOM 渲染
- 边、手写轮廓用 Canvas/SVG 渲染
- 所有节点放在统一变换容器中，避免每个节点单独计算屏幕坐标
- 视口外的节点后续可裁剪
- iframe/视频延迟加载

## 4. 扩展字段

根级：

```ts
interface SuperBoardRootExtension {
  version: 1
  meta: BoardMeta
  director?: DirectorData
}
```

节点级：

```ts
interface SuperBoardNodeExtension {
  kind: 'text' | 'markdown' | 'pele' | 'media' | 'shape' | 'drawing' | 'group' | 'frame'
  style?: Record<string, unknown>
  shape?: 'rect' | 'ellipse' | 'diamond' | 'line'
  media?: {
    kind: 'image' | 'video' | 'iframe'
    url: string
    crop?: Record<string, unknown>
  }
  strokes?: Stroke[]
  groupId?: string
}
```

字段可以继续扩展，但必须满足：

- 不破坏标准节点本身的可用性
- 标准查看器忽略扩展时不报错
- 自定义查看器能降级渲染未知字段

## 5. 导演幕布

- 独立于节点和 Group
- 存在根级 `x-superboard.director`
- 编辑器只负责编辑帧
- 查看器只负责播放
- 不生成结构节点，不污染普通画布

## 6. 查看器 fork 边界

优先复用：

- 平移/缩放
- 网格
- 节点/边基础渲染
- Markdown 文本节点
- 文件/链接节点

需要改造：

- 自定义节点扩展
- 手写轮廓
- 媒体块
- Pele
- 导演覆盖层
- 编辑层不放进 viewer

## 7. 回退策略

- 迁移前保留 tldraw 分支/提交
- `.tldr.json` 先复制，再转换
- 新实现按阶段提交
- 任一阶段失败可按 commit 回退
