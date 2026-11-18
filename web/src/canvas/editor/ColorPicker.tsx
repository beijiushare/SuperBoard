import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ColorPaletteIcon } from './ColorPaletteIcon'
import { EyedropperIcon } from './EyedropperIcon'

const THEME_COLORS = [
  '#000000', '#ffffff', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47',
  '#f2f2f2', '#808080', '#d0cece', '#d6dce4', '#d9e2f3', '#fbe5d6', '#ededed', '#fff2cc', '#deebf7', '#e2f0d9',
  '#d9d9d9', '#595959', '#afabab', '#adb9ca', '#b4c6e7', '#f8cbad', '#dbdbdb', '#ffe699', '#bdd7ee', '#c5e0b3',
  '#bfbfbf', '#404040', '#757171', '#8496b0', '#8ea9db', '#f4b183', '#c9c9c9', '#ffd966', '#9dc3e6', '#a9d18e',
  '#a6a6a6', '#262626', '#3a3838', '#323f4f', '#305496', '#c55a11', '#7f7f7f', '#bf9000', '#2e75b6', '#548235',
]

const STANDARD_COLORS = [
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050',
  '#00b0f0', '#0070c0', '#002060', '#7030a0', '#5b9bd5', '#70ad47',
]

interface ColorPickerProps {
  label?: string
  value: string
  allowNone?: boolean
  recentColors?: string[]
  onChange: (value: string) => void
  onColorUsed?: (value: string) => void
}

export function ColorPicker({
  label = '颜色(C)',
  value,
  allowNone = false,
  recentColors = [],
  onChange,
  onColorUsed,
}: ColorPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const current = value || '#000000'
  const recentSlots = Array.from({ length: 5 }, (_, index) => recentColors[index])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.sb-color-popover, .sb-color-trigger')) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])

  const openPicker = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 292)),
      top: Math.min(rect.bottom + 6, window.innerHeight - 430),
    })
    setOpen((currentOpen) => !currentOpen)
  }

  const choose = (color: string) => {
    onChange(color)
    onColorUsed?.(color)
  }

  const EyeDropper = (
    window as unknown as {
      EyeDropper?: new () => {
        open: () => Promise<{ sRGBHex: string }>
      }
    }
  ).EyeDropper

  return (
    <>
      <div className="sb-color-control">
        <span className="sb-color-control-label">{label}</span>
        <div className="sb-color-presets">
          {recentSlots.map((color, index) =>
            color ? (
              <button
                key={`${color}-${index}`}
                type="button"
                className={`sb-color-cell${
                  current.toLowerCase() === color.toLowerCase() ? ' is-active' : ''
                }`}
                style={{ background: color }}
                title={color}
                onClick={() => choose(color)}
              />
            ) : (
              <span key={`empty-${index}`} className="sb-color-cell is-empty" />
            ),
          )}
          <button
            ref={triggerRef}
            type="button"
            className="sb-color-trigger"
            onClick={openPicker}
            title="更多颜色"
          >
            <span
              className={`sb-color-swatch${current === 'transparent' ? ' is-none' : ''}`}
              style={{ background: current === 'transparent' ? undefined : current }}
            />
            <span className="sb-color-chevron" />
          </button>
        </div>
      </div>
      {open
        ? createPortal(
            <div
              className="sb-color-popover"
              style={{ left: position.left, top: position.top }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="sb-color-section-title">主题颜色</div>
              <div className="sb-color-grid">
                {THEME_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`sb-color-cell${
                      current.toLowerCase() === color ? ' is-active' : ''
                    }`}
                    style={{ background: color }}
                    title={color}
                    onClick={() => choose(color)}
                  />
                ))}
              </div>
              <div className="sb-color-section-title">标准色</div>
              <div className="sb-color-grid sb-color-grid-standard">
                {STANDARD_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`sb-color-cell${
                      current.toLowerCase() === color ? ' is-active' : ''
                    }`}
                    style={{ background: color }}
                    title={color}
                    onClick={() => choose(color)}
                  />
                ))}
              </div>
              <label className="sb-color-more">
                <input
                  type="color"
                  value={current === 'transparent' ? '#000000' : current}
                  onChange={(event) => choose(event.target.value)}
                />
                <ColorPaletteIcon />
                其他颜色
              </label>
              {allowNone ? (
                <button
                  type="button"
                  className="sb-color-more"
                  onClick={() => choose('transparent')}
                >
                  无颜色
                </button>
              ) : null}
              {EyeDropper ? (
                <button
                  type="button"
                  className="sb-color-more"
                  onClick={async () => {
                    try {
                      const result = await new EyeDropper().open()
                      choose(result.sRGBHex)
                    } catch {
                      return
                    }
                  }}
                >
                  <EyedropperIcon />
                  取色器
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
