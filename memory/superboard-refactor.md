# SuperBoard 重构进度

## 当前状态

- 分支：`master`
- 最近提交：`72811c4 feat: inline local images in single html export`
- 工作区干净，`whiteboards/` 已被 `.gitignore` 忽略，不再进入 Git
- 示例数据：`info/public/welcome.canvas`
- 真实数据：本地 `whiteboards/public`，通过 `build:data` 构建后部署到 Vercel

## 已完成

### 数据与部署

- 默认入口改为浏览器编辑器：启动即选择本地工作区
- 工作区使用 `<workspace>/public` 与 `<workspace>/private`，兼容旧 `whiteboards/public|private`
- `info/public` 仅作为演示数据
- `npm run build:editor` 输出 `dist/index.html`，base 为 `/`
- `npm run build:info` 输出 `dist-info/`
- `npm run export:site -- --data <目录> --out <目录> --base <路径>` 可从任意目录导出站点
- GitHub Pages 工作流改从 `dist-info` 发布

### 浏览器编辑器

- `editor.html` 独立入口
- File System Access API 选择本地工作区
- 自动创建 `whiteboards/public`、`whiteboards/private`
- 目录 handle 存 IndexedDB
- 支持白板/文件夹读取、保存、新建、重命名、移动、删除
- 保存前 JSON 校验
- 覆盖前写 `.bak`，失败时尝试恢复
- 文件夹移动冲突检查与失败清理
- 白板移动 slug 冲突检查
- 浏览器模式原 Git 部署按钮已改为导出入口
- 设置分为「常规 / 默认块 / 文本」，常规中可重新选择工作区文件夹
- 工作区增删改通过 localStorage 版本号通知其他标签页刷新目录
- 编辑器使用 Web Locks 禁止第二个标签页同时编辑
- 文件夹移动优先原生 move，失败回退复制；移动期间整页模糊并禁止编辑/保存
- 文件夹移动可取消，取消后清理目标
- 保存冲突/失败横幅、重新加载磁盘版本
- 白板同 slug 移动到新文件夹不再误报冲突
- 导出只保留单 HTML，使用真实渲染 DOM 快照（含 canvas 位图与富内容）
- 新建文本时立即创建真实节点，再进入编辑
- 设置改为左侧分类导航；关于页只显示版本
- 连线、手绘、形状全部改为 SVG 图层
- 插入媒体支持在线 URL 与本地文件
- 本地文件复制到 `<scope>/assets/files`，渲染为文件卡片；图片/视频可预览
- 单 HTML 导出会把本地图片转 data URL 内嵌
- 网格改为 SVG pattern，仅保留线网格/无网格
- 导出快照包含 SVG 图层，不再把连线/手绘转成位图
- 设置改为 Obsidian 式左侧导航与搜索
- 保存失败自动重试两次，409 不重试
- 冲突时保存按钮显示「保存冲突，点击覆盖」，顶部横幅可覆盖或重新加载磁盘版本
- 保存失败时顶部横幅提供「重试保存」
- 工作区请求通过 `configureWorkspaceFetcher` 注入，不再覆盖 `window.fetch`
- 入口：`web/src/canvas/editor/browserMain.tsx`
- 后端：`web/src/canvas/editor/browserFolderBackend.ts`

### 文件与目录体验

- 空文件夹会显示
- 右键新建文件夹
- 新建白板改为文件夹下拉框
- 重命名白板可移动文件夹
- 重命名文件夹可改父文件夹，即移动目录
- 文件夹移动显示已复制文件数/总数
- 文件夹移动可取消，取消后源目录保持不变
- 浏览器端白板索引有 1.5 秒缓存，失焦/可见性变化与写操作会失效

### 样式与偏好

- 浏览器偏好：`superboard.preferences.v1`
- 浏览器 UI 状态：`superboard.ui.v1`
- 目录宽度：`superboard.treeWidth`
- 设置弹窗即时保存
- 恢复默认有二次确认
- 所有块默认白底灰边；普通文本保持纯文本
- 偏好只影响新建块，旧块不受影响
- 自由绘图样式面板只保留笔触：粗细、颜色、透明度、压感、平滑、流线、模拟压感、起笔、收笔
- 绘图已采集 `pointer.pressure`
- 画笔默认值存 `superboard.ui.v1` 的 `brush`
- 修改绘图样式会同步更新画笔默认值，新建笔触继承上次设置
- 预览笔触使用当前画笔颜色与透明度

### 排版与可访问性

- 文本高度优先用 Canvas `measureText` 逐字换行测量，Node 环境回退到估算
- 字号与字体变化后同步重新计算块高度
- 目录树支持 Tab 聚焦、↑/↓ 移动、←/→ 折叠展开、Home/End
- 目录行增加 treeitem/aria-expanded/aria-selected/aria-level 与焦点样式

### 代码结构

- `workspaceApi.ts`：白板/文件夹 API 层，支持注入 fetcher
- `useCanvasHistory.ts`：撤销/重做
- `useEditorKeyboard.ts`：快捷键
- `useSelectionActions.ts`：复制/粘贴/删除/分组/层级/锁定
- `useBoardWorkspace.ts`：白板打开/切换/加载
- `useBoardFiles.ts`：白板与文件夹增删改
- `useBlockActions.ts`：块编辑、锁定比例、重置尺寸
- `useCanvasInsertions.ts`：文本/Markdown/Pele/日程/媒体插入
- `freehand.ts`：手绘笔触预览与节点生成
- `toolGeometry.ts`：笔触命中、箭头方向、屏幕矩形
- `overlayGeometry.ts`：选择框、旋转、命中判断的几何工具
- `useCanvasMenu.ts`：右键菜单与世界坐标命中
- `useMarqueeSelection.ts`：框选
- `useOverlayViewport.ts` + `overlayTypes.ts`：覆盖层视口同步
- `useEdgeDrag.ts`：连线端点拖拽
- `toolCreate.ts`：形状节点与箭头连线创建
- `useTextEditing.ts`：文本/媒体/Pele 编辑会话
- `EditorInsertDialogs.tsx`、`EditorBoardDialogs.tsx`：编辑弹窗拆分
- `CanvasBlockMenu.tsx`：画布右键菜单
- `EditorWorkspace.tsx`：rail 与目录外壳
- `useBoardTreeData.ts`：目录数据与文件夹路径
- `useEditorDialogState.ts`：白板/文件夹/导出弹窗状态
- `ExportDialog.tsx`：单 HTML 导出
- `export.ts`：真实渲染 DOM 快照导出
- `useShellKeyboard.ts`：Tab / ← / → / ↑ / ↓ 焦点
- `FolderMoveOverlay.tsx`：移动期间全页遮罩
- `useShellKeyboard.ts`：侧栏与目录的 Tab/方向键焦点
- `browserMain.tsx`：工作区选择与 Web Locks 单标签锁
- `scripts/export-site.mjs`：`--data` / `--out` / `--base` 站点导出
- `useShapeArrowTools.ts`：形状与箭头草稿和提交
- `folderMove.ts`：文件夹移动进度与取消信号
- `styles/viewer-index.css`：viewer 独立样式入口，不含编辑器样式
- `CanvasDirectorLayer.tsx`、`CanvasMarkdownLayer.tsx`：导演与 Markdown 覆盖层
- `CanvasEditorStage.tsx`：画布舞台（Viewer/Overlay/Tools/样式/导演/工具栏）
- `viewer/EdgeLayer.ts`、`DrawingLayer.ts`、`ShapeLayer.ts`、`GridLayer.ts`：SVG 场景层
- `useCanvasDrag.ts`：移动、缩放、单选/多选旋转、对齐参考线
- `TextEditingOverlay.tsx`：文本输入浮层
- `eraser.ts`：橡皮擦命中计划与批量删除
- `ToolPreviewLayer.tsx`：形状/箭头拖拽预览
- `toolViewport.ts`：工具使用的视口/DataManager 访问
- `useToolPointers.ts`：工具指针按下/移动/抬起手势
- `useFreehandTool.ts`：手绘预览与落笔提交
- `toolTypes.ts`：形状与箭头草稿类型
- 浏览器后端单次扫描定位白板文件，减少全目录遍历
- `test:editor` 覆盖手绘节点、笔触命中、箭头方向、屏幕矩形、框选相交、形状/连线创建、样式 mutation、橡皮擦除
- `docs/MANUAL_TEST.md` 增加浏览器编辑器、多标签冲突、画笔默认值测试项
- `drawingStyle.ts`：绘图节点样式修改
- `DrawingStyleSection.tsx`：绘图笔触面板
- `styleMutations.ts`：通用样式/几何/文本样式 mutation
- `StyleFieldGroups.tsx`：公共样式字段组

## 仍待完成

### 手动验证

- 浏览器编辑器：选择工作区、恢复权限、保存 `.bak`
- 第二标签页被 Web Locks 阻止
- 文件夹原生 move / 复制回退 / 取消
- 侧栏与目录 Tab/方向键
- 长文本三态 UI 一致性
- 拖拽、缩放、旋转、框选回归
- 站点导出与 `dist-info` 演示站

### 桌面端 TODO

- Wails/Go 桌面工程
- 桌面本地 `config.json` 与单实例
- 多文件站点导出到设置中的固定目录
- 导出目录变更与旧产物迁移
- 部署命令配置与执行器（暂缓）

### 可选优化

- 构建脚本多入口继续解耦
- `app.css` 继续按区域拆分
- 仓储层单测、浏览器 File System Access 适配测试
- Markdown fallback `MarkdownView` 542 kB 懒加载体积优化

## 验证命令

```bash
npm run typecheck
npm run test:model
npm run test:editor
npm run build:info
npm run build:editor
```

当前仍有 `MarkdownView` 542 kB 懒加载 chunk 警告，非阻塞。
