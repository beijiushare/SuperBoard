import { cpSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const source = path.join(root, 'node_modules', 'vditor', 'dist')
const target = path.join(root, 'public', '__vditor', 'dist')

rmSync(path.join(root, 'public', '__vditor'), { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true })
console.log(`SuperBoard: 已复制 Vditor 资源到 ${target}`)
