import { writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const index = process.argv.indexOf('--out')
const out = path.resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : 'dist')
const cname = (process.env.SUPERBOARD_CNAME ?? '').trim()

if (cname) {
  writeFileSync(path.join(out, 'CNAME'), `${cname}\n`)
  console.log(`[cname] ${cname}`)
}
