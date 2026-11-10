import type { CSSProperties } from 'react'
import { getColorValue } from 'tldraw'

export const SB_BLOCK_COLOR_VALUES = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white',
  'paper',
] as const

export type SbBlockColor = (typeof SB_BLOCK_COLOR_VALUES)[number]

export const SB_BLOCK_COLOR_LABELS: Record<SbBlockColor, string> = {
  black: '黑色',
  grey: '灰色',
  'light-violet': '浅紫',
  violet: '紫色',
  blue: '蓝色',
  'light-blue': '浅蓝',
  yellow: '黄色',
  orange: '橙色',
  green: '绿色',
  'light-green': '浅绿',
  'light-red': '浅红',
  red: '红色',
  white: '白色',
  paper: '纸色',
}

export const SB_BLOCK_BORDER_WIDTH_VALUES = ['none', 'thin', 'medium', 'thick'] as const
export type SbBlockBorderWidth = (typeof SB_BLOCK_BORDER_WIDTH_VALUES)[number]

export const SB_BLOCK_BORDER_WIDTH_LABELS: Record<SbBlockBorderWidth, string> = {
  none: '无',
  thin: '细',
  medium: '中',
  thick: '粗',
}

export const SB_BLOCK_BORDER_WIDTH_PX: Record<SbBlockBorderWidth, number> = {
  none: 0,
  thin: 1,
  medium: 2,
  thick: 4,
}

export const SB_BLOCK_BORDER_STYLE_VALUES = ['solid', 'dashed', 'dotted'] as const
export type SbBlockBorderStyle = (typeof SB_BLOCK_BORDER_STYLE_VALUES)[number]

export const SB_BLOCK_BORDER_STYLE_LABELS: Record<SbBlockBorderStyle, string> = {
  solid: '实线',
  dashed: '虚线',
  dotted: '点线',
}

export interface SbBlockStyleValues {
  backgroundColor: SbBlockColor
  backgroundOpacity: number
  borderColor: SbBlockColor
  borderOpacity: number
  borderWidth: SbBlockBorderWidth
  borderStyle: SbBlockBorderStyle
}

type ThemeColors = Parameters<typeof getColorValue>[0]

export function resolveSbBlockColor(colors: ThemeColors, color: SbBlockColor): string {
  if (color === 'paper') return '#fffcf0'
  return getColorValue(colors, color, 'solid')
}

export function getSbBlockStyle(colors: ThemeColors, style: SbBlockStyleValues) {
  const backgroundColor = resolveSbBlockColor(colors, style.backgroundColor)
  const borderColor = resolveSbBlockColor(colors, style.borderColor)
  const backgroundOpacity = Math.min(100, Math.max(0, style.backgroundOpacity))
  const borderOpacity = Math.min(100, Math.max(0, style.borderOpacity))
  const borderWidth = SB_BLOCK_BORDER_WIDTH_PX[style.borderWidth] ?? 1

  return {
    '--sb-block-bg-color': backgroundColor,
    '--sb-block-bg-opacity': `${backgroundOpacity}%`,
    '--sb-block-border-color': borderColor,
    '--sb-block-border-opacity': `${borderOpacity}%`,
    '--sb-block-border-width': `${borderWidth}px`,
    '--sb-block-border-style': style.borderStyle,
    '--sb-card-bg': backgroundColor,
    '--sb-card-border': borderColor,
  } as CSSProperties
}
