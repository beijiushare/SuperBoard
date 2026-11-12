import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BoardFile } from '../web/src/shared/board/types'
import { convertTldrawBoard } from '../web/src/canvas/migrate/fromTldraw'
import { parseCanvas, serializeCanvas } from '../web/src/canvas/model'

const sourceDir = path.resolve(process.argv[2] ?? 'whiteboards/public')
const outputDir = path.resolve(process.argv[3] ?? '.preview/canvas')

async function walk(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(fullPath)))
    else if (entry.name.endsWith('.tldr.json') || entry.name.endsWith('.canvas')) {
      files.push(fullPath)
    }
  }
  return files
}

await fs.rm(outputDir, { recursive: true, force: true })
const files = await walk(sourceDir)

for (const file of files) {
  const canvas = file.endsWith('.canvas')
    ? parseCanvas(await fs.readFile(file, 'utf8'))
    : convertTldrawBoard(JSON.parse(await fs.readFile(file, 'utf8')) as BoardFile)

  const relative = path
    .relative(sourceDir, file)
    .replace(/\.tldr\.json$/, '.canvas')
    .replace(/\.canvas$/, '.canvas')
  const target = path.join(outputDir, relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, serializeCanvas(canvas), 'utf8')
  console.log(`${path.relative(process.cwd(), file)} -> ${path.relative(process.cwd(), target)}`)
}

process.exit(0)
