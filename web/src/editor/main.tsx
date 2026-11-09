import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import '../styles.css'
import { EditorApp } from './EditorApp'

createRoot(document.getElementById('root')!).render(<EditorApp />)
