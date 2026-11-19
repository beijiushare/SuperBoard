export const DEFAULT_TEXT_FONT = 'PingFang SC, Microsoft YaHei, sans-serif'
export const TEXT_PADDING_X = 6
export const TEXT_PADDING_Y = 4
export const TEXT_LINE_HEIGHT = 1.35
export const TEXT_MIN_HEIGHT = 36

let measureContext: CanvasRenderingContext2D | null | undefined

function getMeasureContext() {
  if (measureContext !== undefined) return measureContext
  if (typeof document === 'undefined') {
    measureContext = null
    return measureContext
  }
  const canvas = document.createElement('canvas')
  measureContext = canvas.getContext('2d')
  return measureContext
}

function heuristicHeight(text: string, width: number, fontSize: number) {
  const charsPerLine = Math.max(
    1,
    Math.floor((width - TEXT_PADDING_X * 2) / (fontSize * 0.62)),
  )
  const lines = text
    .split('\n')
    .reduce(
      (sum, line) =>
        sum + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)),
      0,
    )
  return Math.max(
    TEXT_MIN_HEIGHT,
    Math.round(lines * fontSize * TEXT_LINE_HEIGHT + TEXT_PADDING_Y * 2),
  )
}

export function textBlockHeight(
  text: string,
  width: number,
  fontSize = 16,
  fontFamily = DEFAULT_TEXT_FONT,
) {
  const ctx = getMeasureContext()
  if (!ctx) return heuristicHeight(text, width, fontSize)
  ctx.font = `${fontSize}px ${fontFamily}`
  const maxWidth = Math.max(1, width - TEXT_PADDING_X * 2)
  let lines = 0
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines += 1
      continue
    }
    let current = ''
    let paragraphLines = 0
    for (const char of Array.from(paragraph)) {
      const candidate = current + char
      if (current && ctx.measureText(candidate).width > maxWidth) {
        paragraphLines += 1
        current = char
      } else {
        current = candidate
      }
    }
    paragraphLines += 1
    lines += paragraphLines
  }
  return Math.max(
    TEXT_MIN_HEIGHT,
    Math.ceil(lines * fontSize * TEXT_LINE_HEIGHT + TEXT_PADDING_Y * 2),
  )
}
