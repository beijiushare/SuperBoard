import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

await rm(resolve('node_modules/.vite'), { recursive: true, force: true })
