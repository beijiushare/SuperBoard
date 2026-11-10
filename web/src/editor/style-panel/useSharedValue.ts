import { useStylePanelContext, type SharedStyle, type StyleProp } from 'tldraw'

export function useSharedValue<T>(style: StyleProp<T>): SharedStyle<T> | undefined {
  return useStylePanelContext().styles.get(style)
}
