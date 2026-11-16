interface StyleNumberControlProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  slider?: boolean
  onChange: (value: number) => void
}

export function StyleNumberControl({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  slider = false,
  onChange,
}: StyleNumberControlProps) {
  const commit = (next: number) => {
    if (!Number.isFinite(next)) return
    onChange(Math.max(min, Math.min(max, next)))
  }

  return (
    <div className="sb-style-number-control">
      <span className="sb-style-number-label">{label}</span>
      {slider ? (
        <input
          className="sb-style-number-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => commit(Number(event.target.value))}
        />
      ) : null}
      <label className="sb-style-spin">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Math.round(value * 10) / 10}
          onChange={(event) => commit(Number(event.target.value))}
        />
        {unit ? <span>{unit}</span> : null}
      </label>
    </div>
  )
}
