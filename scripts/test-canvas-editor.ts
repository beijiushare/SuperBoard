import assert from 'node:assert/strict'
import { buildCanvasHtml, buildCanvasSvg } from '../web/src/canvas/editor/export'
import { edgeGeometry, edgePath, distanceToEdge } from '../web/src/canvas/editor/edges'
import {
  collectBlocks,
  collectDescendants,
  isInsideGroup,
  isLocked,
  nodeMapOf,
  selectableAncestor,
  topAncestor,
} from '../web/src/canvas/editor/hierarchy'
import {
  resolveNodeStyle,
  textBlockHeight,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
} from '../web/src/canvas/model'
import {
  intersectsViewport,
  nodeWorldRect,
  viewportWorldRect,
} from '../web/src/canvas/viewer/culling'
import { createDrawingNode } from '../web/src/canvas/editor/freehand'
import {
  arrowSides,
  closestSide,
  screenRect as toolScreenRect,
  strokeHit,
} from '../web/src/canvas/editor/toolGeometry'
import {
  intersects,
  screenStyle,
} from '../web/src/canvas/editor/overlayGeometry'
import {
  createArrowEdge,
  createShapeNode,
} from '../web/src/canvas/editor/toolCreate'
import {
  applyGeometry,
  applyTextStyle,
  withCommonStyle,
  withStyle,
} from '../web/src/canvas/editor/styleMutations'
import {
  applyErasure,
  planErasure,
} from '../web/src/canvas/editor/eraser'
import { DEFAULT_PREFERENCES } from '../web/src/canvas/editor/preferences'

const nodes: CanvasNode[] = [
  {
    id: 'g',
    type: 'group',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    'x-superboard': { kind: 'group' },
  },
  {
    id: 'a',
    type: 'group',
    x: 10,
    y: 10,
    width: 40,
    height: 40,
    'x-superboard': { kind: 'group', groupId: 'g' },
  },
  {
    id: 'b',
    type: 'group',
    x: 60,
    y: 10,
    width: 30,
    height: 30,
    'x-superboard': { kind: 'group', groupId: 'g', locked: true },
  },
  {
    id: 'c',
    type: 'group',
    x: 20,
    y: 20,
    width: 10,
    height: 10,
    'x-superboard': { kind: 'group', groupId: 'a' },
  },
]

const map = nodeMapOf(nodes)
assert.equal(topAncestor(map.get('c')!, map).id, 'g')
assert.equal(selectableAncestor(map.get('c')!, map).id, 'g')
assert.equal(selectableAncestor(map.get('c')!, map, 'g').id, 'a')
assert.equal(selectableAncestor(map.get('a')!, map, 'g').id, 'a')
assert.equal(selectableAncestor(map.get('c')!, map, 'a').id, 'c')
assert.equal(isInsideGroup(map.get('b')!, 'g', map), true)
assert.equal(isInsideGroup(map.get('b')!, 'a', map), false)
assert.equal(isLocked(map.get('b')!, map), true)
assert.equal(isLocked(map.get('c')!, map), false)
assert.deepEqual(
  collectDescendants(map.get('g')!, nodes).map((node) => node.id).sort(),
  ['a', 'b', 'c'],
)
const blocks = collectBlocks(nodes)
assert.equal(blocks.length, 1)
assert.equal(blocks[0].root.id, 'g')
assert.deepEqual(
  blocks[0].nodes.map((node) => node.id).sort(),
  ['a', 'b', 'c', 'g'],
)

const edgeNodes: CanvasNode[] = [
  {
    id: 'from',
    type: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    text: 'A',
    'x-superboard': { kind: 'text' },
  },
  {
    id: 'to',
    type: 'text',
    x: 300,
    y: 120,
    width: 100,
    height: 60,
    text: 'B',
    'x-superboard': { kind: 'text' },
  },
]
const edge: CanvasEdge = {
  id: 'edge',
  fromNode: 'from',
  fromSide: 'right',
  toNode: 'to',
  toSide: 'left',
  fromEnd: 'arrow',
  toEnd: 'arrow',
  label: '连接',
}
const edgeMap = nodeMapOf(edgeNodes)
const geometry = edgeGeometry(edge, edgeMap)
assert.ok(geometry)
assert.deepEqual(geometry.start, { x: 100, y: 30 })
assert.deepEqual(geometry.end, { x: 300, y: 150 })
assert.ok(geometry.controlA.x > geometry.start.x)
assert.ok(geometry.controlB.x < geometry.end.x)
assert.ok(edgePath(edge, edgeMap)?.includes('C'))
assert.ok(distanceToEdge(edge, edgeMap, 100, 30) < 0.01)
assert.ok(distanceToEdge(edge, edgeMap, 0, 300) > 40)

const canvas: CanvasDocument = {
  nodes: edgeNodes,
  edges: [edge],
  'x-superboard': { version: 1, meta: { title: '测试', slug: 'test' } },
}
const svg = buildCanvasSvg(canvas)
assert.ok(svg.startsWith('<svg'))
assert.ok(svg.endsWith('</svg>'))
assert.ok(svg.includes('<path'))
assert.ok(svg.includes('连接'))
assert.ok(svg.match(/<polygon/g)?.length === 2)
const html = buildCanvasHtml(canvas)
assert.ok(html.startsWith('<!doctype html>'))
assert.ok(html.endsWith('</html>'))
assert.ok(html.includes('<svg'))

const viewport = viewportWorldRect({
  container: { clientWidth: 800, clientHeight: 600 } as HTMLElement,
  offsetX: -100,
  offsetY: -50,
  scale: 1,
})
assert.deepEqual(viewport, {
  left: 20,
  top: -30,
  right: 980,
  bottom: 730,
})
const visible = nodeWorldRect({ x: 100, y: 100, width: 100, height: 50 })
const hidden = nodeWorldRect({ x: 2000, y: 2000, width: 100, height: 50 })
const rotated = nodeWorldRect({ x: 100, y: 100, width: 100, height: 50 }, 90)
assert.equal(intersectsViewport(visible, viewport), true)
assert.equal(intersectsViewport(hidden, viewport), false)
assert.deepEqual(rotated, {
  left: 125,
  top: 75,
  right: 175,
  bottom: 175,
})

const legacyStyle = resolveNodeStyle({
  fill: '#abc',
  stroke: '#def',
  borderWidth: '3',
  strokeDash: [2, 4],
})
assert.equal(legacyStyle.background, '#abc')
assert.equal(legacyStyle.borderColor, '#def')
assert.equal(legacyStyle.borderWidth, 3)
assert.deepEqual(legacyStyle.borderDash, [2, 4])

const semanticStyle = resolveNodeStyle({
  backgroundColor: '#123',
  borderColor: '#456',
  borderWidth: 0,
  borderStyle: 'dashed',
})
assert.equal(semanticStyle.background, '#123')
assert.equal(semanticStyle.borderColor, '#456')
assert.equal(semanticStyle.borderWidth, 0)
assert.deepEqual(semanticStyle.borderDash, [7, 4])

const solidStyle = resolveNodeStyle({ borderStyle: 'solid', strokeDash: [] })
assert.equal(solidStyle.borderDash, undefined)

const styledCanvas: CanvasDocument = {
  nodes: [
    {
      id: 'shape',
      type: 'group',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      'x-superboard': {
        kind: 'shape',
        shape: 'rect',
        style: {
          backgroundColor: '#112233',
          borderColor: '#445566',
          borderWidth: 4,
          borderStyle: 'dashed',
        },
      },
    },
  ],
  edges: [],
  'x-superboard': { version: 1, meta: { title: '样式', slug: 'style' } },
}
const styledSvg = buildCanvasSvg(styledCanvas)
assert.ok(styledSvg.includes('fill="#112233"'))
assert.ok(styledSvg.includes('stroke="#445566"'))
assert.ok(styledSvg.includes('stroke-width="4"'))
assert.ok(styledSvg.includes('stroke-dasharray="7 4"'))

const brush = {
  size: 4,
  color: '#123456',
  opacity: 0.5,
  thinning: 0.4,
  smoothing: 0.6,
  streamline: 0.7,
  simulatePressure: false,
  start: 2,
  end: 3,
}
const drawing = createDrawingNode({
  id: 'draw-1',
  points: [
    [0, 0, 0.5],
    [10, 10, 0.8],
  ],
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  brush,
})
assert.equal(drawing.x, -3)
assert.equal(drawing.y, -3)
assert.equal(drawing.width, 16)
assert.equal(drawing.height, 16)
assert.equal(drawing['x-superboard']?.kind, 'drawing')
assert.equal(drawing['x-superboard']?.style?.borderWidth, 4)
assert.equal(drawing['x-superboard']?.style?.borderColor, '#123456')
assert.equal(drawing['x-superboard']?.style?.opacity, 0.5)
assert.deepEqual(drawing['x-superboard']?.strokes?.[0]?.points?.[0], [3, 3, 0.5])
const stroke = {
  id: 's1',
  color: '#000',
  size: 4,
  points: [
    [0, 0],
    [10, 0],
  ] as unknown as Array<[number, number]>,
}
const hitNode: CanvasNode = {
  id: 'hit',
  type: 'group',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  'x-superboard': { kind: 'drawing', strokes: [stroke] },
}
assert.equal(strokeHit(stroke, hitNode, 5, 3, 2), true)
assert.equal(strokeHit(stroke, hitNode, 5, 10, 2), false)
assert.equal(closestSide(hitNode, 9, 5), 'right')
assert.deepEqual(
  arrowSides(
    { id: 'l', type: 'group', x: 0, y: 0, width: 10, height: 10 },
    { id: 'r', type: 'group', x: 100, y: 20, width: 10, height: 10 },
  ),
  { fromSide: 'right', toSide: 'left' },
)
assert.deepEqual(toolScreenRect({ offsetX: 10, offsetY: 20, scale: 2 }, 5, 5, 15, 15), {
  left: 20,
  top: 30,
  width: 20,
  height: 20,
})
assert.equal(
  intersects(
    { left: 0, top: 0, width: 10, height: 10 },
    { left: 5, top: 5, width: 10, height: 10 },
  ),
  true,
)
assert.equal(
  intersects(
    { left: 0, top: 0, width: 10, height: 10 },
    { left: 20, top: 20, width: 10, height: 10 },
  ),
  false,
)
const rotatedStyle = screenStyle(
  {
    id: 'r',
    type: 'group',
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    'x-superboard': { kind: 'shape', rotation: 45 },
  },
  0,
  0,
  1,
)
assert.equal(rotatedStyle.transform, 'rotate(45deg)')
assert.equal(rotatedStyle.transformOrigin, 'center center')

const rounded = createShapeNode({
  id: 'shape-1',
  shape: 'rounded-rect',
  startX: 10,
  startY: 20,
  currentX: 50,
  currentY: 60,
})
assert.equal(rounded.x, 10)
assert.equal(rounded.y, 20)
assert.equal(rounded.width, 40)
assert.equal(rounded.height, 40)
assert.equal(rounded['x-superboard']?.kind, 'shape')
assert.equal(rounded['x-superboard']?.shape, 'rect')
assert.equal(rounded['x-superboard']?.roundedRect, true)
assert.equal(rounded['x-superboard']?.style?.cornerRadius, 8)
const line = createShapeNode({
  id: 'shape-2',
  shape: 'line',
  startX: 100,
  startY: 50,
  currentX: 0,
  currentY: 10,
})
assert.equal(line.width, 100)
assert.equal(line.height, 40)
assert.equal(line['x-superboard']?.style?.backgroundColor, 'transparent')
assert.deepEqual(line['x-superboard']?.lineFlip, { x: true, y: true })
const arrowNode = createArrowEdge({
  id: 'edge-1',
  from: { id: 'l', type: 'group', x: 0, y: 0, width: 10, height: 10 },
  to: { id: 'r', type: 'group', x: 100, y: 20, width: 10, height: 10 },
  currentX: 109,
  currentY: 25,
})
assert.equal(arrowNode.fromNode, 'l')
assert.equal(arrowNode.toNode, 'r')
assert.equal(arrowNode.fromSide, 'right')
assert.equal(arrowNode.toSide, 'right')
assert.equal(arrowNode.fromEnd, 'none')
assert.equal(arrowNode.toEnd, 'arrow')

const styledBase: CanvasNode = {
  id: 'styled',
  type: 'text',
  x: 0,
  y: 0,
  width: 200,
  height: 40,
  text: 'hello',
  'x-superboard': {
    kind: 'text',
    style: { strokeDash: [2, 4], fill: '#eee' },
  },
}
const styledText = withStyle(styledBase, { borderColor: '#123456' })
assert.equal(styledText['x-superboard']?.style?.borderColor, '#123456')
assert.equal(styledText['x-superboard']?.style?.fill, '#eee')
assert.equal(styledBase['x-superboard']?.style?.borderColor, undefined)
const commonStyled = withCommonStyle(styledBase, { borderStyle: 'dashed' })
assert.equal(commonStyled['x-superboard']?.style?.strokeDash, undefined)
assert.equal(commonStyled['x-superboard']?.style?.borderStyle, 'dashed')

const opacityDefault = withCommonStyle(
  {
    ...styledBase,
    'x-superboard': { kind: 'text', style: {} },
  },
  { borderOpacity: 0.4, backgroundOpacity: 0.5 },
)
assert.equal(
  opacityDefault['x-superboard']?.style?.borderColor,
  DEFAULT_PREFERENCES.block.borderColor,
)
assert.equal(
  opacityDefault['x-superboard']?.style?.backgroundColor,
  DEFAULT_PREFERENCES.block.backgroundColor,
)
assert.equal(opacityDefault['x-superboard']?.style?.borderOpacity, 0.4)
assert.equal(opacityDefault['x-superboard']?.style?.backgroundOpacity, 0.5)

const opacityExplicit = withCommonStyle(styledBase, {
  borderOpacity: 0.6,
  backgroundOpacity: 0.7,
})
assert.equal(opacityExplicit['x-superboard']?.style?.fill, '#eee')
assert.equal(
  opacityExplicit['x-superboard']?.style?.backgroundColor,
  undefined,
)

const groupOpacity = withCommonStyle(
  {
    id: 'group-opacity',
    type: 'group',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    'x-superboard': { kind: 'group', style: {} },
  },
  { borderOpacity: 0.3, backgroundOpacity: 0.4 },
)
assert.equal(groupOpacity['x-superboard']?.style?.borderColor, undefined)
assert.equal(groupOpacity['x-superboard']?.style?.backgroundColor, undefined)
assert.equal(groupOpacity['x-superboard']?.style?.borderOpacity, 0.3)
assert.equal(groupOpacity['x-superboard']?.style?.backgroundOpacity, 0.4)

const exportSvg = buildCanvasSvg({
  nodes: [
    {
      id: 'shape-export',
      type: 'group',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      'x-superboard': {
        kind: 'shape',
        shape: 'rect',
        style: {
          backgroundColor: '#ffd166',
          backgroundOpacity: 0.35,
          borderColor: '#1d1d1d',
          borderOpacity: 1,
          borderWidth: 6,
        },
      },
    },
  ],
  edges: [],
  'x-superboard': { version: 1, meta: { title: 'export', slug: 'export' } },
})
assert.equal((exportSvg.match(/<rect/g) ?? []).length, 3)
assert.match(exportSvg, /fill-opacity="0.35"/)
assert.match(exportSvg, /stroke-opacity="1"/)

const blockSvg = buildCanvasSvg({
  nodes: [
    {
      id: 'markdown-export',
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: '# hello',
      'x-superboard': {
        kind: 'markdown',
        style: {
          backgroundColor: '#ff0000',
          backgroundOpacity: 0.5,
          borderColor: '#0000ff',
          borderOpacity: 1,
          borderWidth: 3,
        },
      },
    },
    {
      id: 'plain-export',
      type: 'text',
      x: 240,
      y: 0,
      width: 120,
      height: 40,
      text: 'plain',
      'x-superboard': { kind: 'text', style: {} },
    },
  ],
  edges: [],
  'x-superboard': { version: 1, meta: { title: 'export', slug: 'export' } },
})
assert.equal((blockSvg.match(/<rect/g) ?? []).length, 2)
assert.match(blockSvg, /fill="#ff0000"/)
assert.match(blockSvg, /fill-opacity="0.5"/)
assert.match(blockSvg, /stroke="#0000ff"/)
assert.match(blockSvg, /stroke-width="3"/)
const geometryStyled = applyGeometry(styledBase, { width: 120, rotation: 30 })
assert.equal(geometryStyled.width, 120)
assert.equal(geometryStyled.height, 40)
assert.equal(geometryStyled['x-superboard']?.rotation, 30)
const resizeNone = applyGeometry(styledBase, {})
assert.equal(resizeNone.width, 200)
const textSized = applyTextStyle(styledBase, { fontSize: 28 })
assert.equal(textSized['x-superboard']?.style?.fontSize, 28)
assert.notEqual(textSized.height, styledBase.height)
assert.ok(textSized.height > 0)
const kindFallback = withStyle(
  { id: 'raw', type: 'link', url: '#', x: 0, y: 0, width: 10, height: 10 },
  { borderColor: '#000' },
)
assert.equal(kindFallback['x-superboard']?.kind, 'media')

const eraseStroke = (id: string, y: number) => ({
  id,
  color: '#000',
  size: 4,
  points: [
    [0, y],
    [10, y],
  ] as unknown as Array<[number, number]>,
})
const eraseNode: CanvasNode = {
  id: 'erase',
  type: 'group',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  'x-superboard': {
    kind: 'drawing',
    strokes: [eraseStroke('s1', 0), eraseStroke('s2', 10)],
  },
}
const eraseTarget: CanvasNode = {
  id: 'target',
  type: 'group',
  x: 100,
  y: 0,
  width: 10,
  height: 10,
  'x-superboard': { kind: 'shape', shape: 'rect' },
}
const eraseEdge: CanvasEdge = {
  id: 'erase-edge',
  fromNode: 'erase',
  toNode: 'target',
  fromSide: 'right',
  toSide: 'left',
}
const eraseCanvas: CanvasDocument = {
  nodes: [eraseNode, eraseTarget],
  edges: [eraseEdge],
  'x-superboard': { version: 1, meta: { title: '擦除', slug: 'erase' } },
}
const eraseNodeMap = nodeMapOf(eraseCanvas.nodes)
const firstPlan = planErasure([eraseNode], [], 5, 1, 1)
assert.equal(firstPlan.removals.length, 1)
assert.deepEqual([...firstPlan.removals[0].hit], ['s1'])
applyErasure({
  canvas: eraseCanvas,
  nodeMap: Object.fromEntries(
    [...eraseNodeMap].map(([id, node]) => [id, { ref: node }]),
  ),
  edgeMap: { [eraseEdge.id]: { ref: eraseEdge } },
  plan: firstPlan,
})
assert.equal(eraseNode['x-superboard']?.strokes?.length, 1)
assert.equal(eraseNode['x-superboard']?.strokes?.[0].id, 's2')
const secondPlan = planErasure(eraseCanvas.nodes, eraseCanvas.edges, 5, 10, 1)
assert.equal(secondPlan.removals.length, 1)
assert.equal(secondPlan.edgeIds.has('erase-edge'), true)
const nodeMapAfter = Object.fromEntries(
  [...nodeMapOf(eraseCanvas.nodes)].map(([id, node]) => [id, { ref: node }]),
)
applyErasure({
  canvas: eraseCanvas,
  nodeMap: nodeMapAfter,
  edgeMap: { [eraseEdge.id]: { ref: eraseEdge } },
  plan: secondPlan,
})
assert.equal(eraseCanvas.nodes.some((node) => node.id === 'erase'), false)
assert.equal(eraseCanvas.edges.length, 0)
assert.equal('erase' in nodeMapAfter, false)
const lockedErase = planErasure(
  [
    {
      ...eraseNode,
      'x-superboard': {
        ...eraseNode['x-superboard'],
        locked: true,
      },
    },
  ],
  [],
  5,
  1,
  1,
)
assert.equal(lockedErase.removals.length, 0)

const shortTextHeight = textBlockHeight('一行文字', 200, 16)
const multiLineHeight = textBlockHeight('第一行\n第二行\n第三行', 200, 16)
assert.ok(multiLineHeight > shortTextHeight)
const narrowHeight = textBlockHeight('hello world hello', 40, 16)
const wideHeight = textBlockHeight('hello world hello', 200, 16)
assert.ok(narrowHeight > wideHeight)

console.log('canvas editor tests passed')
