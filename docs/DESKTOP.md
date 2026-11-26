# 桌面端

桌面版是 Wails v3 外壳，复用同一份 React 编辑器；工作区仍然是用户自己选择的本地文件夹。

## 结构

```text
desktop/
  main.go              Wails 入口、窗口、单实例、文件关联
  services/
    workspace.go       工作区选择/恢复、语言、根目录
    boards.go          白板读写、冲突检测、改名/移动/删除
    history.go         历史快照、恢复、清理
    files.go           附件导入、文件读取/删除
    folders.go         文件夹增删改
    export.go          导出目录与 HTML 保存
    update.go          检查更新、下载、校验、替换
    ai.go              凭据库与模型请求
    config.go          config.json 与原生对话框文案
  build/               构建配置与平台资源
  frontend/dist/       构建时从根项目 dist 复制，git 忽略
  scripts/frontend.mjs 前端构建/开发桥接
```

Go 生成的 TypeScript bindings 输出到 `web/src/desktop/bindings/`，前端通过 `web/src/desktop/platform.ts` 调用。

## 开发与构建

要求 Go、Wails v3 在 `PATH` 中。

```bash
npm run desktop:dev      # Wails 开发模式
npm run desktop:build    # 构建 desktop/bin/superboard.exe
npm run desktop:test     # Go 服务测试
```

构建流程：

1. `wails3 generate bindings` 生成 `web/src/desktop/bindings`
2. `frontend/` 的 `npm run build` 调用根项目的 `build:editor`
3. 复制 `dist/` 到 `desktop/frontend/dist`
4. Go 编译并嵌入前端资源

开发模式下页面由 Vite 提供，附件路由由 Wails 资产服务器处理；`wails3 dev` 中附件预览不可用，需要验证附件时构建后运行 exe。

## 配置

`config.json` 优先放在 exe 同目录；目录不可写或已存在用户配置时使用 `%APPDATA%/SuperBoard/config.json`。

```json
{
  "workspace": "D:\\Boards",
  "language": "zh-CN",
  "recent": [{ "path": "D:\\Boards", "name": "Boards", "lastOpened": "..." }]
}
```

- 启动时恢复上次工作区；失败则回到选择页。
- 最近工作区最多 8 个。
- 语言支持 `zh-CN`、`zh-TW`、`en-US`、`ja-JP`、`ko-KR`，同时写入原生对话框的语言来源。

## 窗口与系统集成

- 无边框窗口，默认 1180×700，启动时最大化并限制在工作区内。
- 单实例：第二次启动聚焦已有窗口。
- 命令行或文件关联传入 `.canvas` 时自动恢复工作区并打开白板。
- 侧栏空白处可拖动窗口；专注模式进入全屏，Esc 退出。
- 原生对话框标题走 `uiText(key)` 查表，不在调用点写死中英文。

## 工作区与文件

- 布局：`<workspace>/public`、`<workspace>/private`，兼容 `whiteboards/public|private`。
- 附件：`<scope>/assets/files`，通过 `/__files/` 只读暴露。
- 保存：临时文件 + rename；冲突返回 409，前端提供覆盖或重新加载。
- 历史：`.superboard/history/<scope>/<slug>/`，规则见 `HISTORY.md`。
- 路径校验拒绝 `..` 与越界路径；符号链接场景由 Wails 资产层与应用路径检查共同限制。

## 更新

桌面端只负责**发现新版本**，不自动下载或替换：

- 只读取 GitHub **latest 正式 Release**，draft / prerelease 不参与。
- 资产按 `windows` + `amd64` 匹配，文件名必须同时包含两者。
- 设置页显示版本、大小和发布说明，提供「手动下载」（打开 Releases 页面）与「定位路径」（打开 exe 所在目录）。
- 用户退出应用后，用新 exe 替换同目录下的旧文件。
- `SHA256SUMS` 供手动校验，不做代码签名。
- 自动安装已移除，原因是下载失败与替换时机不可控。
- 发布步骤见 `RELEASE.md`。

## 已知限制

- 未做 Authenticode 签名，Windows 可能提示“未知发布者”。
- 更新为全量下载，没有增量包。
- 没有文件监听；外部修改 `.canvas` 后需要重新打开或刷新。
- `wails3 dev` 下附件预览与部分原生行为与构建版不同，最终以 exe 为准。
