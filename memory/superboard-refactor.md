# SuperBoard 重构进度

## 当前状态

- 分支：`master`
- 最近提交：`7260e92 test: cover desktop workspace service`
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
- 导出支持三种模式：内嵌附件、仅保留引用、文件夹 + 附件
- file 块右键菜单支持打开文件
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

### 桌面端（Wails v3）

- 工程位于 `desktop/`，Go module `superboard/desktop`
- 前端复用根项目 `npm run build:editor`，复制到 `desktop/frontend/dist` 后嵌入
- bindings 生成到 `web/src/desktop/bindings`
- 共享前端通过 `web/src/desktop/platform.ts` 检测 `window._wails` 调用
- `WorkspaceService` 实现工作区打开/恢复、白板与文件夹 CRUD、附件导入
- `%APPDATA%/SuperBoard/config.json` 保存工作区路径
- 单实例锁：第二次启动恢复并聚焦已有窗口
- `/__files/<scope>/<path>` 只读暴露工作区附件，路径越界返回 404
- `ExportService` 使用系统保存/目录对话框导出 HTML 与附件
- 桌面端附件插入走原生文件选择器，不再通过 JS 桥传大文件
- 文件右键菜单支持打开、在文件管理器中显示、删除
- 原生 JSON Canvas `type: "file"` 节点已启用，旧 link 文件节点自动迁移
- 文件节点由 DOM 渲染（图片/视频预览、其他显示文件卡片）
- 可用 `SUPERBOARD_DEBUG=1` 开启 WebView2 远程调试（9222）
- 支持命令行传入 `.canvas`，自动推导工作区并打开对应白板
- 设置页显示桌面端工作区完整路径
- 文件缺失时卡片显示「文件缺失」
- 窗口使用无标题栏模式（`Frameless: true`），侧栏底部提供「最小化」「专注模式」「退出」三个按钮
- 默认启动调用 `Maximise()`，占满工作区且不覆盖任务栏
- 专注模式调用 Wails `Fullscreen()`，Esc 调用 `UnFullscreen()` 恢复最大化
- 设置新增「帮助」页，说明专注模式、Esc 退出和窗口操作
- 窗口默认 1180×700、位置 20,20；之前 1440×900 被系统放到 -8,-32，标题栏在屏幕外，看起来像按钮消失
- 侧栏空白区域可拖动窗口（`--wails-draggable: drag`），按钮为 `no-drag`
- 无边框窗口边缘仍可缩放（Wails Windows 边缘命中）
- 最小化已通过 `IsIconic` 验证，退出已验证
- 导出 HTML 网格已由用户确认：无边界、不漂移、缩放密度一致
- Vditor 资源构建时复制到 `public/__vditor/dist`，桌面端 `/__vditor` 可正常加载
- 箭头 marker path 显式 `stroke="none"`，避免继承深色描边
- 目录栏与画布分隔线统一为 `#e6e2d8`
- 开始页：左侧粗斜体 `#` + 右侧 SuperBoard 手写 Logo，最近工作区列表、打开文件夹
- 开始页不是 `info/public/welcome.canvas`；后者是打开工作区后的欢迎白板
- 最近工作区保存在桌面端 `config.json` 与浏览器 IndexedDB
- 目录失效的最近项置灰，可移除
- 设置「常规」页复用最近工作区列表，可切换或移除
- 设置右上角改为关闭按钮，恢复默认移入「常规」页
- 开始页移除工作区结构提示文案
- 开始页卡片：打开文件夹、最近打开、语言三行；控件统一 220px
- 版本与网站链接水平居中，文字只显示「版本」「网站」
- 全应用使用统一 Select 组件（`web/src/components/ui/select.tsx`），文字左对齐
- 下拉占位符不再灰显，统一为正文色
- 版本号唯一来源为 `package.json`，Vite `define` 注入 `__SUPERBOARD_VERSION__`，前端通过 `APP_VERSION` 读取
- 网页端 favicon、apple-touch-icon、PWA manifest 已接入
- i18n：i18next + react-i18next，`web/src/i18n/`
- 命名空间：`common` / `start` / `settings` / `editor` / `viewer` / `errors`
- 语言支持 `zh-CN` / `en-US`，语言持久化：桌面端 `config.json`、浏览器 `localStorage`
- 编辑器、Viewer、开始页、设置页的界面文案已全部迁移，无硬编码中文
- Vditor 使用 `zh_CN` / `en_US`；FullCalendar 使用 `zh-cn` / `en`；导出 HTML 写入当前 `lang`；文件大小使用 `Intl.NumberFormat`
- 后端错误码化：浏览器工作区后端与 Go 服务返回 `code` 或 `code|value`，前端 `translateServerError()` 统一翻译
- Go 原生对话框标题按 `config.json` 的 `language` 切换中英
- `npm run check:i18n` 校验中英文 key 一致性，已接入 `deploy.yml` 与 `pages.yml`
- 开发用 Vite 中间件错误消息统一为英文（仅开发者可见）
- `canvas-preview/fixture.ts` 的示例白板内容保持中文，视为样例数据
- 最近下拉默认显示「选择」，选项悬停显示路径
- 语言下拉暂时只有简体中文
- 最近列表底部「开始」通过 `?start=1` 返回开始页
- 删除当前工作区会被拦截，弹窗内「开始」链接可跳转开始页
- 应用图标与开始页 Logo 使用 `#` 图标，已生成 ico/icns
- 已通过 CDP 验证：窗口按钮渲染、关闭退出、文件双击不进入文本编辑
- 群组背景/边框/标签改由 DOM `GroupLayer` 渲染
- Canvas 不再绘制网格和群组，只保留背景色
- 导出 HTML 移除 Canvas 转 PNG，网格改为独立实时层
- 附件保留原名，冲突时追加 `-2`、`-3`；浏览器端同步
- 普通附件使用 plain surface，只显示图标 + 文件名
- 文件双击走 `openBlockEditor` 的 media 分支，不再进入文本工具
- `go test ./...` 覆盖工作区、白板/文件夹 CRUD、保存冲突、路径越界、附件导入
- 已通过 CDP 验证：桌面模式识别、命令行打开白板、工作区恢复、欢迎白板加载、附件读取、越界拦截

### 代码结构（桌面端）

- `desktop/main.go`：Wails 入口、窗口、单实例、调试参数
- `desktop/services/workspace.go`：工作区、白板、文件夹、附件
- `desktop/services/export.go`：原生导出对话框
- `desktop/services/assets.go`：静态资源 + `/__files/`
- `desktop/services/config.go`：本地配置
- `desktop/scripts/frontend.mjs`：前端构建/开发桥接
- `web/src/desktop/platform.ts`：桌面 bindings 封装与 fetch 适配
- `web/src/canvas/editor/workspacePlatform.ts`：浏览器/桌面统一入口

## 仍待完成

### 手动验证

- 浏览器编辑器：选择工作区、恢复权限、保存 `.bak`
- 第二标签页被 Web Locks 阻止
- 文件夹原生 move / 复制回退 / 取消
- 侧栏与目录 Tab/方向键
- 长文本三态 UI 一致性
- 拖拽、缩放、旋转、框选回归
- 站点导出与 `dist-info` 演示站
- 桌面端原生对话框、导出、文件管理器操作

### 国际化

- 中英切换后检查原生对话框标题（选工作区、导出、选文件）
- Go 错误码在真实失败场景下的提示（如 slug 冲突、文件夹已存在）
- FullCalendar 在两种语言下的表头与按钮
- 桌面端设置里切换语言后重启是否保持

### 桌面端与 Canvas 迁移

- 导出 HTML 网格的浏览器手动验证（平移/缩放边界）
- 群组 DOM 图层在深色主题/外部 Obsidian Canvas 下的视觉确认
- 导出附件选择器与原生目录导出的手动验证
- `.canvas` 安装包级文件关联（当前支持命令行与「打开方式」）
- 多文件站点导出、部署命令执行器

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
npm run check:i18n
npm run build:info
npm run build:editor
cd desktop && wails3 build
```

当前仍有 `MarkdownView` 542 kB 懒加载 chunk 警告，非阻塞。
