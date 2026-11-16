import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const file = path.join(process.cwd(), 'public', 'pele-gallery', 'level1.svg')
const ids = [
  'YzQ=',
  'Q3luZWZpbl/moYbmnrblm74=',
  'Z2l05Zu+',
  'd29sZGxleQ==',
  'eHk=',
  '6aW85Zu+',
  'ZzI1Mg==',
  'ZzI1NA==',
  'ZzI1Mw==',
  'ZzI1NQ==',
  'ZzI1Nw==',
  'ZzI1OA==',
  'ZzI1OQ==',
  'ZzI2MA==',
  'ZzI2MQ==',
  'ZzI2Mg==',
  'ZzI2NA==',
  'ZzI2NQ==',
  'ZzI2Ng==',
  'ZzI2Nw==',
  'ZzI2OA==',
  'ZzI2OQ==',
  'ZzI3MA==',
  'ZzI3MQ==',
  'ZzI3Mg==',
  'ZzI3Mw==',
  'ZzI3NA==',
  'ZzI3NQ==',
  'ZzI3Ng==',
  'ZzI3Nw==',
  'ZzI3OA==',
  'ZzI3OQ==',
].map((value) => Buffer.from(value, 'base64').toString('utf8'))
const types = [
  'c4',
  'cynefin',
  'git',
  'wardley',
  'xychart',
  'pie',
  'gantt',
  'treemap',
  'architecture',
  'kanban',
  'radar',
  'class',
  'flowchart',
  'sankey',
  'ishikawa',
  'timeline',
  'er',
  'eventmodeling',
  'treeview',
  'packet',
  'mindmap',
  'railroad',
  'venn',
  'quadrant',
  'requirement',
  'swimlane',
  'journey',
  'usecase',
  'agentflow',
  'state',
  'block',
  'sequence',
]

let source = await readFile(file, 'utf8')
for (let index = 0; index < ids.length; index++) {
  const needle = `id="${ids[index]}"`
  if (!source.includes(needle)) {
    throw new Error(`找不到一级图组: ${ids[index]}`)
  }
  source = source.replace(
    needle,
    `${needle} data-sb-key="pele:type:${types[index]}"`,
  )
}

await writeFile(file, source, 'utf8')
console.log(`SuperBoard: 已标记 ${ids.length} 个一级图组`)
