import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distDir = path.join(root, 'dist')
const boardsDir = path.join(root, 'whiteboards', 'public')
const manifestPath = path.join(distDir, '.vite', 'manifest.json')
const templatePath = path.join(root, 'web', 'template.html')

const base = normalizeBase(process.env.BASE_PATH || '/SuperBoard/')
const siteName = 'SuperBoard'

function normalizeBase(value) {
  let result = value.trim()
  if (!result.startsWith('/')) result = `/${result}`
  if (!result.endsWith('/')) result = `${result}/`
  return result
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function assertSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`非法 slug: ${JSON.stringify(slug)}，只允许小写字母、数字和连字符`)
  }
}

function validateBoard(board, file) {
  if (!board || typeof board !== 'object') throw new Error(`${file}: 不是对象`)
  if (board.version !== 1) throw new Error(`${file}: 只支持 version 1`)
  if (!board.meta || typeof board.meta !== 'object') throw new Error(`${file}: 缺少 meta`)
  if (typeof board.meta.title !== 'string' || !board.meta.title.trim()) {
    throw new Error(`${file}: meta.title 不能为空`)
  }
  assertSlug(board.meta.slug)
  if (!board.document || typeof board.document !== 'object' || !board.document.store) {
    throw new Error(`${file}: document 必须是 tldraw 文档 snapshot`)
  }
  if (board.meta.aliases) {
    if (!Array.isArray(board.meta.aliases)) throw new Error(`${file}: meta.aliases 必须是数组`)
    for (const alias of board.meta.aliases) assertSlug(alias)
  }
}

async function readBoards() {
  const files = []

  async function visit(dir, folder) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath, folder ? `${folder}/${entry.name}` : entry.name)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.tldr.json')) {
        files.push({
          file: fullPath,
          folder,
          relative: path.relative(boardsDir, fullPath).split(path.sep).join('/'),
        })
      }
    }
  }

  await visit(boardsDir, '')

  const boards = []
  const seenSlugs = new Map()

  for (const item of files.sort((a, b) => a.relative.localeCompare(b.relative, 'en'))) {
    const raw = await fs.readFile(item.file, 'utf8')
    let board
    try {
      board = JSON.parse(raw)
    } catch (error) {
      throw new Error(`${item.relative}: JSON 解析失败: ${error.message}`)
    }
    validateBoard(board, item.relative)
    if (seenSlugs.has(board.meta.slug)) {
      throw new Error(`slug 重复: ${board.meta.slug}（${seenSlugs.get(board.meta.slug)} 和 ${item.relative}）`)
    }
    seenSlugs.set(board.meta.slug, item.relative)
    boards.push({ ...item, board })
  }

  return boards.sort((a, b) => {
    const ai = a.board.meta.order ?? Number.MAX_SAFE_INTEGER
    const bi = b.board.meta.order ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    return a.board.meta.title.localeCompare(b.board.meta.title, 'zh-CN')
  })
}

function renderIndex(boards) {
  const cards = boards
    .filter(({ board }) => !board.meta.draft)
    .map(({ board }) => {
      const title = escapeHtml(board.meta.title)
      const href = `${base}boards/${board.meta.slug}.html`
      const updated = board.meta.updatedAt
        ? `<p class="meta">更新于 ${escapeHtml(formatDate(board.meta.updatedAt))}</p>`
        : ''
      const summary = board.meta.summary
        ? `<p class="summary">${escapeHtml(board.meta.summary)}</p>`
        : ''
      return `<a class="card" href="${href}"><h2>${title}</h2>${summary}<p class="slug">${escapeHtml(board.meta.slug)}</p>${updated}</a>`
    })
    .join('\n')

  const body = cards || '<p class="empty">还没有白板。运行 <code>npm run seed</code> 创建一个示例。</p>'
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${siteName}</title>
<script>
if (new URLSearchParams(location.search).has('tree')) {
  location.replace('${base}tree.html' + location.search);
}
</script>
<style>
:root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #f6f5f1; color: #1f1e1c; }
main { width: min(980px, calc(100% - 40px)); margin: 0 auto; padding: 72px 0; }
header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
h1 { margin: 0; font-size: clamp(32px, 6vw, 56px); line-height: 1; letter-spacing: -0.04em; }
header p { margin: 0; color: #6f6d66; font-size: 14px; }
header a { color: #205ea6; text-decoration: none; }
header a:hover { text-decoration: underline; text-underline-offset: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.card { display: block; padding: 22px; border: 1px solid #dedbd2; border-radius: 16px; background: #fffdf8; color: inherit; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
.card:hover { transform: translateY(-2px); border-color: #b9b5a9; box-shadow: 0 12px 30px rgba(50, 45, 30, .08); }
.card h2 { margin: 0 0 8px; font-size: 20px; letter-spacing: -0.02em; }
.card .summary { margin: 0 0 14px; color: #55524c; line-height: 1.55; }
.card .slug { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #8b877d; }
.card .meta { margin: 12px 0 0; font-size: 12px; color: #8b877d; }
.empty { padding: 40px; border: 1px dashed #cbc7bc; border-radius: 16px; color: #6f6d66; }
.empty code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
footer { margin-top: 48px; font-size: 12px; color: #969187; }
@media (max-width: 640px) { main { padding: 40px 0; } header { display: block; } header p { margin-top: 10px; } }
</style>
</head>
<body>
<main>
<header><div><h1>${siteName}</h1><p>个人白板集合 · 只读分享</p></div><p><a href="${base}tree.html">目录视图</a> · ${boards.length} 个白板</p></header>
<section class="grid">${body}</section>
<footer>由 SuperBoard 生成 · 内容来自 Git 仓库</footer>
</main>
</body>
</html>`
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function renderBoardPage(board, entry, cssFiles, template) {
  const title = board.meta.title
  const data = `window.__SUPERBOARD__ = ${escapeJsonForHtml({ board, base })};`
  const css = cssFiles
    .map((file) => `<link rel="stylesheet" href="${base}${escapeHtml(file)}">`)
    .join('\n    ')
  return template
    .replaceAll('__TITLE__', () => escapeHtml(title))
    .replace('__CSS__', () => css)
    .replace('__DATA__', () => `<script>${data}</script>`)
    .replace('__ENTRY__', () => `${base}${escapeHtml(entry.file)}`)
}

function renderTreePage(boards, entry, cssFiles, template) {
  const treeBoards = boards
    .filter(({ board }) => !board.meta.draft)
    .map(({ folder, board }) => ({
      slug: board.meta.slug,
      title: board.meta.title,
      summary: board.meta.summary,
      order: board.meta.order,
      updatedAt: board.meta.updatedAt,
      path: folder,
    }))
  const data = `window.__SUPERBOARD__ = ${escapeJsonForHtml({ mode: 'tree', boards: treeBoards, base })};`
  const css = cssFiles
    .map((file) => `<link rel="stylesheet" href="${base}${escapeHtml(file)}">`)
    .join('\n    ')
  return template
    .replaceAll('__TITLE__', () => escapeHtml('白板目录 · SuperBoard'))
    .replace('__CSS__', () => css)
    .replace('__DATA__', () => `<script>${data}</script>`)
    .replace('__ENTRY__', () => `${base}${escapeHtml(entry.file)}`)
}

function renderAliasPage(target) {
  const href = `${base}boards/${target}.html`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${href}"><title>跳转中</title></head><body><p>正在跳转到 <a href="${href}">${escapeHtml(target)}</a>…</p></body></html>`
}

async function main() {
  const [template, manifest, boards] = await Promise.all([
    fs.readFile(templatePath, 'utf8'),
    fs.readFile(manifestPath, 'utf8').then(JSON.parse),
    readBoards(),
  ])

  const entry = Object.values(manifest).find((item) => item.isEntry)
  if (!entry) throw new Error('找不到 Vite manifest entry')

  const cssFiles = new Set()
  for (const item of Object.values(manifest)) {
    if (item.file?.endsWith('.css')) cssFiles.add(item.file)
    for (const css of item.css || []) cssFiles.add(css)
  }

  await fs.mkdir(path.join(distDir, 'boards'), { recursive: true })
  await fs.writeFile(path.join(distDir, '.nojekyll'), '')
  await fs.writeFile(path.join(distDir, 'index.html'), renderIndex(boards))
  await fs.writeFile(path.join(distDir, 'tree.html'), renderTreePage(boards, entry, [...cssFiles], template))

  const generated = new Set()

  for (const { board } of boards) {
    const page = renderBoardPage(board, entry, [...cssFiles], template)
    const file = path.join(distDir, 'boards', `${board.meta.slug}.html`)
    await fs.writeFile(file, page)
    await fs.writeFile(
      path.join(distDir, 'boards', `${board.meta.slug}.json`),
      `${JSON.stringify(board)}\n`,
      'utf8',
    )
    generated.add(board.meta.slug)

    for (const alias of board.meta.aliases || []) {
      if (generated.has(alias)) throw new Error(`别名冲突: ${alias}`)
      await fs.writeFile(path.join(distDir, 'boards', `${alias}.html`), renderAliasPage(board.meta.slug))
      generated.add(alias)
    }
  }

  if (process.env.SUPERBOARD_CNAME) {
    await fs.writeFile(path.join(distDir, 'CNAME'), `${process.env.SUPERBOARD_CNAME.trim()}\n`)
  }

  await fs.writeFile(
    path.join(distDir, '404.html'),
    `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>页面不存在</title></head><body style="font-family:system-ui,sans-serif;padding:48px"><h1>404</h1><p>这个页面不存在。</p><p><a href="${base}">返回首页</a></p></body></html>`,
  )

  console.log(`SuperBoard: 已生成 ${boards.length} 个白板到 dist/`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
