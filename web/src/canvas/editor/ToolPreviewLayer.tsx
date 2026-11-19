import type { CanvasNode } from '../model'
import { closestSide, screenRect } from './toolGeometry'
import type { EditorTool } from './tools'

interface ShapeDraftLike {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ArrowDraftLike {
  fromId: string
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ToolView {
  offsetX: number
  offsetY: number
  scale: number
}

interface ToolPreviewLayerProps {
  tool: EditorTool
  view: ToolView | null
  draft: ShapeDraftLike | null
  arrowDraft: ArrowDraftLike | null
  arrowTarget: CanvasNode | null
}

export function ToolPreviewLayer({
  tool,
  view,
  draft,
  arrowDraft,
  arrowTarget,
}: ToolPreviewLayerProps) {
  const shapePreview =
    draft && view
      ? screenRect(view, draft.startX, draft.startY, draft.currentX, draft.currentY)
      : null
  const arrowPreview =
    arrowDraft && view
      ? {
          startX: view.offsetX + arrowDraft.startX * view.scale,
          startY: view.offsetY + arrowDraft.startY * view.scale,
          endX: view.offsetX + arrowDraft.currentX * view.scale,
          endY: view.offsetY + arrowDraft.currentY * view.scale,
        }
      : null
  const arrowTargetSide =
    arrowDraft && arrowTarget
      ? closestSide(arrowTarget, arrowDraft.currentX, arrowDraft.currentY)
      : null
  const arrowTargetBox =
    arrowTarget && view
      ? {
          left: view.offsetX + arrowTarget.x * view.scale,
          top: view.offsetY + arrowTarget.y * view.scale,
          width: arrowTarget.width * view.scale,
          height: arrowTarget.height * view.scale,
        }
      : null
  const arrowTargetHandles = arrowTargetBox
    ? {
        top: {
          x: arrowTargetBox.left + arrowTargetBox.width / 2,
          y: arrowTargetBox.top,
        },
        bottom: {
          x: arrowTargetBox.left + arrowTargetBox.width / 2,
          y: arrowTargetBox.top + arrowTargetBox.height,
        },
        left: {
          x: arrowTargetBox.left,
          y: arrowTargetBox.top + arrowTargetBox.height / 2,
        },
        right: {
          x: arrowTargetBox.left + arrowTargetBox.width,
          y: arrowTargetBox.top + arrowTargetBox.height / 2,
        },
      }
    : null

  if (!shapePreview && !arrowPreview) return null

  return (
    <svg className="sb-editor-tool-preview">
      {shapePreview && draft ? (
        tool === 'line' ? (
          <line
            x1={shapePreview.left + (draft.currentX <= draft.startX ? shapePreview.width : 0)}
            y1={shapePreview.top + (draft.currentY <= draft.startY ? shapePreview.height : 0)}
            x2={shapePreview.left + (draft.currentX <= draft.startX ? 0 : shapePreview.width)}
            y2={shapePreview.top + (draft.currentY <= draft.startY ? 0 : shapePreview.height)}
          />
        ) : tool === 'ellipse' ? (
          <ellipse
            cx={shapePreview.left + shapePreview.width / 2}
            cy={shapePreview.top + shapePreview.height / 2}
            rx={shapePreview.width / 2}
            ry={shapePreview.height / 2}
          />
        ) : tool === 'diamond' ? (
          <polygon
            points={[
              `${shapePreview.left + shapePreview.width / 2},${shapePreview.top}`,
              `${shapePreview.left + shapePreview.width},${shapePreview.top + shapePreview.height / 2}`,
              `${shapePreview.left + shapePreview.width / 2},${shapePreview.top + shapePreview.height}`,
              `${shapePreview.left},${shapePreview.top + shapePreview.height / 2}`,
            ].join(' ')}
          />
        ) : (
          <rect
            x={shapePreview.left}
            y={shapePreview.top}
            width={shapePreview.width}
            height={shapePreview.height}
            rx={tool === 'rounded-rect' ? 8 : 0}
          />
        )
      ) : null}
      {arrowPreview ? (
        <>
          {arrowTargetBox ? (
            <>
              <rect
                className="sb-editor-arrow-target"
                x={arrowTargetBox.left}
                y={arrowTargetBox.top}
                width={arrowTargetBox.width}
                height={arrowTargetBox.height}
                rx={6}
              />
              {arrowTargetHandles
                ? (['top', 'right', 'bottom', 'left'] as const).map((side) => (
                    <circle
                      key={side}
                      className={`sb-editor-arrow-target-handle${
                        arrowTargetSide === side ? ' is-active' : ''
                      }`}
                      cx={arrowTargetHandles[side].x}
                      cy={arrowTargetHandles[side].y}
                      r={arrowTargetSide === side ? 5 : 3.5}
                    />
                  ))
                : null}
            </>
          ) : null}
          <line
            x1={arrowPreview.startX}
            y1={arrowPreview.startY}
            x2={arrowPreview.endX}
            y2={arrowPreview.endY}
          />
          <circle cx={arrowPreview.startX} cy={arrowPreview.startY} r={4} />
        </>
      ) : null}
    </svg>
  )
}
