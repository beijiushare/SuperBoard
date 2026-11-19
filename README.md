# SuperBoard

文件驱动的个人白板系统。白板保存为 Git 友好的 `.canvas`（JSON Canvas），编辑器在浏览器或桌面端直接打开你选择的本地文件夹。

> 个人项目，可能破坏式更新，请勿用于生产环境。

- 一个白板一个文件，无数据库、无后端存储
- 默认入口是编辑器，启动后选择工作区文件夹
- 工作区使用 `public/` 与 `private/` 两个子目录；旧 `whiteboards/public|private` 仍兼容
- `info/public` 只作为公开演示数据，不参与编辑器启动
- 支持 Markdown、AsciiMath 公式、Pele 图表和手绘
- 可导出单 HTML，也提供站点导出脚本

## 快速开始

要求 Node.js 24+。

```bash
npm install
npm run dev
```

打开终端输出的地址，选择本地工作区文件夹。刷新后会自动恢复上次目录权限。

```bash
npm run test:model
npm run test:editor
```

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动编辑器，选择本地工作区 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test:model` | 画布模型测试 |
| `npm run test:editor` | 编辑器核心逻辑测试 |
| `npm run build:editor` | 构建编辑器到 `dist/`，入口为 `index.html` |
| `npm run build:info` | 用 `info/public` 构建演示站到 `dist-info/` |
| `npm run export:site -- --data <目录> --out <目录>` | 从任意数据目录导出多文件站点 |
| `npm run preview:site` | 本地预览 `dist/` |
| `npm run mathjax` | 复制 MathJax 静态资源到 `public/mathjax/` |

### 站点导出

```bash
npm run export:site -- --data ./my-boards/public --out ./dist-site --base /
```

产物包括：

- `index.html`
- `tree.html`
- `boards/<slug>.html`
- `boards/<slug>.json`
- `404.html`、`.nojekyll`

### 预览必须通过 HTTP

不要直接双击构建产物用 `file://` 打开。它使用 ES Module 和绝对资源路径。

```bash
npm run build:info
uv run python -m http.server 4173 --directory dist-info
```

然后打开 `http://localhost:4173/`。

编辑器构建：

```bash
npm run build:editor
uv run python -m http.server 4174 --directory dist
```

打开 `http://localhost:4174/`，使用 Edge 或 Chrome 桌面版选择文件夹。

## 数据布局

新布局：

```text
<工作区>/
  public/
    board.canvas
    folder/board.canvas
  private/
    ...
```

旧布局仍可读取：

```text
<工作区>/
  whiteboards/
    public/
    private/
```

## 导出

- 编辑器 rail 的导出按钮可导出当前白板为单 HTML 或 SVG
- 多文件站点使用 `npm run export:site`
- 桌面端一键导出与部署命令仍在计划中
