import type { SuperBoardCanvasSettings } from '../model'
import { DEFAULT_BLOCK_SIZES } from './blocks'

export function defaultBlockSize(
  kind: keyof typeof DEFAULT_BLOCK_SIZES,
  settings?: SuperBoardCanvasSettings,
) {
  const base = DEFAULT_BLOCK_SIZES[kind]
  return {
    width: settings?.defaultBlockWidth ?? base.width,
    height: settings?.defaultBlockHeight ?? base.height,
  }
}

/**
 * Keep a natural ratio, but let an explicit default width/height from the board
 * settings decide one side.
 */
export function sizeWithNaturalRatio(
  natural: { width: number; height: number },
  settings?: SuperBoardCanvasSettings,
) {
  const width = settings?.defaultBlockWidth
  const height = settings?.defaultBlockHeight
  if (width) {
    return {
      width,
      height: Math.max(40, Math.round((width * natural.height) / natural.width)),
    }
  }
  if (height) {
    return {
      width: Math.max(40, Math.round((height * natural.width) / natural.height)),
      height,
    }
  }
  return natural
}
