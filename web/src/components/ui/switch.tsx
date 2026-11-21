interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
  title?: string
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  title,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      className="sb-switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}
