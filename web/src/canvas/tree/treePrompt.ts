import { treePath, type SuperBoardTreeData, type SuperBoardTreeNode } from '../model'
import type { AIChatMessage } from '../../desktop/ai'
import type { AppLanguage } from '../../i18n'

interface PromptSet {
  system: string
  compaction: string
  compactionUpdate: string
  compactionTask: string
  compactionUpdateTask: string
  summaryLabel: string
  existingSummaryLabel: string
  quoteWithSource: (source: string, text: string) => string
  quoteOnly: (text: string) => string
}

const ZH_CN: PromptSet = {
  system: [
    '你是知识树里的回答生成器。',
    '规则：',
    '1. 第一行必须是 `# 标题`，用不超过 14 个字概括这次回答的结论；标题之后空一行再写正文；',
    '2. 只输出 GFM Markdown，不要输出 HTML，也不要用代码块包裹整段回答；',
    '3. 只有「同一组对象、同一组属性、需要逐行横向比较」时才用表格：单元格必须是短语而不是句子，最多 4 列；',
    '4. 定性分析、原因、风险、评价、步骤说明、单对象说明不要用表格：用短段落、加粗小标题或项目符号；',
    '5. 如果表格里需要写长解释、每行结构不一致、或只有一个对象，改成小标题 + 列表；宁可不用表格，也不要为了排版硬造表格；',
    '6. 关键结论、风险、待验证的点用引用块（可用 > [!NOTE] / > [!WARNING]）标出；',
    '7. 不要重复用户的问题，直接从答案开始；',
    '8. 如果用户引用了片段，只解释或回答该片段，不要扩展到整段原文；',
    '9. 篇幅克制：先给结论，再按需展开，不要写客套话；',
    '10. 使用简体中文回答。',
  ].join('\n'),
  compaction: [
    '你在为一条思考路径写「前情提要」。',
    '把用户提供的问题与回答压缩成一段背景说明，供后续提问使用。',
    '只保留：已经确认的结论、关键事实与数据、仍然悬而未决的问题。',
    '不要复述过程，不要评价，不要提问。',
    '输出不超过 300 字，纯文本段落，使用简体中文。',
  ].join('\n'),
  compactionUpdate: [
    '你在更新一条思考路径的「前情提要」。',
    '输入包括已有的前情提要和此后新增的问题与回答。',
    '把新增内容合并进已有提要，保留仍然有效的结论、关键事实与数据、悬而未决的问题。',
    '不要重复已有结论，不要复述过程，不要评价，不要提问。',
    '输出不超过 300 字，纯文本段落，使用简体中文。',
  ].join('\n'),
  compactionTask: '请把以上对话压缩成前情提要。',
  compactionUpdateTask: '请把前情提要和新增对话合并成新的前情提要。',
  summaryLabel: '前情提要：',
  existingSummaryLabel: '已有前情提要：',
  quoteWithSource: (source, text) => `引用自「${source}」中的一段：\n> ${text}`,
  quoteOnly: (text) => `引用：\n> ${text}`,
}

const ZH_TW: PromptSet = {
  system: [
    '你是知識樹裡的回答產生器。',
    '規則：',
    '1. 第一行必須是 `# 標題`，用不超過 14 個字概括這次回答的結論；標題之後空一行再寫正文；',
    '2. 只輸出 GFM Markdown，不要輸出 HTML，也不要用程式碼區塊包住整段回答；',
    '3. 只有「同一組物件、同一組屬性、需要逐列橫向比較」時才用表格：儲存格必須是短語而不是句子，最多 4 欄；',
    '4. 定性分析、原因、風險、評價、步驟說明、單一物件說明不要用表格：用短段落、加粗小標題或項目符號；',
    '5. 如果表格裡需要寫長解釋、每列結構不一致、或只有一個物件，改成小標題 + 清單；寧可不用表格，也不要為了排版硬造表格；',
    '6. 關鍵結論、風險、待驗證的重點用引用區塊（可用 > [!NOTE] / > [!WARNING]）標出；',
    '7. 不要重複使用者的問題，直接從答案開始；',
    '8. 如果使用者引用了片段，只解釋或回答該片段，不要擴展到整段原文；',
    '9. 篇幅克制：先給結論，再按需展開，不要寫客套話；',
    '10. 使用繁體中文（台灣用語）回答。',
  ].join('\n'),
  compaction: [
    '你在為一條思考路徑寫「前情提要」。',
    '把使用者提供的問題與回答壓縮成一段背景說明，供後續提問使用。',
    '只保留：已經確認的結論、關鍵事實與資料、仍然懸而未決的問題。',
    '不要複述過程，不要評價，不要提問。',
    '輸出不超過 300 字，純文字段落，使用繁體中文。',
  ].join('\n'),
  compactionUpdate: [
    '你在更新一條思考路徑的「前情提要」。',
    '輸入包括已有的前情提要和此後新增的問題與回答。',
    '把新增內容合併進已有提要，保留仍然有效的結論、關鍵事實與資料、懸而未決的問題。',
    '不要重複已有結論，不要複述過程，不要評價，不要提問。',
    '輸出不超過 300 字，純文字段落，使用繁體中文。',
  ].join('\n'),
  compactionTask: '請把以上對話壓縮成前情提要。',
  compactionUpdateTask: '請把前情提要和新增對話合併成新的前情提要。',
  summaryLabel: '前情提要：',
  existingSummaryLabel: '已有前情提要：',
  quoteWithSource: (source, text) => `引用自「${source}」中的一段：\n> ${text}`,
  quoteOnly: (text) => `引用：\n> ${text}`,
}

const EN_US: PromptSet = {
  system: [
    'You generate answers inside a knowledge tree.',
    'Rules:',
    '1. The first line must be `# Title`, at most 14 characters or a few words summarising the conclusion; leave a blank line before the body;',
    '2. Output GFM Markdown only. No HTML, and never wrap the whole answer in a code block;',
    '3. Use a table only when the same attributes apply to the same group of objects and the reader needs to compare rows. Cells must be short phrases, not sentences; at most 4 columns;',
    '4. Do not use tables for qualitative analysis, causes, risks, evaluations, step-by-step instructions, or a single object. Use short paragraphs, bold lead-ins, or bullet lists;',
    '5. If a table would need long explanations, mixed row shapes, or has only one object, rewrite it as headings + lists. Prefer no table over a table built for layout;',
    '6. Mark key conclusions, risks, and open questions with blockquotes (optionally > [!NOTE] / > [!WARNING]);',
    '7. Do not repeat the question; start with the answer;',
    '8. If the user quotes an excerpt, answer only that excerpt; do not expand to the whole source;',
    '9. Stay concise: conclusion first, then detail. No pleasantries;',
    '10. Answer in English.',
  ].join('\n'),
  compaction: [
    'You are writing a recap for a line of reasoning.',
    'Summarise the questions and answers the user provides into one paragraph of background for later questions.',
    'Keep only confirmed conclusions, key facts and figures, and unresolved questions.',
    'Do not retell the process, judge, or ask questions.',
    'Output at most 300 words of plain text in English.',
  ].join('\n'),
  compactionUpdate: [
    'You are updating the recap for a line of reasoning.',
    'The input contains the existing recap and the new questions and answers added since then.',
    'Merge the new material into the existing recap and keep conclusions, key facts and figures, and unresolved questions that still apply.',
    'Do not repeat existing conclusions, retell the process, judge, or ask questions.',
    'Output at most 300 words of plain text in English.',
  ].join('\n'),
  compactionTask: 'Compress the conversation above into a recap.',
  compactionUpdateTask:
    'Merge the existing recap and the new turns into an updated recap.',
  summaryLabel: 'Context so far:',
  existingSummaryLabel: 'Existing context:',
  quoteWithSource: (source, text) => `Quoted from "${source}":\n> ${text}`,
  quoteOnly: (text) => `Quote:\n> ${text}`,
}

function promptSet(language: AppLanguage): PromptSet {
  if (language === 'zh-TW') return ZH_TW
  if (language === 'en-US') return EN_US
  return ZH_CN
}

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
 * the history would leave a bare "explain this paragraph" with no referent, and
 * the model would (correctly) complain that it is ambiguous.
 */
function questionWithQuote(
  node: SuperBoardTreeNode,
  prompts: PromptSet,
): string {
  const text = node.quote?.text.trim()
  if (!text) return node.question
  const source = node.quote?.title?.trim()
  const quoted = source
    ? prompts.quoteWithSource(source, text)
    : prompts.quoteOnly(text)
  return `${quoted}\n\n${node.question}`
}

/** Messages used to summarise everything above a card. */
export function buildCompactionMessages(
  data: SuperBoardTreeData,
  nodeId: string,
  language: AppLanguage = 'zh-CN',
): AIChatMessage[] {
  const prompts = promptSet(language)
  const path = treePath(data, nodeId)
  if (!path.length) return []
  const messages: AIChatMessage[] = [
    { role: 'system', content: prompts.compaction },
  ]
  for (const node of path) {
    if (node.question.trim()) {
      messages.push({
        role: 'user',
        content: questionWithQuote(node, prompts),
      })
    }
    if (node.answer.trim()) {
      messages.push({ role: 'assistant', content: node.answer })
    }
  }
  messages.push({ role: 'user', content: prompts.compactionTask })
  return messages
}

/** The nearest summary card above a node, regardless of which ancestor it hangs from. */
export function nearestSummaryNode(
  data: SuperBoardTreeData,
  nodeId: string,
  includeFailed = false,
): SuperBoardTreeNode | null {
  const path = treePath(data, nodeId)
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const parentId = path[index].id
    const summary = data.nodes.find(
      (item) =>
        item.parentId === parentId &&
        item.role === 'summary' &&
        (includeFailed ||
          (item.status === 'done' && item.answer.trim())),
    )
    if (summary) return summary
  }
  return null
}

/** Messages used to fold the turns added since a summary into that summary. */
export function buildCompactionUpdateMessages(
  data: SuperBoardTreeData,
  summaryId: string,
  upToNodeId: string,
  language: AppLanguage = 'zh-CN',
): AIChatMessage[] {
  const prompts = promptSet(language)
  const summary = data.nodes.find((item) => item.id === summaryId)
  if (!summary || summary.role !== 'summary' || !summary.parentId) return []
  const path = treePath(data, upToNodeId)
  const covered = path.findIndex((item) => item.id === summary.parentId)
  if (covered < 0) return []
  const messages: AIChatMessage[] = [
    { role: 'system', content: prompts.compactionUpdate },
    {
      role: 'user',
      content: `${prompts.existingSummaryLabel}\n${summary.answer.trim()}`,
    },
  ]
  for (const node of path.slice(covered + 1)) {
    if (node.role === 'summary') continue
    if (node.question.trim()) {
      messages.push({
        role: 'user',
        content: questionWithQuote(node, prompts),
      })
    }
    if (node.answer.trim()) {
      messages.push({ role: 'assistant', content: node.answer })
    }
  }
  messages.push({ role: 'user', content: prompts.compactionUpdateTask })
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
  language: AppLanguage = 'zh-CN',
): AIChatMessage[] {
  const prompts = promptSet(language)
  const path = treePath(data, nodeId)
  if (!path.length) return []
  const current = path[path.length - 1]
  if (!current.question.trim()) return []

  let startIndex = 0
  let summary = ''
  const nearest = nearestSummaryNode(data, nodeId)
  if (nearest?.parentId) {
    const covered = path.findIndex((item) => item.id === nearest.parentId)
    if (covered >= 0) {
      summary = nearest.answer.trim()
      startIndex = covered + 1
    }
  }

  const messages: AIChatMessage[] = [
    { role: 'system', content: prompts.system },
  ]
  if (summary) {
    messages.push({
      role: 'user',
      content: `${prompts.summaryLabel}\n${summary}`,
    })
  }
  for (const node of path.slice(startIndex)) {
    if (node.role === 'summary') continue
    if (node.question.trim()) {
      messages.push({
        role: 'user',
        content: questionWithQuote(node, prompts),
      })
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
