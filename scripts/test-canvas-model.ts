import assert from 'node:assert/strict'
import {
  CanvasValidationError,
  parseCanvas,
  serializeCanvas,
  validateCanvas,
  type CanvasDocument,
} from '../web/src/canvas/model'

const sample: CanvasDocument = {
  nodes: [
    {
      id: 'text-1',
      type: 'text',
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      text: '# Hello\n\n$ a^2 + b^2 = c^2 $',
      'x-superboard': {
        kind: 'markdown',
        style: { borderStyle: 'solid', borderWidth: 'thin' },
      },
    },
    {
      id: 'media-1',
      type: 'link',
      x: 500,
      y: 0,
      width: 640,
      height: 360,
      url: 'https://example.com/embed',
      'x-superboard': {
        kind: 'media',
        media: { kind: 'iframe', url: 'https://example.com/embed' },
      },
    },
    {
      id: 'shape-1',
      type: 'group',
      x: 0,
      y: 300,
      width: 300,
      height: 180,
      'x-superboard': {
        kind: 'shape',
        shape: 'ellipse',
        style: { fill: '#fff', stroke: '#222', strokeWidth: 2 },
      },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      fromNode: 'text-1',
      fromSide: 'right',
      toNode: 'media-1',
      toSide: 'left',
      toEnd: 'arrow',
    },
  ],
  'x-superboard': {
    version: 1,
    meta: {
      title: 'Model test',
      slug: 'model-test',
    },
    director: {
      frames: [{ id: 'frame-1', order: 1, x: 0, y: 0, width: 1280, height: 720 }],
    },
  },
}

const parsed = parseCanvas(serializeCanvas(sample))
assert.equal(parsed.nodes.length, 3)
assert.equal(parsed.edges.length, 1)
assert.equal(parsed['x-superboard']?.meta.slug, 'model-test')
assert.equal(parsed.nodes[0]['x-superboard']?.kind, 'markdown')
assert.equal(parsed.nodes[2]['x-superboard']?.shape, 'ellipse')

assert.throws(() => validateCanvas(null), CanvasValidationError)
assert.throws(
  () =>
    validateCanvas({
      nodes: [
        { id: 'same', type: 'text', x: 0, y: 0, width: 1, height: 1, text: '' },
        { id: 'same', type: 'text', x: 0, y: 0, width: 1, height: 1, text: '' },
      ],
      edges: [],
    }),
  /id 重复/,
)
assert.throws(
  () =>
    validateCanvas({
      nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1, text: '' }],
      edges: [{ id: 'e', fromNode: 'a', toNode: 'missing' }],
    }),
  /fromNode|toNode/,
)

console.log('canvas model tests passed')
