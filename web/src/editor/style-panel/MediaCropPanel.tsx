import { StylePanelSection, useEditor, useValue } from 'tldraw'
import { SB_MEDIA_TYPE, type SbMediaCrop, type SbMediaProps, type SbMediaShape } from '../../shared/shapes/types'

const CROP_LABELS: Record<SbMediaCrop, string> = {
  rect: '矩形',
  rounded: '圆角矩形',
  circle: '圆形',
}

function CropSlider({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="sb-crop-slider">
      <span className="sb-crop-slider-head">
        <span>{label}</span>
        <b>{Math.round(value)}%</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
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

  return (
    <StylePanelSection>
      <div className="sb-crop-heading">媒体裁剪 · {CROP_LABELS[crop]}</div>
      {crop === 'circle' ? (
        <>
          <CropSlider label="圆心 X" value={shape.props.cropCx} onChange={(cropCx) => update({ cropCx })} />
          <CropSlider label="圆心 Y" value={shape.props.cropCy} onChange={(cropCy) => update({ cropCy })} />
          <CropSlider label="半径" value={shape.props.cropRadius} onChange={(cropRadius) => update({ cropRadius })} />
        </>
      ) : (
        <>
          <CropSlider label="起点 X" value={shape.props.cropX} onChange={(cropX) => update({ cropX })} />
          <CropSlider label="起点 Y" value={shape.props.cropY} onChange={(cropY) => update({ cropY })} />
          <CropSlider label="宽度" value={shape.props.cropW} onChange={(cropW) => update({ cropW })} />
          <CropSlider label="高度" value={shape.props.cropH} onChange={(cropH) => update({ cropH })} />
          {crop === 'rounded' ? (
            <CropSlider
              label="圆角"
              value={shape.props.cropCorner}
              max={50}
              onChange={(cropCorner) => update({ cropCorner })}
            />
          ) : null}
        </>
      )}
    </StylePanelSection>
  )
}
