export function stripDiagramTitle(source: string) {
  const withoutFrontmatterTitle = source.replace(
    /^---\r?\n([\s\S]*?)\r?\n---/,
    (_, frontmatter: string) => {
      const cleaned = frontmatter
        .split(/\r?\n/)
        .filter((line) => !/^\s*title\s*:/i.test(line))
        .join('\n')
      return cleaned.trim() ? `---\n${cleaned}\n---` : ''
    },
  )

  return withoutFrontmatterTitle
    .replace(/^(\s*pie)\s+title\s+.+?(?:\r?\n|$)/gim, '$1')
    .replace(/^\s*accTitle\s*:.*(?:\r?\n|$)/gim, '')
    .replace(/^\s*title\s+.+?(?:\r?\n|$)/gim, '')
}
