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

console.log('canvas editor tests passed')
