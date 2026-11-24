import { treePath, type SuperBoardTreeData } from '../model'
import type { AIChatMessage } from '../../desktop/ai'

/**
 * Answers must stay plain GFM Markdown: the card renders it directly, and a
 * structured payload would fail as a blank card whenever the model slips.
 */
const SYSTEM_PROMPT = [
  '你是知识树里的回答生成器。',
  '规则：',
  '1. 只输出 GFM Markdown，不要输出 HTML，也不要用代码块包裹整段回答；',
  '2. 需要对比、权衡或列参数时用表格；',
  '3. 关键结论、风险、待验证的点用引用块（可用 > [!NOTE] / [!WARNING]）标出；',
  '4. 不要重复用户的问题，直接从答案开始；',
  '5. 篇幅克制：先给结论，再按需展开，不要写客套话。',
].join('\n')

/**
 * Context is the root -> node path only. Sibling branches never enter the
 * prompt, so exploring two directions does not pollute either answer.
 */
export function buildTreeMessages(
  data: SuperBoardTreeData,
  nodeId: string,
): AIChatMessage[] {
  const path = treePath(data, nodeId)
  if (!path.length) return []
  const current = path[path.length - 1]
  if (!current.question.trim()) return []

  const messages: AIChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const ancestor of path.slice(0, -1)) {
    if (ancestor.question.trim()) {
      messages.push({ role: 'user', content: ancestor.question })
    }
    if (ancestor.answer.trim()) {
      messages.push({ role: 'assistant', content: ancestor.answer })
    }
  }

  const parts: string[] = []
  if (current.quote?.text.trim()) {
    const source = current.quote.title?.trim()
    parts.push(
      source
        ? `引用自「${source}」：\n> ${current.quote.text.trim()}`
        : `引用：\n> ${current.quote.text.trim()}`,
    )
  }
  parts.push(current.question.trim())
  messages.push({ role: 'user', content: parts.join('\n\n') })
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
