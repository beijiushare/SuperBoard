import {
  DefaultContextMenu,
  DefaultContextMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  type TLUiContextMenuProps,
} from 'tldraw'

interface SuperboardContextMenuProps extends TLUiContextMenuProps {
  onAddMarkdown: () => void
  onAddPele: () => void
}

export function SuperboardContextMenu({
  onAddMarkdown,
  onAddPele,
  ...props
}: SuperboardContextMenuProps) {
  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
      <TldrawUiMenuGroup id="superboard-blocks">
        <TldrawUiMenuItem
          id="superboard-add-markdown"
          label="添加 Markdown 块"
          onSelect={onAddMarkdown}
        />
        <TldrawUiMenuItem
          id="superboard-add-pele"
          label="添加图表块"
          onSelect={onAddPele}
        />
      </TldrawUiMenuGroup>
    </DefaultContextMenu>
  )
}
