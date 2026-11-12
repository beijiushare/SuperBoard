# AGENTS.md

本文件是 SuperBoard 项目的强制规则，优先级高于任何默认行为。

## 文件操作

- **禁止使用 Bash/PowerShell 编辑、写入、追加文件。**
- 读取文件用 `read`、`grep`、`glob`。
- 修改文件必须使用 `edit` 工具。
- 新建或覆盖文件必须使用 `write` 工具。
- 删除文件才允许使用 `Remove-Item`，且必须确认路径。

## 禁止占位命令

- 禁止发送任何形式的占位命令、探测命令、空脚本。
- 禁止发送：

```text
python - <<'PY'
print('x')
PY
```

- 禁止使用 PowerShell 不支持的 heredoc（`<<`）。
- 如果不需要执行真实命令，就不要调用 Bash。
- 如果只是想继续编辑文件，直接调用 `edit` 或 `write`，不要先用 Bash 试探。

## Bash 使用范围

Bash 只允许用于：

- `npm run ...`
- `git ...`
- 启动/停止开发服务器
- `curl` / `Invoke-WebRequest` 验证 HTTP
- 真正需要执行的 Node/CLI 脚本

调用 Bash 前自检：

1. 这条命令是不是在修改文件？如果是，改用 `edit` / `write`。
2. 这条命令是不是占位/探测？如果是，删除，不要发送。
3. 命令里是否有 `<<`？如果有，改用 PowerShell 兼容写法或不要执行。

## Python

- 本项目不需要 Python。
- 禁止用 Python 处理项目文件。
- 如未来确实需要 Python，必须使用 `uv run python`，且不得用 heredoc。

## Git

- 每个功能独立提交。
- 提交前检查 `git status` 和 `git diff --stat`。
- 不提交 `whiteboards/` 的用户数据改动，除非明确要求。
- 不提交 `dist/`、`.preview/`、`参考/`。

## 工作方式

- 先读代码再改。
- 大改分阶段提交，保证可回退。
- 改完运行 `npm run typecheck`；涉及构建时运行 `npm run build:site`。
- 失败时不要进入重复尝试循环；停下来检查原因，改用正确工具。
