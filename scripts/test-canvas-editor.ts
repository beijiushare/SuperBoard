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
import type { CanvasDocument, CanvasEdge, CanvasNode } from '../web/src/canvas/model'
import {
  intersectsViewport,
  nodeWorldRect,
  viewportWorldRect,
} from '../web/src/canvas/viewer/culling'

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

console.log('canvas editor tests passed')
