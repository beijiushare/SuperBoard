import {
  DefaultContextMenu,
  DefaultContextMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  TldrawUiMenuSubmenu,
  useEditor,
  useValue,
  type TLUiContextMenuProps,
} from 'tldraw'
import {
  SB_MEDIA_TYPE,
  SUPERBOARD_MEDIA_EVENT,
  type SbMediaCrop,
  type SbMediaShape,
} from '../../shared/shapes/types'

interface SuperboardContextMenuProps extends TLUiContextMenuProps {
  onAddMarkdown: () => void
  onAddPele: () => void
}

export function SuperboardContextMenu({
  onAddMarkdown,
  onAddPele,
  ...props
}: SuperboardContextMenuProps) {
  const editor = useEditor()
  const selectedShapes = useValue(
    'superboard context menu selection',
    () => editor.getSelectedShapes(),
    [editor],
  )
  const mediaShape = useValue(
    'superboard selected media',
    () => {
      const selected = editor.getSelectedShapes()
      return selected.length === 1 && selected[0].type === SB_MEDIA_TYPE
        ? (selected[0] as SbMediaShape)
        : null
    },
    [editor],
  )
  const hideConversions =
    selectedShapes.length === 0 || (mediaShape !== null && mediaShape.props.kind !== 'image')

  function setCrop(crop: SbMediaCrop) {
    if (!mediaShape) return
    editor.updateShape<SbMediaShape>({
      id: mediaShape.id,
      type: SB_MEDIA_TYPE,
      props: { ...mediaShape.props, crop },
    })
  }

  return (
    <DefaultContextMenu {...props}>
      {mediaShape ? (
        <TldrawUiMenuGroup id="superboard-media-edit">
          <TldrawUiMenuItem
            id="superboard-edit-media"
            label="编辑媒体链接"
            onSelect={() => {
              window.dispatchEvent(
                new CustomEvent(SUPERBOARD_MEDIA_EVENT, { detail: { shapeId: mediaShape.id } }),
              )
            }}
          />
        </TldrawUiMenuGroup>
      ) : null}
      {mediaShape ? (
        <TldrawUiMenuGroup id="superboard-media-crop">
          <TldrawUiMenuSubmenu id="superboard-crop" label="裁剪">
            <TldrawUiMenuItem
              id="superboard-crop-rect"
              label="按矩形裁剪"
              isSelected={mediaShape.props.crop === 'rect'}
              onSelect={() => setCrop('rect')}
            />
            <TldrawUiMenuItem
              id="superboard-crop-rounded"
              label="按圆角矩形裁剪"
              isSelected={mediaShape.props.crop === 'rounded'}
              onSelect={() => setCrop('rounded')}
            />
            <TldrawUiMenuItem
              id="superboard-crop-circle"
              label="按圆形裁剪"
              isSelected={mediaShape.props.crop === 'circle'}
              onSelect={() => setCrop('circle')}
            />
          </TldrawUiMenuSubmenu>
        </TldrawUiMenuGroup>
      ) : null}
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
      <div className={hideConversions ? 'sb-context-menu-filter' : undefined}>
        <DefaultContextMenuContent />
      </div>
    </DefaultContextMenu>
  )
}
