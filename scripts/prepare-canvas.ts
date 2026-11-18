import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseCanvas, serializeCanvas } from '../web/src/canvas/model'

const sourceDir = path.resolve(
  process.argv[2] ?? process.env.WHITEBOARDS_DIR ?? 'whiteboards/public',
)
const outputDir = path.resolve(
  process.argv[3] ?? 'node_modules/.cache/superboard/canvas',
)

async function walk(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(fullPath)))
    else if (entry.name.endsWith('.canvas')) files.push(fullPath)
  }
  return files
}

await fs.rm(outputDir, { recursive: true, force: true })
const files = await walk(sourceDir)

for (const file of files) {
  const canvas = parseCanvas(await fs.readFile(file, 'utf8'))
  const target = path.join(outputDir, path.relative(sourceDir, file))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, serializeCanvas(canvas), 'utf8')
  console.log(`${path.relative(process.cwd(), file)} -> ${path.relative(process.cwd(), target)}`)
}

process.exit(0)
