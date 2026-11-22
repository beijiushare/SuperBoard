import { renderAsync } from 'pele/lazy'
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
  const scale = Math.min(
    1,
    PELE_FIT_BOX.width / natural.width,
    PELE_FIT_BOX.height / natural.height,
  )
  return {
    width: Math.max(1, Math.round(natural.width * scale)),
    height: Math.max(1, Math.round(natural.height * scale)),
  }
}

/** Size for a newly created Pele block, or null if the diagram fails to render. */
export async function peleBlockSize(
  code: string,
  narrow = false,
): Promise<PeleSize | null> {
  const natural = await measurePele(code, narrow)
  return natural ? fitPeleSize(natural) : null
}

/** Height that keeps the diagram's natural ratio at the given width. */
export async function peleHeightForWidth(
  code: string,
  narrow: boolean,
  width: number,
): Promise<number | null> {
  const natural = await measurePele(code, narrow)
  if (!natural) return null
  return Math.max(1, Math.round((width * natural.height) / natural.width))
}
