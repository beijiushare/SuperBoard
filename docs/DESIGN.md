# SuperBoard 设计语言

本文档定义 SuperBoard 桌面端、网页端和设置界面的统一视觉规则。新增组件或页面时优先复用这里的 token 与模式，不要另起一套颜色和圆角。

## 1. 基础气质

- **纸张感**：暖白底 + 细描边，不用重阴影和大面积纯白。
- **克制**：一屏内只有一个主按钮；其余操作使用描边按钮或图标按钮。
- **清晰层级**：标题 / 正文 / 说明文字三级足够，不靠多种颜色区分层级。
- **圆角统一**：控件小圆角，卡片中圆角，弹窗大圆角。

## 2. 颜色

所有 token 定义在 `web/src/styles/base.css` 的 `:root`。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--sb-paper` | `#faf9f5` | 页面底色 |
| `--sb-surface` | `#fffdf8` | 卡片、弹窗、输入框底色 |
| `--sb-surface-muted` | `#f6f4ee` | 侧栏、悬停、次级区域 |
| `--sb-border` | `#e6e2d8` | 卡片/弹窗边框 |
| `--sb-border-subtle` | `#eeeae1` | 行分隔线 |
| `--sb-border-control` | `#d8d4c9` | 输入框、下拉、按钮边框 |
| `--sb-text` | `#1f1e1c` | 主文字 |
| `--sb-text-secondary` | `#6f6b60` | 次级文字、标签 |
| `--sb-text-muted` | `#8a857b` | 说明文字 |
| `--sb-text-faint` | `#a19c90` | 占位符、极弱信息 |
| `--sb-accent` | `#28924f` | 开关开启、选中态、滑块强调 |
| `--sb-accent-soft` | `rgb(40 146 79 / 12%)` | 强调态浅底 |
| `--sb-danger` | `#b4483c` | 危险操作文字 |

规则：

- 主操作按钮用深色 `#22211f`，不用品牌绿。
- 绿色只用于“开启 / 选中 / 当前值”，不要用来做普通按钮。
- 颜色选择器、开关、滑块统一使用 `--sb-accent`。
- 边框永远比背景深一档，避免纯黑描边。

## 3. 圆角与阴影

| Token | 值 | 用途 |
| --- | --- | --- |
| `--sb-radius-xs` | `4px` | 下拉选项、内部小标签 |
| `--sb-radius-sm` | `6px` | 小按钮、色块 |
| `--sb-radius-md` | `8px` | 输入框、按钮、下拉触发器 |
| `--sb-radius-lg` | `14px` | 卡片、面板 |
| `--sb-radius-pill` | `999px` | 开关、徽标 |

- 弹窗使用 `18px`，属于 `--sb-radius-lg` 的特例。
- 阴影只用于浮层：`--sb-shadow-popover`。
- 普通卡片不投影，靠 1px 边框区分层级。

## 4. 间距与排版

- 间距序列：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 36`。
- 卡片内边距：`18px 20px`；内容行高 `52px`，行间用 1px `--sb-border-subtle` 分隔。
- 页面级左右留白：`36px`。
- 字号：
  - 弹窗标题 `20px / 650`
  - 卡片标题 `15px / 650`
  - 行标签 `13px / 400`
  - 说明文字 `12px / 400`
  - 分组标题 `11px / 600`，大写 + `0.06em` 字距
- 字体沿用系统字体栈，不额外引入字体文件。

## 5. 控件规范

### 按钮

- 高度 `32px`，小按钮 `30px`。
- 主按钮：深色底、浅色字、`--sb-radius-md`。
- 次按钮：`--sb-surface` 底 + `--sb-border-control` 边框。
- 危险按钮：白底、`--sb-danger` 文字、浅红边框。
- 图标按钮：`32×32`，悬停使用 `--sb-surface-muted`。

### 输入框 / 下拉

- 高度 `34px`，圆角 `--sb-radius-md`，边框 `--sb-border-control`。
- 聚焦：边框加深 + `0 0 0 3px rgb(34 33 31 / 6%)`，不使用品牌色。
- 占位符使用 `--sb-text-faint`。
- 下拉菜单圆角 `10px`，选项悬停 `--sb-surface-muted`。

### 开关（Switch）

- 组件：`web/src/components/ui/switch.tsx`，样式 `web/src/styles/controls.css`。
- 尺寸 `36×20`，滑块 `16px`，轨道全圆角。
- 关闭：`#e3dfd5`；开启：`--sb-accent`（`#28924f`）。
- 只有“开 / 关”两个状态的设置项必须使用开关，不要再放两个按钮。
- 示例：开启网格、对齐参考线、模拟压感。

### 分段选择（2 个以上选项）

- 使用 `sb-style-buttons` 按钮组，选中态为绿色底 + 白字。
- 适用于：对齐方式、线型、裁剪形状、文本样式（B/I/U）。
- 两个选项的语义如果是“开/关”，改用开关。

### 数值输入

- 标签在左，滑块/数字框在右。
- 滑块宽 `120px`，数字框宽 `84px`，单位跟在数字框内。
- 滑块强调色统一 `--sb-accent`。

### 颜色选择

- 标签在左，最近色板 + 触发按钮在右。
- 色块 `20×20`，圆角 `5px`，选中描边使用 `--sb-accent`。

## 6. 布局模式

### 设置弹窗

- 左侧 `224px` 导航栏，右侧内容区。
- 顶部固定标题 + 说明，底部内容滚动。
- 每个分区是一张独立卡片，卡片头放标题/说明/右侧操作，卡片体放设置行。
- 只保留一个主操作按钮；危险操作放在卡片头右侧。
- 页面结构参考 `web/src/canvas/editor/PreferencesDialog.tsx` 与 `web/src/styles/settings.css`。

### 开始页

- 居中 `620px` 内容列，品牌在上，卡片在下。
- 卡片内每行“标题 + 说明”在左，控件在右，宽度固定 `220px`。
- 参考 `web/src/styles/welcome.css`。

### 编辑器浮层

- 样式面板、工具栏、右键菜单使用同一套边框、圆角、字号。
- 浮层阴影使用 `--sb-shadow-popover`。

## 7. 交互状态

- 悬停：背景变 `--sb-surface-muted` 或边框加深，不做位移。
- 按下：仅按钮允许 `translateY(1px)`。
- 禁用：`opacity: 0.5`，`cursor: default`。
- 键盘焦点：`outline: 2px solid` 强调色浅色或深色 3px 阴影，必须可见。

## 8. 新增组件检查清单

1. 是否复用了现有 token，而不是写死颜色？
2. 圆角是否落在 `xs / sm / md / lg` 四档？
3. 两个状态是否用了 Switch，多状态是否用了分段按钮？
4. 主按钮是否唯一？危险操作是否有独立视觉？
5. 中文/英文文案是否都走 i18n？
6. 焦点、悬停、禁用三种状态是否齐全？

## 9. 块渲染注意

- **背景和边框只由外层 Surface 提供**：`.sb-block-scale`（DOM 块）或 `ShapeLayer`（形状）负责，内容组件必须是透明、无边框。
- `.JCV-overlay-container` 必须是 `border-radius: 0`：vendor 默认是 `12px` + `contain: strict`，会按 12px 裁剪后代，把细边框块的角削成尖角。
- 块外层半径是 `--sb-card-radius + 边框宽度`；内容层（`.sb-card`、`.sb-card-pele`、`.sb-schedule`、Markdown 渲染层）使用 `--sb-card-radius` 并被裁剪，避免内容背景盖住边框内沿。
- Pele、日程等内容在块内必须 `background: transparent`；独立预览场景可以保留白底。
- Pele 的文字标签只允许 `fill`，不允许 `stroke`：继承到的描边会在字形外加一圈轮廓，被误认为「加粗 / 内轮廓」。`pele.css` 对 `text:not([fill='none'])` 强制 `stroke: none`，`fill="none"` 的 halo 文字保留。
- 分组背景/边框也走样式面板：`GroupLayer` 使用 `resolveNodeStyle`，调色板只做兜底。
- 新分组默认背景透明；`GroupLayer` 插在形状/手绘层之前，保证分组背景位于所有子元素下方。
- 封闭形状由 `ShapeLayer` 拆成填充层 + 描边层，分别使用背景透明度和边框透明度；导出 HTML 保持同样结构。
- 导出 HTML 的块、形状、分组都读取 `resolveNodeStyle`；普通文本、file 节点不输出 surface。
- 文件、链接、普通文本没有外层 Surface，样式面板不应显示背景/边框选项。
- 多选时样式面板按“至少一个元素支持”决定是否显示背景/边框，并且只应用到支持该属性的元素。
- 选中分组时样式面板显示「元素 / 分组」横向 tab（下划线指示当前项）：元素控制组内元素，分组控制分组背景、边框和内部间距。
- 新建分组默认内部间距 `16px`；修改间距时以分组中心外扩/内缩，子元素位置不变。
- 新建块尺寸按内容决定：Pele 用 `RenderResult.width/height` 的自然比例（过大时等比缩进 760×640），媒体用原始宽高比，Markdown 用默认宽度 + 内容估算高度；之后仍是普通块尺寸，不会被内容反向改写。
- 媒体尺寸来源：在线 URL 由浏览器解码；本地文件优先用桌面端 `PickFiles`/`ImportFile` 返回的 `width/height`（Go 只读文件头：png/jpeg/gif/webp/bmp/svg/avif、mp4/mov/m4v），拿不到才让浏览器测量，最后退回默认 480×320。
- Pele 块永远锁定比例（浮动条不提供解锁）：拖拽和样式面板的宽/高输入都按比例联动。Pele 的「窄屏模式」把 `maxWidth` 交给 Pele 的窄屏布局（`autoDirection`），并把块改为该布局的自然比例；切换时保持块面积，避免突然变得极高或极窄。
- 内容内边距写入 `style.padding`，由 `.sb-block-scale` 的 padding 实现，背景/边框仍由 Surface 覆盖全部区域；分组复用同一字段。
- 日程（FullCalendar v7）使用哈希类名，不能用 `.fc` 选择器；外框通过 `[data-color-scheme]`、`[role="table"]` 去除。
- 详细排查过程见 `memory/superboard-refactor.md` 的「踩坑记录」。
