import type { CanvasDocument, CanvasNode } from '../model'
import type { CanvasViewerHandle } from '../viewer/CanvasViewer'
import { MarkdownEditorOverlay } from './MarkdownEditorOverlay'
import { MarkdownFocusDialog } from './MarkdownFocusDialog'

interface CanvasMarkdownLayerProps {
  canvas: CanvasDocument
  viewerRef: React.RefObject<CanvasViewerHandle | null>
  editingId: string | null
  focusId: string | null
  focusNode: CanvasNode | null
  onInput: (id: string, value: string) => void
  onCommit: (id: string, value: string) => void
  onRequestClose: () => void
  onCloseFocus: () => void
}

export function CanvasMarkdownLayer({
  canvas,
  viewerRef,
  editingId,
  focusId,
  focusNode,
  onInput,
  onCommit,
  onRequestClose,
  onCloseFocus,
}: CanvasMarkdownLayerProps) {
  return (
    <>
      {editingId ? (
        <MarkdownEditorOverlay
          canvas={canvas}
          viewerRef={viewerRef}
          nodeId={editingId}
          onInput={onInput}
          onCommit={onCommit}
          onRequestClose={onRequestClose}
        />
      ) : null}
      {focusId && focusNode ? (
        <MarkdownFocusDialog
          nodeId={focusNode.id}
          value={focusNode.type === 'text' ? focusNode.text : ''}
          onInput={(value) => onInput(focusNode.id, value)}
          onCommit={(value) => onCommit(focusNode.id, value)}
          onClose={onCloseFocus}
        />
      ) : null}
    </>
  )
}
