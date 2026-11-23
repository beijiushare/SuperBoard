export interface Size {
  width: number
  height: number
}

export interface FitBox {
  width: number
  height: number
}

/**
 * Shrink a natural size into the box without changing its ratio. When minimum
 * sides are given the result is scaled up uniformly until both are met, so the
 * ratio still holds.
 */
export function fitNaturalSize(
  natural: Size,
  box: FitBox,
  minimum: Partial<Size> = {},
): Size {
  if (!(natural.width > 0) || !(natural.height > 0)) {
    return { width: 1, height: 1 }
  }
  let scale = Math.min(1, box.width / natural.width, box.height / natural.height)
  const width = natural.width * scale
  const height = natural.height * scale
  const minScale = Math.max(
    1,
    (minimum.width ?? 0) / width,
    (minimum.height ?? 0) / height,
  )
  scale *= minScale
  return {
    width: Math.max(1, Math.round(natural.width * scale)),
    height: Math.max(1, Math.round(natural.height * scale)),
  }
}
