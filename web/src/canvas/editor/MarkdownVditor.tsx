import { useEffect, useRef } from 'react'
import type Vditor from 'vditor'
import { loadMathJax } from '../../shared/markdown/mathjax'
import { vditorCdn } from '../../shared/markdown/vditorAssets'

interface MarkdownVditorProps {
  value: string
  onInput: (value: string) => void
  onCommit: (value: string) => void
  onRequestClose?: () => void
  className?: string
  autoFocus?: boolean
}

export function MarkdownVditor({
  value,
  onInput,
  onCommit,
  onRequestClose,
  className,
  autoFocus = true,
}: MarkdownVditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<Vditor | null>(null)
  const valueRef = useRef(value)
  const dirtyRef = useRef(false)
  const inputRef = useRef(onInput)
  const commitRef = useRef(onCommit)
  const closeRef = useRef(onRequestClose)

  inputRef.current = onInput
  commitRef.current = onCommit
  closeRef.current = onRequestClose

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    let cancelled = false
    let debounce: number | undefined
    valueRef.current = value
    dirtyRef.current = false
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      event.stopPropagation()
      if (debounce) window.clearTimeout(debounce)
      const currentValue = valueRef.current
      if (dirtyRef.current) {
        dirtyRef.current = false
        commitRef.current(currentValue)
      }
      closeRef.current?.()
    }
    element.addEventListener('keydown', onKeyDown, true)
    void import('vditor').then(async ({ default: VditorClass }) => {
      await import('vditor/dist/index.css')
      try {
        await loadMathJax()
      } catch (error) {
        console.error('[SuperBoard] 加载 MathJax 失败', error)
      }
      if (cancelled || !element) return
      const vditor = new VditorClass(element, {
        cdn: vditorCdn,
        mode: 'ir',
        value,
        height: '100%',
        minHeight: 40,
        toolbar: [],
        counter: { enable: false },
        cache: { enable: false },
        outline: { enable: false, position: 'left' },
        preview: {
          math: { engine: 'MathJax' },
          markdown: {
            inlineMath: true,
            mathBlockPreview: true,
          },
        },
        input: (nextValue) => {
          valueRef.current = nextValue
          dirtyRef.current = true
          if (debounce) window.clearTimeout(debounce)
          debounce = window.setTimeout(() => {
            inputRef.current(nextValue)
          }, 350)
        },
        after: () => {
          if (!autoFocus) return
          window.setTimeout(() => {
            vditorRef.current?.focus()
            const ir = element.querySelector('.vditor-ir') as HTMLElement | null
            if (ir) ir.scrollTop = 0
          }, 0)
        },
      })
      vditorRef.current = vditor
    })
    return () => {
      cancelled = true
      element.removeEventListener('keydown', onKeyDown, true)
      if (debounce) window.clearTimeout(debounce)
      const currentValue = valueRef.current
      const dirty = dirtyRef.current
      const vditor = vditorRef.current
      vditorRef.current = null
      try {
        vditor?.destroy()
      } catch (error) {
        console.error('[SuperBoard] 销毁 Vditor 失败', error)
      }
      if (dirty) {
        window.setTimeout(() => {
          try {
            commitRef.current(currentValue)
          } catch (error) {
            console.error('[SuperBoard] 提交 Markdown 失败', error)
          }
        }, 0)
      }
    }
  }, [])

  return <div ref={containerRef} className={className} style={{ height: '100%' }} />
}
