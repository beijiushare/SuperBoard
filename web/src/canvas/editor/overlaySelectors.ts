/**
 * Overlays rendered above the canvas. Gestures that belong to the canvas
 * (marquee, pan, context menu, click-to-clear) must ignore pointer events that
 * start inside one: the editor's dialogs are plain divs, so a click on a
 * heading used to start a marquee and select whatever sat behind the dialog.
 */
export const MODAL_OVERLAY_SELECTOR =
  '.sb-modal-backdrop, .canvas-editor-dialog-backdrop'

/**
 * Chrome that belongs to the editor UI rather than the board. Pointer gestures
 * starting here must not move, zoom, marquee or select canvas content.
 */
export const CANVAS_CHROME_SELECTOR =
  `${MODAL_OVERLAY_SELECTOR}, .sb-style-panel, .sb-color-popover, .sb-color-trigger, .canvas-tool-palette, .canvas-tool-flyout, .JCV-controls, .JCV-minimap-container`

export function isCanvasChromeTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(element?.closest(CANVAS_CHROME_SELECTOR))
}
