import assert from 'node:assert/strict'
import {
  CanvasValidationError,
  TREE_BLOCK_PADDING,
  TREE_CARD_WIDTH,
  TREE_COLUMN_GAP,
  TREE_ROW_GAP,
  addTreeChild,
  layoutTree,
  parseCanvas,
  removeTreeNode,
  serializeCanvas,
  treeBlockSize,
  treeDescendantIds,
  treeNodeById,
  treeOutline,
  treePath,
  updateTreeNode,
  validateCanvas,
  visibleTreeNodes,
  type CanvasDocument,
  type SuperBoardTreeData,
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
  /duplicateId/,
)
assert.throws(
  () =>
    validateCanvas({
      nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1, text: '' }],
      edges: [{ id: 'e', fromNode: 'a', toNode: 'missing' }],
    }),
  /missingNodeRef/,
)

const migrated = parseCanvas(
  JSON.stringify({
    nodes: [
      {
        id: 'legacy-file',
        type: 'link',
        url: 'public/assets/files/a.png',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        'x-superboard': {
          kind: 'media',
          media: {
            kind: 'file',
            url: 'public/assets/files/a.png',
            file: 'public/assets/files/a.png',
            name: 'a.png',
          },
        },
      },
    ],
    edges: [],
    'x-superboard': { version: 1, meta: { title: 'Legacy', slug: 'legacy' } },
  }),
)
assert.equal(migrated.nodes[0].type, 'file')
assert.equal((migrated.nodes[0] as { file: string }).file, 'public/assets/files/a.png')
assert.equal('url' in migrated.nodes[0], false)

// --- knowledge tree -------------------------------------------------------

const at = '2026-01-01T00:00:00.000Z'
const tree: SuperBoardTreeData = {
  version: 1,
  rootId: 'r',
  nodes: [
    { id: 'r', parentId: null, title: 'root', question: 'q', answer: 'a', status: 'done', createdAt: at },
    { id: 'a', parentId: 'r', title: 'a', question: 'q', answer: 'a', status: 'done', createdAt: at },
    { id: 'a1', parentId: 'a', title: 'a1', question: 'q', answer: 'a', status: 'done', createdAt: at },
    { id: 'b', parentId: 'r', title: 'b', question: 'q', answer: 'a', status: 'done', createdAt: at },
  ],
}

assert.deepEqual(treePath(tree, 'a1').map((node) => node.id), ['r', 'a', 'a1'])
assert.deepEqual(treePath(tree, 'b').map((node) => node.id), ['r', 'b'])
assert.deepEqual(treePath(tree, 'missing'), [])
assert.deepEqual([...treeDescendantIds(tree, 'a')], ['a1'])

const layout = layoutTree(tree, { r: 100, a: 100, a1: 100, b: 100 })
assert.deepEqual(layout.positions.r, { x: 0, y: 62 })
assert.deepEqual(layout.positions.a, { x: TREE_CARD_WIDTH + TREE_COLUMN_GAP, y: 0 })
assert.deepEqual(layout.positions.a1, {
  x: (TREE_CARD_WIDTH + TREE_COLUMN_GAP) * 2,
  y: 0,
})
assert.deepEqual(layout.positions.b, {
  x: TREE_CARD_WIDTH + TREE_COLUMN_GAP,
  y: 100 + TREE_ROW_GAP,
})
assert.equal(layout.width, (TREE_CARD_WIDTH + TREE_COLUMN_GAP) * 2 + TREE_CARD_WIDTH)
assert.equal(layout.height, 224)
assert.deepEqual(treeBlockSize(layout), {
  width: layout.width + TREE_BLOCK_PADDING * 2,
  height: layout.height + TREE_BLOCK_PADDING * 2,
})

// A collapsed branch hides descendants and shrinks the layout.
const collapsed = updateTreeNode(tree, 'a', { branchCollapsed: true })
assert.deepEqual(visibleTreeNodes(collapsed).map((node) => node.id), ['r', 'a', 'b'])
assert.equal(layoutTree(collapsed, { r: 100, a: 100, b: 100 }).height, 224)
assert.deepEqual(
  [...treeDescendantIds(tree, 'r')],
  ['a', 'b', 'a1'],
)

// Promoting keeps the grandchildren, deleting a branch drops them.
const promoted = removeTreeNode(tree, 'a', 'promote')
assert.deepEqual(promoted.nodes.map((node) => node.id), ['r', 'a1', 'b'])
assert.equal(treeNodeById(promoted, 'a1')?.parentId, 'r')
const pruned = removeTreeNode(tree, 'a', 'branch')
assert.deepEqual(pruned.nodes.map((node) => node.id), ['r', 'b'])
assert.equal(removeTreeNode(tree, 'r', 'branch').nodes.length, 4)

const child = addTreeChild(tree, 'b', { title: 'new' })
assert.ok(child.node)
assert.equal(child.node?.parentId, 'b')
assert.equal(child.data.nodes.at(-1)?.id, child.node?.id)
assert.equal(
  addTreeChild(updateTreeNode(tree, 'b', { branchCollapsed: true }), 'b').data.nodes
    .find((node) => node.id === 'b')?.branchCollapsed,
  false,
)

assert.equal(treeOutline(tree), [
  '- root',
  '  - a',
  '    - a1',
  '  - b',
].join('\n'))

// Tree data survives a document round trip untouched.
const withTree = parseCanvas(
  serializeCanvas({
    nodes: [
      {
        id: 'tree-1',
        type: 'text',
        x: 0,
        y: 0,
        width: 420,
        height: 320,
        text: '',
        'x-superboard': { kind: 'tree', tree },
      },
    ],
    edges: [],
  }),
)
assert.equal(withTree.nodes[0]['x-superboard']?.tree?.rootId, 'r')
assert.equal(withTree.nodes[0]['x-superboard']?.tree?.nodes.length, 4)

console.log('canvas model tests passed')
