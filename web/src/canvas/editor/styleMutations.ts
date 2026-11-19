import {
  textBlockHeight,
  type CanvasNode,
  type SuperBoardStyle,
} from '../model'

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
  const next = withStyle(node, patch)
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
  return {
    ...next,
    height: textBlockHeight(node.text, node.width, patch.fontSize),
  }
}
