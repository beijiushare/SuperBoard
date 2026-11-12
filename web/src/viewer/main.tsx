import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import '../styles/index.css'
import { CanvasViewerApp } from './CanvasViewerApp'

createRoot(document.getElementById('root')!).render(<CanvasViewerApp />)
