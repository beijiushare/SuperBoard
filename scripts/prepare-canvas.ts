import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseCanvas, serializeCanvas } from '../web/src/canvas/model'

const sourceDir = path.resolve(
  argValue(
    '--data',
    process.env.SUPERBOARD_DATA ||
      process.env.WHITEBOARDS_DIR ||
      'info/public',
  ),
)
const outputDir = path.resolve(
  argValue(
    '--out',
    process.env.SUPERBOARD_CANVAS_CACHE ||
      'node_modules/.cache/superboard/canvas',
  ),
)

function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

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
