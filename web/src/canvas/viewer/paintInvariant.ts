const GRAPHIC_SELECTOR = 'path, rect, ellipse, line, polygon, circle, text'

/**
 * The viewer root sets `fill` and `stroke`, which SVG inherits. A graphic that
 * forgets one of them silently picks up the dark default and grows an outline,
 * so every element we draw must state both. This guard is development only.
 */
export function warnUnpaintedGraphics(root: SVGSVGElement) {
  if (!import.meta.env.DEV) return
  const missing: Element[] = []
  for (const element of root.querySelectorAll(GRAPHIC_SELECTOR)) {
    if (!element.hasAttribute('fill') || !element.hasAttribute('stroke')) {
      missing.push(element)
    }
  }
  if (missing.length > 0) {
    console.warn(
      `[SuperBoard] ${missing.length} SVG element(s) rely on inherited fill/stroke`,
      missing,
    )
  }
}
