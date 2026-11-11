import { StylePanelSection, TldrawUiSlider, useEditor, useValue } from 'tldraw'
import { SB_MEDIA_TYPE, type SbMediaProps, type SbMediaShape } from '../../shared/shapes/types'

function CropSlider({
  label,
  value,
  max = 100,
  onChange,
  onHistoryMark,
}: {
  label: string
  value: number
  max?: number
  onChange: (value: number) => void
  onHistoryMark: (id: string) => void
}) {
  const rounded = Math.round(value)
  return (
    <div className="sb-block-opacity">
      <TldrawUiSlider
        value={rounded}
        label={`${rounded}%`}
        title={label}
        min={0}
        steps={max}
        onHistoryMark={onHistoryMark}
        onValueChange={onChange}
      />
    </div>
  )
}

export function MediaCropPanel() {
  const editor = useEditor()
  const shape = useValue(
    'superboard media crop selection',
    () => {
      const selected = editor.getSelectedShapes()
      return selected.length === 1 && selected[0].type === SB_MEDIA_TYPE
        ? (selected[0] as SbMediaShape)
        : null
    },
    [editor],
  )

  if (!shape) return null

  const { crop } = shape.props

  function update(patch: Partial<SbMediaProps>) {
    editor.updateShape<SbMediaShape>({
      id: shape!.id,
      type: SB_MEDIA_TYPE,
      props: { ...shape!.props, ...patch },
    })
  }

  function mark() {
    editor.markHistoryStoppingPoint('media crop')
  }

  return (
    <StylePanelSection>
      {crop === 'circle' ? (
        <>
          <CropSlider label="圆心 X" value={shape.props.cropCx} onChange={(cropCx) => update({ cropCx })} onHistoryMark={mark} />
          <CropSlider label="圆心 Y" value={shape.props.cropCy} onChange={(cropCy) => update({ cropCy })} onHistoryMark={mark} />
          <CropSlider label="半径" value={shape.props.cropRadius} onChange={(cropRadius) => update({ cropRadius })} onHistoryMark={mark} />
        </>
      ) : (
        <>
          <CropSlider label="起点 X" value={shape.props.cropX} onChange={(cropX) => update({ cropX })} onHistoryMark={mark} />
          <CropSlider label="起点 Y" value={shape.props.cropY} onChange={(cropY) => update({ cropY })} onHistoryMark={mark} />
          <CropSlider label="宽度" value={shape.props.cropW} onChange={(cropW) => update({ cropW })} onHistoryMark={mark} />
          <CropSlider label="高度" value={shape.props.cropH} onChange={(cropH) => update({ cropH })} onHistoryMark={mark} />
          {crop === 'rounded' ? (
            <CropSlider
              label="圆角"
              value={shape.props.cropCorner}
              max={50}
              onChange={(cropCorner) => update({ cropCorner })}
              onHistoryMark={mark}
            />
          ) : null}
        </>
      )}
    </StylePanelSection>
  )
}
