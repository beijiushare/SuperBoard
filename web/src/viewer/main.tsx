import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import '../styles/index.css'
import { ViewerApp } from './ViewerApp'

createRoot(document.getElementById('root')!).render(<ViewerApp />)
