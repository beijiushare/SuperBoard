/**
 * Overlays rendered above the canvas. Gestures that belong to the canvas
 * (marquee, pan, context menu, click-to-clear) must ignore pointer events that
 * start inside one: the editor's dialogs are plain divs, so a click on a
 * heading used to start a marquee and select whatever sat behind the dialog.
 */
export const MODAL_OVERLAY_SELECTOR =
  '.sb-modal-backdrop, .canvas-editor-dialog-backdrop'
