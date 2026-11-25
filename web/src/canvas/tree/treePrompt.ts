import { treePath, type SuperBoardTreeData, type SuperBoardTreeNode } from '../model'
import type { AIChatMessage } from '../../desktop/ai'

/**
 * Answers must stay plain GFM Markdown: the card renders it directly, and a
 * structured payload would fail as a blank card whenever the model slips.
 */
const SYSTEM_PROMPT = [
  '你是知识树里的回答生成器。',
  '规则：',
  '1. 第一行输出 `# 标题`，用不超过 14 个字概括这次回答的结论；标题之后空一行再写正文；',
  '2. 只输出 GFM Markdown，不要输出 HTML，也不要用代码块包裹整段回答；',
  '3. 需要对比、权衡或列参数时用表格；',
  '4. 关键结论、风险、待验证的点用引用块（可用 > [!NOTE] / > [!WARNING]）标出；',
  '5. 不要重复用户的问题，直接从答案开始；',
  '6. 如果用户引用了片段，只解释或回答该片段，不要扩展到整段原文；',
  '7. 篇幅克制：先给结论，再按需展开，不要写客套话。',
].join('\n')

/**
 * The first `# heading` becomes the card title, so the card shows a short
 * summary instead of repeating the question it already displays underneath.
 */
export function splitAnswerTitle(content: string) {
  const text = content.replace(/^\s+/, '')
  const match = text.match(/^#\s+(.+?)\s*(?:\r?\n|$)/)
  if (!match) return { title: '', body: text.trim() }
  return {
    title: match[1].trim().slice(0, 40),
    body: text.slice(match[0].length).replace(/^\s+/, '').trim(),
  }
}

/**
 * A quoted excerpt belongs to the question it was asked with. Dropping it from
 * the history would leave a bare "解释这段话" with no referent, and the model
 * would (correctly) complain that it is ambiguous.
 */
function questionWithQuote(node: SuperBoardTreeNode): string {
  const text = node.quote?.text.trim()
  if (!text) return node.question
  const source = node.quote?.title?.trim()
  const quoted = source ? `引用自「${source}」中的一段：\n> ${text}` : `引用：\n> ${text}`
  return `${quoted}\n\n${node.question}`
}

const COMPACTION_PROMPT = [
  '你在为一条思考路径写「前情提要」。',
  '把用户提供的问题与回答压缩成一段背景说明，供后续提问使用。',
  '只保留：已经确认的结论、关键事实与数据、仍然悬而未决的问题。',
  '不要复述过程，不要评价，不要提问。',
  '输出不超过 300 字，纯文本段落。',
].join('\n')

/** Messages used to summarise everything above a card. */
export function buildCompactionMessages(
  data: SuperBoardTreeData,
  nodeId: string,
): AIChatMessage[] {
  const path = treePath(data, nodeId)
  if (!path.length) return []
  const messages: AIChatMessage[] = [
    { role: 'system', content: COMPACTION_PROMPT },
  ]
  for (const node of path) {
    if (node.question.trim()) {
      messages.push({ role: 'user', content: questionWithQuote(node) })
    }
    if (node.answer.trim()) {
      messages.push({ role: 'assistant', content: node.answer })
    }
  }
  messages.push({ role: 'user', content: '请把以上对话压缩成前情提要。' })
  return messages
}

/**
 * Context is the root -> node path only. Sibling branches never enter the
 * prompt. Once a card carries a compaction, everything it covers is replaced by
 * that summary.
 */
export function buildTreeMessages(
  data: SuperBoardTreeData,
  nodeId: string,
): AIChatMessage[] {
  const path = treePath(data, nodeId)
  if (!path.length) return []
  const current = path[path.length - 1]
  if (!current.question.trim()) return []

  let startIndex = 0
  let summary = ''
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const summaryNode = data.nodes.find(
      (item) =>
        item.parentId === path[index].id &&
        item.role === 'summary' &&
        item.status === 'done' &&
        item.answer.trim(),
    )
    if (!summaryNode) continue
    summary = summaryNode.answer.trim()
    startIndex = index + 1
    break
  }

  const messages: AIChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  if (summary) {
    messages.push({ role: 'user', content: `前情提要：\n${summary}` })
  }
  for (const node of path.slice(startIndex)) {
    if (node.role === 'summary') continue
    if (node.question.trim()) {
      messages.push({ role: 'user', content: questionWithQuote(node) })
    }
    if (node.answer.trim()) {
      messages.push({ role: 'assistant', content: node.answer })
    }
  }
  return messages
}

/** Rough token estimate used to warn before a very long path is sent. */
export function estimateTokens(messages: AIChatMessage[]) {
  const characters = messages.reduce(
    (total, message) => total + message.content.length,
    0,
  )
  // Mixed CJK and latin text averages a little under one token per character.
  return Math.ceil(characters * 0.7)
}
