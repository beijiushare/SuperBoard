import type { SuperBoardTreeNode } from '../../canvas/model'

/**
 * Measured card heights survive a reload so the first layout pass already has
 * the right geometry instead of collapsing every card to the default height and
 * re-flowing once Markdown finishes rendering.
 */
const heightCache = new Map<string, number>()

export function nodeHeightSignature(node: SuperBoardTreeNode) {
  return [
    node.id,
    node.answer.length,
    node.question.length,
    node.quote?.text.length ?? 0,
    node.title.length,
    node.bodyCollapsed ? 1 : 0,
    node.quoteCollapsed ? 1 : 0,
    node.questionCollapsed ? 1 : 0,
  ].join('|')
}

export function cachedCardHeight(signature: string) {
  return heightCache.get(signature)
}

export function rememberCardHeight(signature: string, height: number) {
  if (!signature || height <= 0) return
  heightCache.set(signature, height)
}
