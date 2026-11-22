/** Rough first-pass height for a markdown block, in pixels. The block is a
 *  normal resizable block afterwards: content never changes the height. */
const LINE_HEIGHT = 24
const BLOCK_PADDING = 28
const MIN_HEIGHT = 180
const MAX_HEIGHT = 900

const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/

/** Width of a line in em, treating CJK characters as full width. */
function emWidth(text: string) {
  let width = 0
  for (const char of text) width += CJK.test(char) ? 1 : 0.55
  return width
}

export function estimateMarkdownHeight(
  source: string,
  width: number,
  fontSize = 15,
): number {
  const usable = Math.max(80, width - 32)
  const emsPerLine = Math.max(8, usable / fontSize)
  let lines = 0
  let inFence = false

  for (const raw of source.split('\n')) {
    const line = raw.trimEnd()
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      lines += 0.6
      continue
    }
    if (!line.trim()) {
      lines += 0.5
      continue
    }
    const body = line
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
    const wrapped = Math.max(1, Math.ceil(emWidth(body) / emsPerLine))
    if (inFence) lines += wrapped * 1.05
    else if (/^\s*#{1,6}\s/.test(line)) lines += wrapped * 1.7
    else if (/^\s*\|.*\|\s*$/.test(line)) lines += wrapped * 1.4
    else if (/^\s*[-*+]\s+|^\s*\d+[.)]\s+/.test(line)) lines += wrapped * 1.4
    else if (/^\s*>\s?/.test(line)) lines += wrapped * 1.2
    else lines += wrapped
  }

  return Math.round(
    Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, lines * LINE_HEIGHT + BLOCK_PADDING)),
  )
}
