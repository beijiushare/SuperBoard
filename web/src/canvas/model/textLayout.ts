export const TEXT_PADDING_X = 6
export const TEXT_PADDING_Y = 4
export const TEXT_LINE_HEIGHT = 1.35
export const TEXT_MIN_HEIGHT = 36

export function textBlockHeight(
  text: string,
  width: number,
  fontSize = 16,
) {
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
