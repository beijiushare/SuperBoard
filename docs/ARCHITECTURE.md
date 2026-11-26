# 架构

SuperBoard 是文件驱动的白板应用：所有数据都在用户选择的工作区文件夹里，应用本身不提供数据库或云端存储。

## 技术栈

| 层 | 使用 |
| --- | --- |
| 界面 | React 19 + TypeScript + Vite 7 |
| 画布 | 自建编辑器内核 + vendored `json-canvas-viewer` fork |
| 桌面壳 | Wails v3 + Go，WebView2 |
| Markdown | Vditor（单链路）+ MathJax |
| 状态 | React hooks；偏好、视口、上次白板存 `localStorage` |
| 多语言 | i18next / react-i18next，5 种语言 |

## 三套运行时

同一份前端代码可以在三种环境里读写工作区，区别只在文件后端：

### 桌面端

- `desktop/main.go` 启动 Wails 窗口，加载前端产物。
- 前端通过 `web/src/desktop/platform.ts` 把 `/__canvases`、`/__folders`、`/__history` 等请求转成 Wails bindings。
- Go 服务 `desktop/services/` 直接读写磁盘，负责校验、冲突检测、历史快照和附件。

### 浏览器端

- 入口 `web/src/canvas/editor/browserMain.tsx`。
- 通过 File System Access API 直接读写用户选择的文件夹；文件夹句柄存在 IndexedDB。
- `browserFolderBackend.ts` 与 `browserHistory.ts` 实现与 Go 侧相同的接口。
- 需要 Edge / Chrome；不支持时显示提示，不能编辑。

### 开发服务器

- `npm run dev` 由 Vite 提供页面。
- `web/src/dev/canvasFs` 与 `web/src/dev/boardFs` 用 Node `fs` 实现同一组接口。
- 开发模式下附件路由由 Vite 提供，桌面端附件预览要用构建后的 exe 验证。

## 目录与模块

```text
web/src/
  canvas/
    model/        类型、校验、序列化、树/帧布局
    editor/       编辑器外壳、工具、选择、历史、保存、导出
    viewer/       CanvasViewer 与各渲染层（Shape/Drawing/Edge/Group/Director）
    tree/         AI 上下文与提示词
    editor/CanvasEditorApp.tsx   组合所有会话与界面
  shared/         块渲染、目录树、通用 UI
  desktop/        Wails bindings、平台桥接、AI 调用
  dev/            开发期文件 API 与 Vditor 资源插件
  i18n/           语言包与初始化
  styles/         全局与组件样式（规则见 DESIGN.md）
  vendor/         json-canvas-viewer fork
desktop/
  main.go         Wails 入口、窗口、单实例、文件关联
  services/       workspace / boards / history / files / folders / export / update / ai
scripts/          构建、导出、校验、发布
docs/             本项目文档
```

## 数据流

### 打开

```text
工作区
  -> /__canvases 列表
  -> 选择 slug（URL ?board= 或上次打开的白板）
  -> 读取 .canvas
  -> parse/validate -> CanvasDocument
  -> CanvasViewer 渲染
  -> CanvasEditorOverlay 提供选择、变换、工具
```

### 保存

```text
用户操作
  -> 修改 CanvasDocument（React state）
  -> 1.2 秒防抖
  -> PUT /__canvases/:slug
  -> 校验 JSON + meta.slug
  -> 对比修改基线，冲突返回 409
  -> 临时文件 + rename 写入
  -> 按间隔写 .superboard/history 快照
```

冲突时界面提供「用当前内容覆盖」与「重新加载」两个出口；覆盖会带 `x-superboard-force`。

### 删除、改名、移动

- 白板改名：历史目录跟随新 slug；旧文件删除。
- 删除白板：同时删除历史目录。
- 删除文件夹：先收集文件夹内白板并删除各自历史，再删除目录。

## 画布与渲染

- 相机是 `offsetX / offsetY / scale`，世界坐标与屏幕坐标的转换集中在 `useCanvasViewport`、`overlayGeometry`、`toolViewport`。
- DOM 节点放在统一变换容器中；形状、边、手绘、分组背景由 Canvas/SVG 层绘制。
- 视口外的形状/手绘做裁剪，富内容节点仍在 DOM 中。
- 导演模式放映使用 viewer 容器的外层 `transform` 取景，不修改相机；退出只需移除 transform。
- 知识树块尺寸由卡片测量结果派生，会静默回写 `node.width/height`，不是可拖拽尺寸。

## 主要功能模块

| 模块 | 入口 | 说明 |
| --- | --- | --- |
| 编辑器外壳 | `canvas/editor/CanvasEditorApp.tsx` | 组合会话、工具、面板、弹窗 |
| 文档会话 | `useCanvasEditorSession.ts` | 列表、打开、保存、历史、URL |
| 查看器 | `canvas/viewer/CanvasViewer.tsx` | 相机、节点槽位、各渲染层 |
| 知识树 | `shared/tree/KnowledgeTree.tsx` | 卡片、布局、AI 触发、折叠 |
| AI | `desktop/ai.ts` + `desktop/services/ai.go` | 请求、凭据、错误映射 |
| 历史 | `HISTORY.md` | 快照、采样、恢复 |
| 导出 | `canvas/editor/export.ts` | 单 HTML 快照、附件策略 |
| 桌面端 | `DESKTOP.md` | 窗口、配置、更新、原生对话框 |

## 约束与已知限制

- 数据格式与扩展字段见 `DATA_FORMAT.md`，修改必须保持标准 JSON Canvas 可打开。
- CSS 类名前缀按组件划分，新组件自带样式文件；规则见 `DESIGN.md`。
- HTML 导出是对当前 DOM 的快照，画在 Canvas 上的形状、边、手绘不会进入导出；更完整的「数据 + viewer」导出仍在计划中。
- AI 请求目前非流式，失败以卡片状态呈现。
- 没有外部文件监听；在工作区外修改 `.canvas` 后需要重新打开白板或刷新页面。
- 不支持多标签页；启动时恢复上次工作区与上次打开的白板。
- 浏览器端受 File System Access API 限制，只支持 Chromium 系浏览器。
