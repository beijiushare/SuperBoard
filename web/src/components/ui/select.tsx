import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  title?: string
  hint?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

interface MenuPosition {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

function ChevronIcon() {
  return (
    <svg
      className="sb-select-chevron"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M4 6.25 8 10l4-3.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="sb-select-check"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="m3.5 8.5 3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function firstEnabled(options: readonly SelectOption[], start = 0) {
  for (let index = start; index < options.length; index += 1) {
    if (!options[index].disabled) return index
  }
  return -1
}

export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className = '',
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  const openMenu = () => {
    if (disabled || options.length === 0) return
    const selectedIndex = options.findIndex((option) => option.value === value)
    setActive(
      selectedIndex >= 0 && !options[selectedIndex].disabled
        ? selectedIndex
        : Math.max(0, firstEnabled(options)),
    )
    setOpen(true)
  }

  const close = (focusTrigger = false) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  const choose = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    close(true)
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 168)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    if (below < 160 && above > below) {
      setPosition({
        left,
        width,
        bottom: window.innerHeight - rect.top + 6,
        maxHeight: Math.min(300, above),
      })
    } else {
      setPosition({
        left,
        width,
        top: rect.bottom + 6,
        maxHeight: Math.min(300, below),
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
        return
      }
      if (event.key === 'Tab') {
        setOpen(false)
        return
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const start = event.key === 'Home' ? 0 : options.length - 1
        const step = event.key === 'Home' ? 1 : -1
        for (
          let index = start;
          index >= 0 && index < options.length;
          index += step
        ) {
          if (!options[index].disabled) {
            setActive(index)
            break
          }
        }
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        let index = active
        for (let tries = 0; tries < options.length; tries += 1) {
          index = (index + step + options.length) % options.length
          if (!options[index].disabled) {
            setActive(index)
            break
          }
        }
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const option = options[active]
        if (option) choose(option)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, open, options])

  useEffect(() => {
    if (!open) return
    const item = menuRef.current?.children[active] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault()
      openMenu()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`sb-select-trigger${selected ? '' : ' is-placeholder'}${className ? ` ${className}` : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="sb-select-value">
          {selected?.label ?? placeholder}
        </span>
        <ChevronIcon />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="sb-select-content"
              role="listbox"
              aria-label={ariaLabel}
              style={{
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
              }}
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`sb-select-item${index === active ? ' is-active' : ''}${
                    option.value === value ? ' is-selected' : ''
                  }`}
                  disabled={option.disabled}
                  title={option.title ?? option.label}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span className="sb-select-item-label">{option.label}</span>
                  {option.hint ? (
                    <small className="sb-select-item-hint">{option.hint}</small>
                  ) : null}
                  {option.value === value ? <CheckIcon /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
