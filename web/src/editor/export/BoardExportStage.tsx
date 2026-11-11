import { useCallback } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import type { BoardFile } from '../../shared/board/types'
import { superboardShapeUtils } from '../../shared/shapes/shapeUtils'

interface BoardExportStageProps {
  board: BoardFile
  format: 'svg' | 'png'
  onDone: () => void
  onError: (error: unknown) => void
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function BoardExportStage({ board, format, onDone, onError }: BoardExportStageProps) {
  const handleMount = useCallback(
    (editor: Editor) => {
      void (async () => {
        try {
          editor.loadSnapshot(board.document)
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          const ids = [...editor.getCurrentPageShapeIds()]

          if (format === 'svg') {
            const result = await editor.getSvgString(ids, { background: true, padding: 32 })
            if (!result) throw new Error('无法生成 SVG')
            download(new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' }), `${board.meta.slug}.svg`)
          } else {
            const { blob } = await editor.toImage(ids, {
              format: 'png',
              background: true,
              padding: 32,
              scale: 2,
            })
            download(blob, `${board.meta.slug}.png`)
          }

          onDone()
        } catch (error) {
          onError(error)
        }
      })()
    },
    [board, format, onDone, onError],
  )

  return (
    <div className="sb-export-stage" aria-hidden="true">
      <Tldraw
        key={`${board.meta.slug}:${format}`}
        hideUi
        shapeUtils={superboardShapeUtils}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
        onMount={handleMount}
      />
    </div>
  )
}
