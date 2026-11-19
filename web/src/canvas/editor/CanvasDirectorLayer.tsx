import type { CanvasDocument, CanvasFrame } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { CanvasDirectorOverlay } from './CanvasDirectorOverlay'
import { DirectorFrameController } from '../../editor/DirectorFrameController'

interface CanvasDirectorLayerProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  directorMode: boolean
  presentation: boolean
  selectedFrameId: string | null
  onSelectFrame: (id: string | null) => void
  onBeforeChange: () => void
  frames: CanvasFrame[]
  onChangeFrames: (frames: CanvasFrame[]) => void
  onPlayFrame: (frame: CanvasFrame) => void
  frameControllerOpen: boolean
  onOpenController: () => void
  onCloseController: () => void
}

export function CanvasDirectorLayer({
  canvas,
  viewerRef,
  directorMode,
  presentation,
  selectedFrameId,
  onSelectFrame,
  onBeforeChange,
  frames,
  onChangeFrames,
  onPlayFrame,
  frameControllerOpen,
  onOpenController,
  onCloseController,
}: CanvasDirectorLayerProps) {
  if (!directorMode || presentation) return null
  return (
    <>
      <CanvasDirectorOverlay
        canvas={canvas}
        viewerRef={viewerRef}
        selectedId={selectedFrameId}
        onSelect={onSelectFrame}
        onBeforeChange={onBeforeChange}
        onChangeFrames={onChangeFrames}
        onPlayFrame={onPlayFrame}
        onOpenController={onOpenController}
      />
      {frameControllerOpen ? (
        <DirectorFrameController
          frames={frames.map((frame) => ({
            id: frame.id,
            order: frame.order,
            name: frame.name,
            x: frame.x,
            y: frame.y,
            w: frame.width,
            h: frame.height,
          }))}
          selectedId={selectedFrameId}
          onSelect={onSelectFrame}
          onChangeFrames={(next) =>
            onChangeFrames(
              next.map((frame) => ({
                id: frame.id,
                order: frame.order,
                name: frame.name,
                x: frame.x,
                y: frame.y,
                width: frame.w,
                height: frame.h,
              })),
            )
          }
          onClose={onCloseController}
        />
      ) : null}
    </>
  )
}
