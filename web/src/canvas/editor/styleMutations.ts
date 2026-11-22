import {
  textBlockHeight,
  type CanvasNode,
  type SuperBoardStyle,
} from '../model'
import { DEFAULT_PREFERENCES } from './preferences'

function fallbackKind(node: CanvasNode) {
  return node.type === 'text' ? 'text' : node.type === 'group' ? 'group' : 'media'
}

export function withStyle(
  node: CanvasNode,
  patch: Partial<SuperBoardStyle>,
): CanvasNode {
  const extension = node['x-superboard']
  return {
    ...node,
    'x-superboard': {
      ...(extension ?? { kind: fallbackKind(node) }),
      style: { ...extension?.style, ...patch },
    },
  }
}

export function withCommonStyle(
  node: CanvasNode,
  patch: Partial<SuperBoardStyle>,
): CanvasNode {
  const current = node['x-superboard']?.style
  const isGroup = node['x-superboard']?.kind === 'group'
  const nextPatch: Partial<SuperBoardStyle> = { ...patch }
  // Opacity only takes effect when the color is stored on the node. When the
  // user adjusts opacity for a default-colored block, persist that default
  // color too so the change is visible and survives a reload. Groups fall back
  // to the JSON Canvas palette instead, so they must keep their color unset.
  if (
    !isGroup &&
    patch.backgroundOpacity !== undefined &&
    !current?.backgroundColor &&
    !current?.fill
  ) {
    nextPatch.backgroundColor = DEFAULT_PREFERENCES.block.backgroundColor
  }
  if (
    !isGroup &&
    patch.borderOpacity !== undefined &&
    !current?.borderColor &&
    !current?.stroke
  ) {
    nextPatch.borderColor = DEFAULT_PREFERENCES.block.borderColor
  }
  const next = withStyle(node, nextPatch)
  if (patch.borderStyle === undefined) return next
  const extension = next['x-superboard']
  if (!extension?.style) return next
  const style = { ...extension.style }
  delete style.strokeDash
  return { ...next, 'x-superboard': { ...extension, style } }
}

export function applyGeometry(
  node: CanvasNode,
  patch: { width?: number; height?: number; rotation?: number },
): CanvasNode {
  const extension = node['x-superboard'] ?? { kind: fallbackKind(node) }
  return {
    ...node,
    width: patch.width ?? node.width,
    height: patch.height ?? node.height,
    'x-superboard': {
      ...extension,
      rotation: patch.rotation ?? extension.rotation,
    },
  }
}

export function applyTextStyle(
  node: CanvasNode,
  patch: Partial<SuperBoardStyle>,
): CanvasNode {
  const next = withStyle(node, patch)
  if (node.type !== 'text' || !patch.fontSize) return next
  const fontFamily =
    patch.fontFamily ?? next['x-superboard']?.style?.fontFamily
  return {
    ...next,
    height: textBlockHeight(node.text, node.width, patch.fontSize, fontFamily),
  }
}
