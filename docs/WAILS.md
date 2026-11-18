# SuperBoard 桌面端建议书（Wails）

## 目标

前端继续复用现有 React 编辑器，Go 只负责：

- 读写本地白板目录
- 原子保存与备份
- 监听外部文件变化
- 调用系统 Git

不建议把画布、渲染、编辑逻辑搬到 Go。主逻辑仍在 TypeScript，桌面端只是“本地文件系统 + Git”适配层。

## 推荐技术栈

- Go 1.22+
- Wails 稳定版（以官方安装器为准）
- Windows WebView2
- 系统 `git` 命令
- `fsnotify` 监听文件变化

Wails 版本优先选稳定版，不建议第一版追预览版。

## 环境准备

```powershell
go version
node -v
npm -v

go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor
```

`wails doctor` 应确认：

- Go 可用
- WebView2 可用
- Node/npm 可用
- 构建工具链完整

## 推荐目录

```text
desktop/
  main.go
  app.go
  storage.go
  git.go
  wails.json
  frontend/
    dist/            # 构建时复制现有 web 的 dist
```

核心前端仍然在现有仓库。桌面端不复制编辑器源码，只使用它的构建产物。

## 前端接入方式

Wails 有两种模式：

### 开发模式

- Wails 启动 Go 后端
- 前端指向现有 Vite dev server
- 通过 `wails.json` 配置 dev server URL

### 生产模式

- 先构建现有前端
- 把 `dist/` 放进 `desktop/frontend/dist`
- `wails build` 打包进 exe

不要把 `dist/` 提交到 Git。

## Go 侧建议接口

```go
type Workspace struct {
    Root string
}

func (a *App) OpenWorkspace() (string, error)
func (a *App) ListBoards() ([]BoardSummary, error)
func (a *App) ReadBoard(id string) ([]byte, error)
func (a *App) WriteBoard(id string, data []byte) error
func (a *App) CreateFolder(parent, name string) (string, error)
func (a *App) RenameBoard(id, title, slug, folder string) error
func (a *App) RenameFolder(path, name, parent string) error
func (a *App) DeleteBoard(id string) error
func (a *App) DeleteFolder(path string) error
```

路径校验必须做：

- 目标路径必须在工作区根目录内
- 禁止 `..`
- 禁止通过符号链接逃逸
- 写文件使用临时文件 + rename

## 保存策略

推荐：

1. 前端自动保存防抖 800–1200ms
2. 调用 Go `WriteBoard`
3. Go 写 `.tmp`
4. 校验 JSON
5. 保留 `.bak`
6. rename 覆盖目标文件

不要每次按键都写盘。  
不要只在关闭窗口时保存。

## 文件监听

使用 `fsnotify`：

- 监听 `whiteboards/public`、`whiteboards/private`
- 外部编辑器改了文件，通知前端刷新目录
- 自己写入时忽略短时间内的重复事件
- 窗口重新获得焦点时主动刷新一次

## Git 集成

推荐直接调用系统 `git`，不要第一版用 `go-git`。

原因：

- 能复用用户已有凭据
- 支持 credential manager
- 行为与命令行一致
- 复杂仓库兼容性更好

建议接口：

```go
func (a *App) GitStatus() (string, error)
func (a *App) GitDiff() (string, error)
func (a *App) GitCommit(message string) error
func (a *App) GitPush() error
```

实现：

```go
exec.Command("git", "-C", workspace, "status", "--porcelain")
exec.Command("git", "-C", workspace, "add", ".")
exec.Command("git", "-C", workspace, "commit", "-m", message)
exec.Command("git", "-C", workspace, "push")
```

原则：

- 保存和提交分离
- 不自动每次保存都 commit
- 提交前显示变更文件
- 提交失败要显示 stderr
- 不把 token 写进配置文件
- 推送失败提示用户检查远程和凭据

## 前端存储适配

建议抽象：

```ts
interface BoardRepository {
  listBoards(): Promise<BoardSummary[]>
  readBoard(id: string): Promise<CanvasDocument>
  writeBoard(id: string, data: CanvasDocument): Promise<void>
  createFolder(parent: string, name: string): Promise<string>
  renameBoard(...): Promise<void>
  deleteBoard(id: string): Promise<void>
}
```

实现：

- Web：File System Access API
- Desktop：Wails Go bindings
- Static viewer：fetch manifest + JSON

编辑器只依赖接口，不直接依赖 Wails 或浏览器 API。

## 构建

开发：

```powershell
wails dev
```

生产：

```powershell
npm run build:data
wails build
```

如果前端资源需要嵌入，构建前把 `dist/` 同步到 `desktop/frontend/dist`。

## 风险

- WebView2 依赖 Windows 环境
- Git 依赖用户机器已安装 git
- 文件监听在部分网络盘上不稳定
- 自动保存和外部修改可能冲突，需要 lastModified 或内容 hash 检测
- 不要在桌面端实现完整 Git 客户端，先做 status/commit/push 即可

## 建议顺序

1. 先做 Go 文件读写和 Wails 壳
2. 接现有前端构建产物
3. 做保存、备份、目录监听
4. 做 Git status / commit / push
5. 最后再考虑自动更新、签名、安装包
