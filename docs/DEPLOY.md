# 部署说明

## 数据来源

- 编辑器只在运行时读取用户选择的本地文件夹，不再依赖仓库内 `whiteboards/`。
- 新工作区使用 `public/` 与 `private/`；旧 `whiteboards/public|private` 仍兼容。
- `info/public` 仅作为公开演示数据。

## 演示站（GitHub Pages）

```bash
npm run build:info
```

输出到 `dist-info/`，base 为 `/SuperBoard/`。

GitHub Actions 工作流：`.github/workflows/pages.yml`。

## 个人站点

从任意工作区导出多文件站点：

```bash
npm run export:site -- --data "D:/notes/superboard/public" --out "./dist-site" --base /
```

也可以把 `--out` 指向部署工具目录。导出完成后由用户自己部署，例如：

```bash
cd dist-site
vercel --prod
```

或：

```bash
netlify deploy --prod --dir dist-site
```

> 一键部署命令执行器尚未实现，后续只计划在桌面端提供。

## 编辑器构建

```bash
npm run build:editor
```

输出 `dist/index.html`，默认 base 为 `/`。浏览器需要用 Edge/Chrome 桌面版打开并通过 File System Access API 选择文件夹。

## 本地预览

```bash
uv run python -m http.server 4173 --directory dist-info
# http://localhost:4173/
```

```bash
uv run python -m http.server 4174 --directory dist
# http://localhost:4174/
```

不要用 `file://` 直接打开，ES Module 和资源路径会失败。

## 注意

- `dist/`、`dist-*` 不提交到 Git。
- 导出前确认 `private/` 不会进入站点产物。
- 站点导出先生成临时结果；后续桌面端会加入清单与原子替换。
