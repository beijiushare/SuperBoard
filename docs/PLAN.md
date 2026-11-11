# SuperBoard JSON Canvas 迁移计划

> 状态：已确认，进入实施  
> 最后更新：2026-11-12

## 1. 目标

把 SuperBoard 从 tldraw 基座迁移到自建编辑器 + JSON Canvas 查看器：

- 主数据格式改为 `.canvas`（JSON Canvas 1.0 超集）
- 自建轻量编辑器，不再依赖 tldraw
- 线上只读查看器与编辑器彻底分离
- 保留现有自定义块、手写、导演幕布、导出和基本编辑能力
- 数据优先保持可被 Obsidian 等标准 JSON Canvas 工具打开

## 2. 已确认决策

| 项目 | 决策 |
| --- | --- |
| 编辑底座 | 自建编辑器，移除 tldraw |
| 主格式 | JSON Canvas 1.0，扩展字段使用 `x-superboard` |
| 查看器 | fork `json-canvas-viewer`，按需改造 |
| 线上能力 | 只读 |
| 编辑器位置 | 仅本地 dev |
| 手写 | `perfect-freehand`，不做图片回退 |
| 手写兜底 | 标准查看器看不到笔画，接受；数据存 `x-superboard.strokes` |
| 橡皮擦 | 整笔删除 |
| Pele | 文本源 + 自定义渲染；标准查看器回退为文本/代码 |
| 媒体 | 只存链接，不嵌入二进制 |
| 普通文本 | 独立于 Markdown，支持字体、字号、颜色、对齐、换行、自动增高 |
| Markdown | 保留公式、表格、代码块、MathJax |
| 基础形状 | 矩形、椭圆、菱形、线条；不做便签 |
| 箭头 | 节点到节点的 edge；标准 JSON Canvas 箭头 |
| 编组 | 支持“编组/解组”命令；不提供单独的分组框工具 |
| Frame | 暂不实现；保留 `group` + `x-superboard.kind = "frame"` 扩展入口 |
| 导演幕布 | 独立覆盖层，不转成 Group/Frame |
| 导出 | PNG、SVG；单文件 HTML 后补 |
| 性能 | 先不做完整虚拟化，但渲染器预留视口裁剪和媒体懒加载 |
| 多页面 | 不支持 |
| 画布 | 无限画布、网格背景 |

## 3. 架构

```text
web/src/
  canvas/                自建编辑器内核
    model/               JSON Canvas 类型、校验、扩展字段
    editor/              工具、选择、变换、历史、剪贴板
    renderer/            节点/边渲染、视口裁剪
    interactions/        指针、键盘、手写、箭头、缩放
  blocks/                自定义块渲染与编辑
    markdown/
    pele/
    media/
  viewer/                fork 后的 JSON Canvas 查看器
  shared/                编辑器与查看器共用的模型和块渲染
  dev/boardFs/           本地 .canvas 文件读写
```

运行时：

```text
本地编辑器
  -> 读写 .canvas
  -> x-superboard 保存富数据
  -> 可导出 PNG/SVG

构建脚本
  -> 扫描 whiteboards/public/**/*.canvas
  -> 生成目录页和单白板只读页
  -> 只打包 viewer

线上查看器
  -> 读取内嵌 JSON Canvas
  -> 渲染标准节点 + 自定义模块
  -> 导演幕布只读播放
```

## 4. 数据格式

顶层保持 JSON Canvas 标准结构：

```json
{
  "nodes": [],
  "edges": [],
  "x-superboard": {
    "version": 1,
    "meta": {
      "title": "示例白板",
      "slug": "example",
      "summary": "",
      "order": 10,
      "draft": false,
      "aliases": [],
      "updatedAt": "2026-11-12T00:00:00.000Z"
    },
    "director": {
      "frames": []
    }
  }
}
```

节点扩展：

```json
{
  "id": "node-1",
  "type": "text",
  "x": 0,
  "y": 0,
  "width": 400,
  "height": 300,
  "text": "# 标题\n\n正文",
  "x-superboard": {
    "kind": "markdown",
    "style": {
      "backgroundColor": "white",
      "borderColor": "grey",
      "borderWidth": "thin",
      "borderStyle": "solid",
      "backgroundOpacity": 100,
      "borderOpacity": 35
    }
  }
}
```

映射规则：

| SuperBoard 对象 | 标准节点 | 扩展 |
| --- | --- | --- |
| 普通文本 | `text` | `kind: "text"`、字体/字号/颜色/对齐 |
| Markdown | `text` | `kind: "markdown"`、块样式 |
| Pele | `text`（源码） | `kind: "pele"`、图表类型、块样式 |
| 媒体 | `link`（URL） | `kind: "media"`、图片/视频/iframe、裁剪 |
| 矩形/椭圆/菱形/线条 | `group` | `kind: "shape"`、具体形状和样式 |
| 手写 | `group` | `kind: "drawing"`、`strokes` |
| 编组 | `group` | `kind: "group"` |
| 箭头 | `edges` | 标准 `fromNode` / `toNode` / `side` |
| 导演帧 | 不占用节点 | 根级 `director` |
| 画布元数据 | 不占用节点 | 根级 `meta` |

原则：

- 标准查看器能识别节点本身
- 自定义能力放在 `x-superboard`
- 不生成图片回退文件
- 不嵌入二进制资源
- 坐标使用整数，必要时在导入时取整

## 5. 实施阶段

### Phase 0：文档与计划

- [x] 确认产品边界和数据格式
- [x] 建立迁移计划
- [x] 更新 README

### Phase 1：模型与文件层

- [x] 定义 JSON Canvas 类型
- [x] 定义 `x-superboard` 扩展类型
- [x] 实现解析、校验、序列化
- [x] 实现 `.canvas` 文件扫描与 dev API
- [x] 保留旧 `.tldr.json` 转换核心
- [x] 批量转换 CLI（`npm run convert:canvas`）
- [x] 添加模型层测试脚本

### Phase 2：查看器

- [x] 使用上游 `json-canvas-viewer` 做渲染 spike
- [ ] 整合/ fork `json-canvas-viewer`
- [ ] 渲染标准节点和边
- [ ] 增加 Markdown / Pele / 媒体模块
- [x] 增加手写渲染
- [ ] 增加导演幕布覆盖层和播放
- [ ] 保留目录抽屉与只读 rail

### Phase 3：编辑器内核

- [ ] 无限画布、网格、平移、缩放
- [ ] 指针选择、框选、移动、缩放、旋转
- [ ] 编组/解组、锁定、层级
- [ ] 撤销/重做、复制/粘贴、快捷键
- [ ] 对齐/分布
- [ ] 手写工具 + 整笔橡皮擦
- [ ] 箭头工具
- [ ] 文本工具
- [ ] 矩形/椭圆/菱形/线条
- [ ] Markdown / Pele / 媒体块
- [ ] 样式面板

### Phase 4：迁移与构建

- [ ] 旧白板转换为 `.canvas`
- [ ] 构建脚本改为 `.canvas`
- [ ] 静态页面、目录、别名、404
- [ ] 线上 E2E
- [ ] 编辑器 E2E

### Phase 5：导出与优化

- [ ] PNG 导出
- [ ] SVG 导出
- [ ] 单文件 HTML 导出（后补）
- [ ] 视口裁剪
- [ ] 媒体/Markdown 懒加载

## 6. 验收标准

- 现有公开白板可以转换并在 Obsidian 中打开
- 标准节点至少显示文本、链接或分组框
- 线上查看器不依赖 tldraw，也不包含编辑功能
- 编辑器可以完成日常白板操作
- 手写、Pele、媒体、Markdown、导演幕布功能不丢失
- 所有阶段通过 `npm run typecheck` 和构建检查
- 每个阶段独立提交，可回退

## 7. 风险

| 风险 | 应对 |
| --- | --- |
| 自建编辑器工作量大 | 按阶段提交，先跑通最小闭环 |
| JSON Canvas 不支持富样式 | 用 `x-superboard`，标准查看器降级 |
| 手写在标准查看器不可见 | 已接受，不生成图片回退 |
| 两个渲染器行为不一致 | 共用模型和块渲染组件 |
| 1000 节点性能 | 预留视口裁剪和懒加载，不提前复杂化 |
| tldraw 旧数据迁移丢失 | 保留 `.tldr.json` 和转换脚本，先复制再迁移 |

## 8. Git 策略

- 每个阶段一个 commit
- 文档、模型、查看器、编辑器、迁移分开提交
- 不把用户白板数据混入功能提交
- 大改前先提交可回退点
- 迁移期间保留旧代码，直到新路径验证通过
