# SuperBoard

文件驱动的个人白板系统。白板保存为 Git 友好的 `.canvas`（JSON Canvas），编辑器在桌面端或浏览器中直接读写你选择的本地文件夹，不需要数据库或后端存储。

## 功能

- 无限画布：平移、缩放、框选、对齐参考线、网格背景
- 内容块：文本、Markdown、Pele 图表、日程、图片/视频/附件、手绘、形状、箭头
- 知识树：问题与回答卡片、路径上下文、增量摘要、失败重试、AI 问答
- 导演模式：帧编辑与放映，放映不修改画布相机
- 历史版本：按间隔保存快照，可预览、恢复、清理
- 导出：当前白板导出单 HTML，或把工作区导出为只读站点
- 多语言界面：5 种语言，可随时切换
- 桌面端：绿色版、检查更新、系统凭据库、单实例与文件关联

## 支持的语言

可在开始页或「设置 → 一般 → 语言」中切换。界面、AI 回答与桌面端原生对话框都会跟随所选语言。

| 语言 | 代码 |
| --- | --- |
| 简体中文 | `zh-CN` |
| 繁體中文 | `zh-TW` |
| English | `en-US` |
| 日本語 | `ja-JP` |
| 한국어 | `ko-KR` |

## 下载

| 使用方式 | 获取方式 |
| --- | --- |
| 桌面端 | [GitHub Releases](https://github.com/beijiushare/SuperBoard/releases/latest) |
| 浏览器 | [查看示例](https://beijiu.top/SuperBoard/) · [在线编辑器](https://beijiu.top/SuperBoard) |

桌面版是绿色版，建议放在可写目录（用户目录、桌面、自定义文件夹）。放在 `C:\Program Files`、`C:\Windows` 或系统盘根目录时，替换新版本需要管理员权限，配置文件也会回退到 `%APPDATA%\SuperBoard`。

## 快速开始

要求 Node.js 24+。桌面端构建还需要 Go 与 Wails v3。

```bash
npm install
npm run dev
```

打开终端输出的地址，选择本地工作区文件夹。刷新后会自动恢复上次目录权限。

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动编辑器开发服务器 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test:model` | 数据模型、知识树、提示词测试 |
| `npm run test:editor` | 编辑器几何与层级测试 |
| `npm run check:i18n` | 校验所有语言 key 一致 |
| `npm run audit:css` | 检查未引用的 CSS 类 |
| `npm run build:editor` | 构建编辑器到 `dist/` |
| `npm run build:site` | 用 `info/public` 构建只读演示站到 `dist-info/` |
| `npm run build:viewer` | 构建只读查看器 |
| `npm run export:site -- --data <目录> --out <目录>` | 从任意数据目录导出站点 |
| `npm run desktop:dev` | Wails 开发模式 |
| `npm run desktop:build` | 构建 `desktop/bin/superboard.exe` |
| `npm run desktop:test` | Go 服务测试 |
| `npm run release:desktop` | 打包 Windows 发布产物 |
| `npm run release:desktop:publish` | 创建 GitHub Release |

## 工作区

新布局：

```text
<工作区>/
  public/
    board.canvas
    folder/board.canvas
    assets/files/...
  private/
    ...
  .superboard/
    history/
```

新白板放在 `public/` 或 `private/` 下；旧版 `whiteboards/public|private` 仍会读取，用来兼容已有工作区。

导入的图片、视频和附件会复制到 `<scope>/assets/files/`，白板文件只记录相对路径（如 `public/assets/files/foo.png`），不内嵌二进制。这样 `.canvas` 保持小、可读、适合 Git；`public` 与 `private` 的附件分开存放，导出公开站点时不会把私有附件带出去。

历史快照按 `<scope>/<slug>` 存放，生命周期与清理规则见 [`docs/HISTORY.md`](docs/HISTORY.md)。

## 项目结构

```text
web/src/
  canvas/
    model/        数据模型、校验、知识树与导演帧布局
    editor/       编辑器外壳、交互与持久化 hooks
    viewer/       查看器与 SuperBoard 渲染层
    tree/         AI 上下文与提示词
  shared/         块组件、目录树、通用 UI
  desktop/        Wails 绑定与平台桥接
  dev/            开发服务器文件 API
  i18n/           语言包与初始化
  styles/         全局样式与组件样式
desktop/
  main.go         Wails 入口、窗口、单实例
  services/       工作区、白板、历史、附件、导出、更新、AI
scripts/          构建、导出、校验与发布脚本
docs/             项目文档
```

更完整的模块边界见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 文档

文档索引：[`docs/README.md`](docs/README.md)

- 架构与模块边界：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 数据格式：[`docs/DATA_FORMAT.md`](docs/DATA_FORMAT.md)
- 样式与组件规范：[`docs/DESIGN.md`](docs/DESIGN.md)
- 知识树：[`docs/KNOWLEDGE_TREE.md`](docs/KNOWLEDGE_TREE.md)
- AI 与提示词：[`docs/AI.md`](docs/AI.md)
- 历史版本：[`docs/HISTORY.md`](docs/HISTORY.md)
- 多语言：[`docs/I18N.md`](docs/I18N.md)
- 桌面端：[`docs/DESKTOP.md`](docs/DESKTOP.md)
- 站点部署：[`docs/DEPLOY.md`](docs/DEPLOY.md)
- 发布流程：[`docs/RELEASE.md`](docs/RELEASE.md)
- 手工验收：[`docs/TESTING.md`](docs/TESTING.md)

## 测试与发布

提交前至少运行：

```bash
npm run typecheck
npm run test:model
npm run test:editor
npm run check:i18n
```

涉及 CSS 的改动再运行 `npm run audit:css`；涉及桌面端时运行 `npm run desktop:test`。

发布步骤见 [`docs/RELEASE.md`](docs/RELEASE.md)。

## 贡献

- 提交前先读对应的 `docs/` 文档，数据格式与样式约定不要凭猜测修改
- 每个功能独立提交，保证可以单独回退
- 不提交 `whiteboards/`、`dist/`、`.preview/`、`参考/` 等本地数据与产物
- Bug 与建议请开 Issue；较大的改动先讨论范围再动手

## License

[MIT](LICENSE)。保留版权声明和许可证文本后，可自由 fork、修改、商用或闭源再发布。

## 致谢

SuperBoard 建立在很多开源项目和公开规范之上，并参考了部分相关项目的实现思路。

- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Wails](https://v3.wails.io)
- [Go](https://go.dev)
- [JSON Canvas](https://jsoncanvas.org)
- [json-canvas-viewer](https://github.com/hesprs/json-canvas-viewer)
- [pointeract](https://github.com/hesprs/pointeract)
- [@needle-di/core](https://github.com/needle-di/needle-di)
- [Pele](https://github.com/obsidianmd/pele)
- [Vditor](https://github.com/Vanessa219/vditor)
- [MathJax](https://www.mathjax.org)
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [FullCalendar](https://fullcalendar.io)
- [dnd-kit](https://dndkit.com)
- [marked](https://marked.js.org)
- [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill)
- [i18next](https://www.i18next.com)
- [react-i18next](https://react.i18next.com)
- [go-keyring](https://github.com/zalando/go-keyring)
- [Visual Studio Code](https://code.visualstudio.com)
- [draw.io](https://www.drawio.com)
