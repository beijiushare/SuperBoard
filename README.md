# SuperBoard

需要注意：这是一个纯粹的个人使用的项目，基本上就是几个项目拼凑起来加一些个性化，可能不维护，可能破坏式更新，请勿将其用于生产环境！

文件驱动的个人白板系统：本地用浏览器编辑，画布保存为 Git 友好的 `.tldr.json`，推送到 GitHub 后自动构建成只读静态站点。

- 一个白板一个文件，无数据库、无后端存储
- 本地编辑器直接读写 `whiteboards/public/` 和 `whiteboards/private/`
- 线上按白板生成独立 HTML，强制只读
- 支持 Markdown、AsciiMath 公式、Pele 图表和手绘

## 快速开始

要求 Node.js 24。

```bash
npm install
npm run dev
```

打开终端输出的本地地址（默认 `http://127.0.0.1:5173/`）。

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地编辑器，读写 `whiteboards/public/`、`whiteboards/private/` |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build:viewer` | 只打包只读端前端资源到 `dist/` |
| `npm run build:site` | 打包并生成完整静态站（每个白板一个 HTML） |
| `npm run preview:site` | 本地预览构建产物 |
| `npm run seed` | 生成示例白板 |
| `npm run mathjax` | 复制 MathJax 静态资源到 `public/mathjax/` |

### build:viewer 和 build:site 的区别

- `build:viewer`：执行 `npm run mathjax && vite build`，只产出 `dist/assets/*` 和 Vite manifest，不生成白板页面。
- `build:site`：先执行 `build:viewer`，再运行 `web/build.js`，生成：
  - `dist/index.html`
  - `dist/tree.html`
  - `dist/boards/<slug>.html`
  - `dist/boards/<slug>.json`
  - `404.html`、`.nojekyll`、可选的 `CNAME`

每个 `<slug>.html` 已经内嵌该白板的 JSON，页面运行不依赖旁边的 `<slug>.json`。`.json` 是额外输出的原始数据副本，方便直接取用、调试或给外部脚本读取。

### 预览必须通过 HTTP

不要直接双击 `dist/` 里的 HTML 用 `file://` 打开。产物使用 ES Module，且资源路径是 `/SuperBoard/assets/...`，`file://` 下会触发 CORS 和 404。

本地预览：

```bash
npm run build:site
npm run preview:site
```

然后访问 `http://localhost:4173/SuperBoard/`，单页地址为 `http://localhost:4173/SuperBoard/boards/<slug>.html`。

## 目录结构

```text
whiteboards/public/   公开白板，提交 Git，参与构建
whiteboards/private/  私有白板，本地专用，已被 .gitignore
web/src/shared/       编辑器与只读端共用代码
web/src/editor/       本地编辑器
web/src/viewer/       只读页面
web/src/dev/boardFs/  Vite 文件读写插件
web/src/styles/       全局样式模块
web/build.js          生成静态多页面站点
scripts/              seed、MathJax 资源复制、deploy.cmd
参考/                 设计文档与参考资料（默认不入库）
```

白板文件示例：

```text
whiteboards/
├─ public/
│  ├─ 项目规划.tldr.json
│  └─ 项目/路线图.tldr.json
└─ private/
   └─ 私密草稿.tldr.json
```

`private/` 不会进入 Git，也不会进入 `dist/`；构建脚本只读取 `whiteboards/public/`。

## 编辑器

- 最左侧竖向操作栏：目录开关、公开/私有切换、保存、样式面板开关、顶部操作栏开关、提交推送
- 目录标题同步显示 `SuperBoard-public` / `SuperBoard-private`
- tldraw 顶部操作栏默认隐藏，通过 `command` 按钮显示
- 操作栏最后是 `uploadCloud` 提交按钮：确认后在 Windows 打开新终端窗口，运行 `scripts/deploy.cmd`（`git add` / `commit` / `push`），随后由 GitHub Actions 自动部署
- 目录树支持文件夹、右键新建/重命名/删除文件夹、删除白板
- 画布右键可添加 Markdown 块和图表块；空白处、iframe/视频媒体不显示“复制为 / 导出为”
- 媒体块选中后可操作 iframe/视频控件；未选中时用于选择、双击编辑
- 底部“媒体”工具改为 URL/iframe 输入：图片、视频直链、网页链接或直接粘贴 `<iframe>` 标签
- 媒体块默认 640×360、锁定比例、圆角、无边框无背景；双击可修改链接
- 媒体块右键支持裁剪：矩形、圆角矩形、圆形；样式面板可调起点/圆心、尺寸、半径和圆角
- 左键双击块进入编辑，右键不会触发
- 自动保存 debounce 800ms，支持 `Ctrl/⌘ + S`
- Markdown 默认按内容高度展开；Markdown / 图表块锁定长宽比，缩放时内容按 460×340 / 580×380 基准整体缩放
- 样式面板默认隐藏，通过 `aperture` 按钮打开
- 图表画廊为三列流式布局，预览区不拦截滚轮

`/__deploy` 只在 Vite dev server 中注册，且只接受本机请求；线上静态站没有这个接口。

## 技术栈

| 用途 | 项目 |
| --- | --- |
| 画布底座 | [tldraw](https://github.com/tldraw/tldraw) |
| 图表渲染 | [Pele](https://pele.run/) |
| Markdown 渲染 | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) + [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) + [rehype-highlight](https://github.com/rehypejs/rehype-highlight) |
| 公式语法 | [AsciiMath](https://asciimath.org/) |
| 公式渲染 | [MathJax](https://www.mathjax.org/) |
| SVG 清洗 | [DOMPurify](https://github.com/cure53/DOMPurify) |
| 前端框架 | React + Vite |
| 图标动画 | react-useanimations |
| 拖拽排序 | [dnd-kit](https://github.com/clauderic/dnd-kit) |

Markdown 使用标准 Markdown/GFM 语法；公式使用行内 `$...$`、块级 `$$...$$`，内容按 AsciiMath 解释，由 MathJax 输出 SVG。

## 构建与部署

推送到 `main` 或 `master` 后，GitHub Actions 会执行类型检查、构建并部署到 GitHub Pages。工作流见 `.github/workflows/deploy.yml`。

相关环境变量：

| 变量 | 说明 |
| --- | --- |
| `BASE_PATH` | 站点路径，默认 `/SuperBoard/` |
| `SUPERBOARD_CNAME` | 生成 `CNAME`，可选 |
| `VITE_TLDRAW_LICENSE_KEY` | tldraw 生产授权 key，可选 |

生产部署请遵守 tldraw 授权要求；未提供 license key 时会保留右下角水印。

## 文档

实现规范与细节见：

- `参考/规范.md`
- `参考/doc/`
- `参考/plan/`

`参考/` 目录包含本地参考资料，默认被 `.gitignore` 忽略。

## 致谢

SuperBoard 建立在以下优秀开源项目之上：

- [tldraw](https://github.com/tldraw/tldraw)：画布底座与 shape 体系
- [Pele](https://pele.run/)：Mermaid 兼容的图表渲染
- [react-markdown](https://github.com/remarkjs/react-markdown) 及 remark/rehype 生态：Markdown 解析、GFM、清洗与代码高亮
- [AsciiMath](https://asciimath.org/)：公式语法
- [MathJax](https://www.mathjax.org/)：AsciiMath 到 SVG 的渲染
- [DOMPurify](https://github.com/cure53/DOMPurify)：SVG 安全清洗
- [dnd-kit](https://github.com/clauderic/dnd-kit)：控制帧拖拽排序

感谢这些项目的作者与维护者。
