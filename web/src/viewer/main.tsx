import { createRoot } from 'react-dom/client'
import '../styles/viewer-index.css'
import { CanvasViewerApp } from './CanvasViewerApp'

createRoot(document.getElementById('root')!).render(<CanvasViewerApp />)
