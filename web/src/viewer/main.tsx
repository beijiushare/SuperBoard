import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import '../styles/index.css'
import { isTreePageData } from '../shared/board/page'
import { TreeViewerApp } from './TreeViewerApp'
import { ViewerApp } from './ViewerApp'

const data = window.__SUPERBOARD__

createRoot(document.getElementById('root')!).render(isTreePageData(data) ? <TreeViewerApp /> : <ViewerApp />)
