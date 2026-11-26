# SuperBoard 文档

这里是开发和维护 SuperBoard 的入口。代码是最终事实；文档描述当前实现，改完行为就顺手改对应文档。

## 先读什么

| 你要做的事 | 先读 |
| --- | --- |
| 理解项目怎么跑起来 | 根目录 [`README.md`](../README.md) |
| 改模块、找文件、理清调用关系 | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 改 `.canvas`、加字段、改校验 | [`DATA_FORMAT.md`](DATA_FORMAT.md) |
| 改颜色、字号、间距、组件样式 | [`DESIGN.md`](DESIGN.md) |
| 改知识树交互或上下文 | [`KNOWLEDGE_TREE.md`](KNOWLEDGE_TREE.md) |
| 改 AI、提示词、压缩 | [`AI.md`](AI.md) |
| 改历史版本、恢复、清理 | [`HISTORY.md`](HISTORY.md) |
| 加语言、改文案 | [`I18N.md`](I18N.md) |
| 改桌面端、窗口、更新 | [`DESKTOP.md`](DESKTOP.md) |
| 改静态站点 | [`DEPLOY.md`](DEPLOY.md) |
| 发版本 | [`RELEASE.md`](RELEASE.md) |
| 手工验收 | [`TESTING.md`](TESTING.md) |

## 全部文档

- [`ARCHITECTURE.md`](ARCHITECTURE.md)：技术栈、三套运行时、目录与模块边界、保存流程
- [`DATA_FORMAT.md`](DATA_FORMAT.md)：JSON Canvas、`x-superboard` 扩展、知识树与导演帧
- [`DESIGN.md`](DESIGN.md)：设计 token、控件规范、CSS 归属与审查规则
- [`KNOWLEDGE_TREE.md`](KNOWLEDGE_TREE.md)：知识树的布局、交互、AI 上下文、导出
- [`AI.md`](AI.md)：模型槽位、凭据、请求、提示词、压缩与失败重试
- [`HISTORY.md`](HISTORY.md)：快照存储、采样、恢复、生命周期
- [`I18N.md`](I18N.md)：语言包结构、语言解析、AI 与原生对话框的语言
- [`DESKTOP.md`](DESKTOP.md)：Wails 外壳、Go 服务、配置、构建与更新
- [`DEPLOY.md`](DEPLOY.md)：只读站点与编辑器产物的部署
- [`RELEASE.md`](RELEASE.md)：版本号、打包、GitHub Release、更新验证
- [`TESTING.md`](TESTING.md)：手工验收清单

## 约定

- 不写阶段性交付记录、已删除功能的说明；历史请查 git。
- 文档中的路径、命令、接口必须能在当前仓库里找到对应实现。
- 新增模块或修改数据字段时，同步更新 `ARCHITECTURE.md` / `DATA_FORMAT.md`。
- 文档使用简体中文；代码标识符、文件名、命令保持原样。
