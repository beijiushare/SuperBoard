import { renderAsync } from 'pele/lazy'
import { fitNaturalSize } from '../fitSize'
import { stripDiagramTitle } from './stripTitle'

/** Width the diagram is told it has in narrow mode. Pele then draws itself
 *  narrower (e.g. a left-to-right flowchart turns top-down) instead of
 *  shrinking its text. */
export const PELE_NARROW_MAX_WIDTH = 420

/** Camera box a new block is fitted into, keeping the diagram's natural ratio. */
const PELE_FIT_BOX = { width: 760, height: 640 } as const

export interface PeleSize {
  width: number
  height: number
}

export function peleRenderOptions(narrow: boolean) {
  return narrow ? { maxWidth: PELE_NARROW_MAX_WIDTH, autoDirection: true } : {}
}

export async function measurePele(
  code: string,
  narrow = false,
): Promise<PeleSize | null> {
  if (!code.trim()) return null
  try {
    const result = await renderAsync(stripDiagramTitle(code), peleRenderOptions(narrow))
    if (!(result.width > 0) || !(result.height > 0)) return null
    return { width: result.width, height: result.height }
  } catch {
    return null
  }
}

/** Shrink into the fit box without changing the natural ratio. */
export function fitPeleSize(natural: PeleSize): PeleSize {
  return fitNaturalSize(natural, PELE_FIT_BOX)
}

/** Size for a newly created Pele block, or null if the diagram fails to render. */
export async function peleBlockSize(
  code: string,
  narrow = false,
): Promise<PeleSize | null> {
  const natural = await measurePele(code, narrow)
  return natural ? fitPeleSize(natural) : null
}

/** New block size when switching layouts: keep the block's area, adopt the
 *  layout's natural ratio, so it neither explodes in height nor shrinks away. */
export async function peleSizeForLayout(
  code: string,
  narrow: boolean,
  current: PeleSize,
): Promise<PeleSize | null> {
  const natural = await measurePele(code, narrow)
  if (!natural) return null
  const ratio = natural.width / natural.height
  const area = Math.max(1, current.width * current.height)
  const height = Math.sqrt(area / ratio)
  return {
    width: Math.max(1, Math.round(height * ratio)),
    height: Math.max(1, Math.round(height)),
  }
}
