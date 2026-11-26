# 部署

## 数据来源

- 编辑器在运行时读取用户选择的本地文件夹，或内置的只读示例。
- 新工作区使用 `public/` 与 `private/`；旧 `whiteboards/public|private` 仍兼容。
- `info/public` 是示例工作区的源数据，构建时复制到 `public/sample/`。

## GitHub Pages

部署的是**编辑器本身**，不是静态查看器：

- 根路径 `/SuperBoard/` 打开开始页，可选择示例或本地文件夹。
- 示例工作区在 `/SuperBoard/sample/`，由 `info/` 生成。
- 不再生成 `tree.html` / `boards/*.html` 只读站点。

工作流：`.github/workflows/deploy.yml`，监听 `main` / `master` 和手动触发。

```text
npm ci
npm run typecheck
npm run check:i18n
BASE_PATH=/SuperBoard/ npm run build:editor   # 内含 prepare:sample
上传 dist/ 到 GitHub Pages
```

`SUPERBOARD_CNAME` 仓库变量用于写入 `CNAME`；当前自定义域名为 `beijiu.top`。

## 示例工作区

`npm run prepare:sample` 会把 `info/` 复制到 `public/sample/` 并生成 `sample.json`（白板、文件夹、文件清单、版本）。`public/sample/` 是生成目录，已加入 `.gitignore`。

- 示例是只读的；写请求在 sample 后端直接拒绝。
- 示例里的附件通过 `/sample/public/assets/files/...` 提供。
- 要更新示例，只改 `info/`，重新构建即可。

## 本地预览

不要用 `file://` 直接打开，ES Module 和资源路径会失败。

```bash
npm run build:editor
uv run python -m http.server 4174 --directory dist
# http://localhost:4174/
```

示例路径为 `http://localhost:4174/sample/`。

## 个人站点

如果需要把工作区导出为多文件只读站点，仍可使用：

```bash
npm run export:site -- --data "D:/notes/superboard/public" --out "./dist-site" --base /
```

导出后自行部署，例如 Vercel / Netlify。该产物与 GitHub Pages 的编辑器部署是两件事。

## 注意

- `dist/`、`dist-*`、`public/sample/` 不提交到 Git。
- 导出公开站点前确认 `private/` 不会进入产物。
