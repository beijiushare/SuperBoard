# SuperBoard Desktop

Wails v3 外壳，复用仓库根目录的 React 编辑器。

## 结构

```text
desktop/
  main.go              Wails 入口、窗口、单实例
  services/            Go 服务（工作区、文件、附件、配置）
  build/               构建配置与平台资源
  frontend/dist/       构建时从根项目 dist 复制，git 忽略
  scripts/frontend.mjs 前端构建 / 开发桥接
```

Go 生成的 TypeScript bindings 输出到：

```text
web/src/desktop/bindings/
```

## 开发

```bash
# 在仓库根目录
npm run desktop:dev
```

或：

```bash
cd desktop
wails3 dev
```

`wails3 dev` 会在 `frontend/` 运行 `npm run dev`，该脚本转发到根项目的 Vite
开发服务器。

> 开发模式下页面由 Vite 直接提供，`/__files/` 附件路由由 Wails 资产服务器
> 处理，因此在 `wails3 dev` 中本地附件预览不可用。需要验证附件时请执行
> `wails3 build` 后运行 `bin/superboard.exe`。

## 构建

```bash
# 在仓库根目录
npm run desktop:build
```

或：

```bash
cd desktop
wails3 build
```

产物：

```text
desktop/bin/superboard.exe
```

构建流程：

1. `wails3 generate bindings` 生成 `web/src/desktop/bindings`
2. `frontend/` 的 `npm run build` 调用根项目 `npm run build:editor`
3. 复制 `dist/` 到 `desktop/frontend/dist`
4. Go 编译并嵌入前端资源

## 工作区

- 首次启动通过系统目录选择器选择工作区。
- 路径保存在 `%APPDATA%/SuperBoard/config.json`。
- 布局与浏览器端一致：`<workspace>/public`、`<workspace>/private`，
  兼容旧的 `whiteboards/public|private`。
- 附件位于 `<scope>/assets/files`，由 `/__files/` 只读暴露。
- 第二次启动会聚焦已有窗口，不再开新实例。
