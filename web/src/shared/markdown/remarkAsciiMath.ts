import { visit } from 'unist-util-visit'

type MdNode = {
  type: string
  value?: string
  title?: string | null
  url?: string
  children?: MdNode[]
}

type MdParent = {
  children: MdNode[]
}

export function remarkAsciiMath() {
  return (tree: MdParent) => {
    visit(tree as never, (node: MdNode, index, parent) => {
      if (node.type !== 'inlineMath' && node.type !== 'math') return
      if (index === undefined || !parent) return

      const display = node.type === 'math'
      const value = node.value ?? ''
      const link: MdNode = {
        type: 'link',
        url: '#superboard-math',
        title: `sbmath:${display ? 'block' : 'inline'}:${encodeURIComponent(value)}`,
        children: [{ type: 'text', value }],
      }

      const children = (parent as MdParent).children
      children[index] = link
    })
  }
}
