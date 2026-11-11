import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BoardFile } from '../web/src/shared/board/types'
import { convertTldrawBoard } from '../web/src/canvas/migrate/fromTldraw'
import { validateCanvas } from '../web/src/canvas/model'

async function readBoard(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8')) as BoardFile
}

const drawingBoard = await readBoard(path.join('whiteboards', 'public', 'asddd.tldr.json'))
const drawingCanvas = convertTldrawBoard(drawingBoard)
validateCanvas(drawingCanvas)
const drawing = drawingCanvas.nodes.find((node) => node['x-superboard']?.kind === 'drawing')
assert.ok(drawing)
assert.ok((drawing['x-superboard']?.strokes?.length ?? 0) > 0)
assert.ok((drawing['x-superboard']?.strokes?.[0]?.points.length ?? 0) > 1)

const blocksBoard = await readBoard(
  path.join('whiteboards', 'public', 'notes1', 'aasddd.tldr.json'),
)
const blocksCanvas = convertTldrawBoard(blocksBoard)
validateCanvas(blocksCanvas)
const kinds = new Set(blocksCanvas.nodes.map((node) => node['x-superboard']?.kind))
assert.ok(kinds.has('markdown'))
assert.ok(kinds.has('pele'))
assert.ok(kinds.has('media'))
assert.ok(blocksCanvas.nodes.some((node) => node.type === 'link' && node.url))
assert.ok((blocksCanvas['x-superboard']?.director?.frames.length ?? 0) > 0)

console.log('tldraw migration tests passed')
process.exit(0)
