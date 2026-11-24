import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ColorPicker } from '../../canvas/editor/ColorPicker'
import type { BlockStyleDefaults } from '../../canvas/editor/preferences'
import type { SuperBoardTreeNode } from '../../canvas/model'

interface TreeCardMenuProps {
  anchor: { left: number; top: number }
  node: SuperBoardTreeNode
  defaults: BlockStyleDefaults
  onBackground: (color: string) => void
  onBorder: (color: string) => void
  onClose: () => void
}

/**
 * Card colours live in a small portal menu: the card itself clips its content,
 * so an inline popover would be cut off.
 */
export function TreeCardMenu({
  anchor,
  node,
  defaults,
  onBackground,
  onBorder,
  onClose,
}: TreeCardMenuProps) {
  const { t } = useTranslation(['editor'])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          '.sb-kt-menu, .sb-color-popover, .sb-color-trigger, .sb-color-control',
        )
      ) {
        return
      }
      onClose()
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [onClose])

  return createPortal(
    <div
      className="sb-kt-menu"
      style={{
        left: Math.min(anchor.left, window.innerWidth - 300),
        top: Math.min(anchor.top, window.innerHeight - 220),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ColorPicker
        label={t('editor:tree.background')}
        value={node.style?.background ?? defaults.backgroundColor}
        allowNone={false}
        onChange={onBackground}
      />
      <ColorPicker
        label={t('editor:tree.border')}
        value={node.style?.border ?? defaults.borderColor}
        allowNone
        onChange={onBorder}
      />
    </div>,
    document.body,
  )
}
