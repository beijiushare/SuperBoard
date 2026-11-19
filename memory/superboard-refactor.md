# SuperBoard 重构进度

## 当前状态

- 分支：`master`
- 最近提交：`81e3fe7 feat: capture pen pressure for freehand strokes`
- 工作区干净，`whiteboards/` 已被 `.gitignore` 忽略，不再进入 Git
- 示例数据：`info/public/welcome.canvas`
- 真实数据：本地 `whiteboards/public`，通过 `build:data` 构建后部署到 Vercel

## 已完成

### 数据与部署

- `whiteboards/` 退出 Git
- `info/public` 作为 GitHub Pages 示例数据
- `.github/workflows/pages.yml` 部署示例 viewer
- `npm run build:info`：构建示例 viewer
- `npm run build:data`：构建本地真实数据 viewer
- `npm run build:editor`：单独构建浏览器编辑器
- `npm run build:viewer`：只构建 viewer
- `docs/DEPLOY.md`：GitHub Pages 与 Vercel 部署说明
- `docs/WAILS.md`：Go/Wails 桌面端建议

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
- 浏览器模式隐藏 Git 部署按钮
- 入口：`web/src/canvas/editor/browserMain.tsx`
- 后端：`web/src/canvas/editor/browserFolderBackend.ts`

### 文件与目录体验

- 空文件夹会显示
- 右键新建文件夹
- 新建白板改为文件夹下拉框
- 重命名白板可移动文件夹
- 重命名文件夹可改父文件夹，即移动目录

### 样式与偏好

- 浏览器偏好：`superboard.preferences.v1`
- 浏览器 UI 状态：`superboard.ui.v1`
- 目录宽度：`superboard.treeWidth`
- 设置弹窗即时保存
- 恢复默认有二次确认
- 所有块默认白底灰边；普通文本保持纯文本
- 偏好只影响新建块，旧块不受影响
- 自由绘图样式面板只保留笔触：粗细、颜色、透明度、压感、平滑、流线、模拟压感、起笔、收笔
- 绘图已开始采集 `pointer.pressure`

### 代码结构

- `workspaceApi.ts`：白板/文件夹 API 层
- `drawingStyle.ts`：绘图节点样式修改
- `DrawingStyleSection.tsx`：绘图笔触面板
- `styleMutations.ts`：通用样式/几何/文本样式 mutation
- `StyleFieldGroups.tsx`：公共样式字段组

## 仍待完成

### 高优先级

- `CanvasEditorApp.tsx` 约 2400 行，拆 workspace hook、弹窗层、快捷键/剪贴板
- `CanvasEditorOverlay.tsx` 约 1340 行，拆视口、拖拽、缩放、选择层
- `CanvasEditorTools.tsx` 约 1150 行，按文本/形状/手绘/橡皮/箭头拆
- 浏览器端底层仍通过覆盖 `window.fetch` 接入，后续改成正式 `BoardRepository` 注入
- 画笔默认值持久化；新建笔触继承上次设置

### 中优先级

- 保存冲突检测、重试、多标签互斥
- 文件夹移动进度与取消
- 目录索引缓存，避免每次全量扫描
- 构建脚本 `web/build.js` 与多入口关系继续解耦
- CSS 按职责拆分

### 低优先级

- 文本高度精确测量
- 无障碍键盘导航
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
