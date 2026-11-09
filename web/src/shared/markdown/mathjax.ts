export interface MathMarkup {
  html: string
  width: number
  height: number
}

type MathJaxLike = {
  asciimath2svg: (input: string, options?: { display?: boolean }) => HTMLElement
  startup: {
    promise: Promise<unknown>
    typeset?: boolean
    adaptor: { outerHTML: (node: HTMLElement) => string }
  }
}

declare global {
  interface Window {
    MathJax?: Partial<MathJaxLike> & Record<string, unknown>
  }
}

const MATHJAX_URL = `${import.meta.env.BASE_URL}mathjax/startup.js`
const cache = new Map<string, Promise<MathMarkup>>()

let loader: Promise<MathJaxLike> | null = null

function configure() {
  if (window.MathJax?.startup?.promise) return

  window.MathJax = {
    loader: {
      load: ['input/asciimath', 'output/svg'],
      paths: {
        fonts: `${import.meta.env.BASE_URL}mathjax/fonts`,
      },
    },
    startup: {
      typeset: false,
    },
    svg: {
      fontCache: 'none',
    },
  } as unknown as Window['MathJax']
}

export function loadMathJax(): Promise<MathJaxLike> {
  if (loader) return loader

  configure()

  loader = new Promise((resolve, reject) => {
    const existing = window.MathJax as MathJaxLike | undefined
    if (existing?.startup?.promise) {
      existing.startup.promise.then(() => resolve(existing)).catch(reject)
      return
    }

    const script = document.createElement('script')
    script.src = MATHJAX_URL
    script.async = true
    script.onload = () => {
      const mathJax = window.MathJax as MathJaxLike | undefined
      if (!mathJax?.startup?.promise) {
        reject(new Error('MathJax 已加载，但 startup.promise 不存在'))
        return
      }
      mathJax.startup.promise.then(() => resolve(mathJax)).catch(reject)
    }
    script.onerror = () => reject(new Error('MathJax 加载失败'))
    document.head.appendChild(script)
  })

  loader.catch(() => {
    loader = null
  })

  return loader
}

export function renderAsciiMath(expression: string, display = false): Promise<MathMarkup> {
  const key = `${display ? 'block' : 'inline'}:${expression}`
  const cached = cache.get(key)
  if (cached) return cached

  const promise = loadMathJax()
    .then((mathJax) => {
      const node = mathJax.asciimath2svg(expression, { display })
      const host = document.createElement('div')
      host.setAttribute('aria-hidden', 'true')
      host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;'
      document.body.appendChild(host)
      host.appendChild(node)
      const rect = host.getBoundingClientRect()
      const html = node.outerHTML || mathJax.startup.adaptor.outerHTML(node)
      host.remove()
      return {
        html,
        width: Math.max(1, Math.ceil(rect.width)),
        height: Math.max(1, Math.ceil(rect.height)),
      }
    })
    .catch((error) => {
      cache.delete(key)
      throw error
    })

  cache.set(key, promise)
  return promise
}

export function getCachedAsciiMath(expression: string, display = false) {
  const key = `${display ? 'block' : 'inline'}:${expression}`
  return cache.get(key)
}
