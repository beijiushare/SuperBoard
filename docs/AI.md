# AI

## 组成

| 位置 | 职责 |
| --- | --- |
| `web/src/desktop/ai.ts` | 前端封装：槽位设置、会话头、错误抛出 |
| `desktop/services/ai.go` | Go：凭据存取、OpenAI 兼容请求、超时与错误映射 |
| `web/src/canvas/tree/treePrompt.ts` | 知识树上下文、系统提示、压缩提示、语言 |
| `web/src/canvas/editor/CanvasEditorApp.tsx` | 触发回答、压缩、失败重试 |
| `web/src/canvas/editor/preferences.ts` | 槽位与压缩阈值（`localStorage`） |

AI 只在桌面端可用；浏览器端不保存密钥，也不能发起请求。

## 模型槽位

三套槽位，切换不会丢配置：

| 槽位 | 默认地址 | 默认模型 | 密钥 |
| --- | --- | --- | --- |
| `local` | `http://127.0.0.1:11434/v1` | `llama3.2` | 不需要 |
| `online-a` | `https://api.openai.com/v1` | `gpt-4o-mini` | 需要 |
| `online-b` | `https://api.deepseek.com/v1` | `deepseek-chat` | 需要 |

- 槽位 ID 同时是系统凭据库里的条目名，改显示名不会让密钥失联。
- 密钥存 Windows Credential Manager / macOS Keychain / Linux Secret Service（`zalando/go-keyring`）。
- 前端只能看到“有没有密钥”和 `sk-...abcd` 掩码，**密钥不返回 WebView**。
- 支持每槽位自定义请求头，一行一个 `Name: value`。

## 请求

- 统一走 OpenAI 兼容的 `POST {baseURL}/chat/completions`。
- 超时 120 秒；目前非流式。
- 请求由 Go 发出，前端不直接访问模型端点。
- `opencode.ai` 域名自动补 `x-opencode-session`；前端为每次会话生成稳定 ID，并按树块使用 `<slug>:<blockId>`，让同一棵树的请求落在同一会话。
- 失败以错误文本返回，由卡片显示为红色状态；不会留下空白卡片。

## 知识树上下文

- 只拼「根 → 当前节点」的路径，兄弟分支不进入上下文。
- 祖先按 `user` / `assistant` 交替；当前问题放最后。
- 引用来自祖先时只标记引用位置；来自兄弟分支或其他块时整段附上。
- 系统提示要求：第一行 `# 标题`、GFM Markdown、表格使用边界、引用块标记重点、回答语言跟随界面。

提示词在 `treePrompt.ts` 按语言提供五套：简体、繁體、English、日本語、한국어。新增语言必须同时补提示词，否则会出现“界面语言 A、回答语言 B”。

## 压缩

路径预估 token 超过设置中的阈值（默认 100000，约 128k 窗口的 85%）时，先压缩再提问。

- 摘要卡是真实卡片，挂在当前问题的最深祖先下，覆盖「根 → 该祖先」，后代继承。
- 已有可用摘要时做**增量更新**：把摘要之后新增的问答合并进同一张卡，并把它移到新的最深祖先下。同一条路径始终只有一张摘要。
- 摘要失败时保留红卡；下次提问自动复用同一张卡重试，不叠加第二张。
- 摘要是普通 Markdown 文本，不参与提问，也不能被删除。

拆分见 `KNOWLEDGE_TREE.md`。

## 修改提示词时的检查

1. 标题规则不能删：卡片标题是树的目录。
2. 表格边界不能放宽：定性分析、原因、风险、评价、步骤、单对象说明都不该用表格。
3. 任何规则变化都要同时改五种语言。
4. 跑 `npm run test:model`，至少覆盖上下文拼接、引用、摘要与语言。
5. 真实模型行为无法用单测覆盖，改完用一棵长路径树手动验证压缩与增量压缩。

## 隐私

- 白板内容会随请求发送到当前槽位配置的端点；本地模型不出本机。
- 密钥只在系统凭据库与 Go 进程内出现。
- 没有遥测、没有内置代理、没有云端账号。
