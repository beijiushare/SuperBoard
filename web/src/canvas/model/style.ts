import type { SuperBoardStyle } from './types'

export interface ResolvedNodeStyle {
  background: string | undefined
  backgroundOpacity: number
  borderColor: string | undefined
  borderOpacity: number
  borderWidth: number | undefined
  borderStyle: string
  borderDash: number[] | undefined
  opacity: number
  cornerRadius: number | undefined
  /** Space between the surface and its content (or a group's children). */
  padding: number
}

export function resolveNodeStyle(style?: SuperBoardStyle): ResolvedNodeStyle {
  const rawWidth = style?.borderWidth ?? style?.strokeWidth
  const width = rawWidth === undefined || rawWidth === '' ? undefined : Number(rawWidth)
  const borderWidth = Number.isFinite(width) ? width : undefined
  let borderDash: number[] | undefined
  if (style?.strokeDash) {
    borderDash = style.strokeDash.length > 0 ? style.strokeDash : undefined
  } else if (style?.borderStyle === 'dashed') {
    borderDash = [7, 4]
  } else if (style?.borderStyle === 'dotted') {
    borderDash = [2, 4]
  }
  return {
    background: style?.backgroundColor ?? style?.fill,
    backgroundOpacity: style?.backgroundOpacity ?? 1,
    borderColor: style?.borderColor ?? style?.stroke,
    borderOpacity: style?.borderOpacity ?? 1,
    borderWidth,
    borderStyle: style?.borderStyle ?? 'solid',
    borderDash,
    opacity: style?.opacity ?? 1,
    cornerRadius: style?.cornerRadius,
    padding: Math.max(0, style?.padding ?? 0),
  }
}
