# 部署说明

## GitHub Pages：公开示例站

`info/public` 是仓库内唯一会提交的白板数据。

```bash
npm run build:info
```

GitHub Actions 会在 `main` 分支推送时执行：

- 读取 `info/public`
- 构建 viewer
- 部署到 GitHub Pages

工作流文件：`.github/workflows/pages.yml`

## Vercel：个人数据站

真实白板放在本地 `whiteboards/public`，该目录已被 `.gitignore` 忽略。

```bash
npm run build:data
vercel --prod
```

或者只部署构建产物：

```bash
npm run build:data
vercel deploy dist --prod
```

注意：

- `build:data` 从 `whiteboards/public` 读取数据
- `build:info` 从 `info/public` 读取示例数据
- `dist/` 不提交到 Git
- Vercel 部署的是当前构建快照，数据更新后需要重新构建和部署
- 部署前检查 `dist/` 中没有不想公开的内容

## 浏览器编辑器

构建产物同时包含：

- `index.html` / `tree.html` / `boards/*`：只读 viewer
- `editor.html`：浏览器编辑器

`editor.html` 使用 File System Access API 打开本地工作区：

- 需要 Chrome 或 Edge 桌面版
- 必须 HTTPS 或 localhost
- 首次选择文件夹后会请求读写权限
- 目录 handle 保存在 IndexedDB，下次打开会请求恢复权限

## 本地开发

```bash
npm run dev
```

开发服务器仍使用 Node 文件接口，编辑器访问 `whiteboards/`。

生产环境不再依赖 Node 文件接口。
