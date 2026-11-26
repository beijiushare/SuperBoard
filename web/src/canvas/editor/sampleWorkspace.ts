import i18n from '../../i18n'
import type { BoardScope } from '../../shared/board/types'
import type { CanvasDocument } from '../model'
import { setFileUrlResolver } from '../viewer/fileResolver'
import { configureWorkspaceFetcher } from './workspaceApi'
import type { WorkspaceRecentItem } from './workspacePlatform'
import { adoptBrowserWorkspace } from './browserFolderBackend'
import {
  desktopMode,
  desktopOpenWorkspacePath,
} from '../../desktop/platform'
import * as Workspace from '../../desktop/bindings/superboard/desktop/services/workspaceservice'

export interface SampleManifestBoard {
  slug: string
  title: string
  summary?: string
  order?: number
  updatedAt?: string
  path: string
  scope: BoardScope
}

export interface SampleManifest {
  version: string
  generatedAt: string
  boards: SampleManifestBoard[]
  folders: Array<{ path: string; scope: BoardScope }>
  files: string[]
}

let active = false
let manifest: Promise<SampleManifest> | null = null

export function sampleBase() {
  return `${import.meta.env.BASE_URL}sample/`
}

export function isSampleWorkspace() {
  return active
}

export function sampleRecentItem(): WorkspaceRecentItem {
  return {
    id: 'sample',
    name: 'sample',
    kind: 'sample',
    pinned: true,
    available: true,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function readOnly() {
  return json({ error: i18n.t('errors:workspace.readOnly') }, 403)
}

async function loadManifest() {
  if (!manifest) {
    manifest = fetch(`${sampleBase()}sample.json`, { cache: 'no-cache' }).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`sample manifest: ${response.status}`)
        }
        return (await response.json()) as SampleManifest
      },
    )
  }
  return manifest
}

function boardUrl(board: SampleManifestBoard) {
  const folder = board.path ? `${board.path}/` : ''
  return `${sampleBase()}${board.scope}/${folder}${board.slug}.canvas`
}

async function sampleRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof Request
        ? input.url
        : input.toString()
  const url = new URL(rawUrl, window.location.href)
  const method = init?.method ?? 'GET'
  const scope = url.searchParams.get('scope') === 'private' ? 'private' : 'public'

  try {
    if (url.pathname === '/__canvases' && method === 'GET') {
      const data = await loadManifest()
      return json({ canvases: data.boards })
    }
    if (url.pathname === '/__canvases' && method !== 'GET') {
      return readOnly()
    }
    if (url.pathname === '/__folders' && method === 'GET') {
      const data = await loadManifest()
      return json({ folders: data.folders })
    }
    if (url.pathname === '/__folders' && method !== 'GET') {
      return readOnly()
    }
    if (url.pathname === '/__history') {
      if (method === 'GET') return json({ totalSize: 0, count: 0 })
      return readOnly()
    }

    const historyMatch = url.pathname.match(
      /^\/__canvases\/([a-z0-9][a-z0-9-]*)\/history$/,
    )
    if (historyMatch) {
      if (method === 'GET') return json({ entries: [], totalSize: 0 })
      return readOnly()
    }
    const entryMatch = url.pathname.match(
      /^\/__canvases\/([a-z0-9][a-z0-9-]*)\/history\/[0-9]{13}-[a-f0-9]{10}$/,
    )
    if (entryMatch) return json({ error: i18n.t('errors:workspace.historyMissing') }, 404)

    const boardMatch = url.pathname.match(
      /^\/__canvases\/([a-z0-9][a-z0-9-]*)$/,
    )
    if (!boardMatch) {
      return json({ error: 'not found' }, 404)
    }
    if (method !== 'GET') return readOnly()

    const slug = boardMatch[1]
    const data = await loadManifest()
    const board = data.boards.find(
      (item) => item.slug === slug && item.scope === scope,
    )
    if (!board) {
      return json({ error: i18n.t('errors:workspace.boardMissing') }, 404)
    }
    const response = await fetch(boardUrl(board), { cache: 'no-cache' })
    if (!response.ok) {
      return json({ error: i18n.t('errors:workspace.boardMissing') }, 404)
    }
    const text = await response.text()
    // Validate before handing it to the editor.
    JSON.parse(text) as CanvasDocument
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    )
  }
}

/**
 * Routes the workspace API to the static sample under `<base>/sample/`.
 * Installed once per page; leaving the sample always reloads the window.
 */
export function installSampleWorkspace() {
  active = true
  setFileUrlResolver(async (path: string) => `${sampleBase()}${path}`)
  configureWorkspaceFetcher(sampleRequest)
}

export async function sampleManifest() {
  return loadManifest()
}

function leaveSample() {
  const params = new URLSearchParams(window.location.search)
  params.delete('sample')
  params.delete('start')
  params.delete('board')
  params.delete('scope')
  const query = params.toString()
  window.location.href = `${window.location.pathname}${query ? `?${query}` : ''}`
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function readSampleFiles() {
  const data = await loadManifest()
  const files: Array<{ path: string; data: string }> = []
  for (const file of data.files) {
    const response = await fetch(`${sampleBase()}${file}`, { cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(`sample file: ${file} (${response.status})`)
    }
    files.push({ path: file, data: toBase64(await response.arrayBuffer()) })
  }
  return files
}

async function copyToBrowserFolder() {
  const picker = (window as unknown as {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  if (!picker) throw new Error(i18n.t('errors:workspace.noFolderSupport'))
  const handle = await picker({ mode: 'readwrite' })
  const files = await readSampleFiles()
  for (const file of files) {
    const parts = file.path.split('/')
    let dir = handle
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
    const target = await dir.getFileHandle(parts[parts.length - 1], {
      create: true,
    })
    const writable = await target.createWritable()
    await writable.write(
      Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0)),
    )
    await writable.close()
  }
  await adoptBrowserWorkspace(handle)
  leaveSample()
}

async function copyToDesktopFolder() {
  const files = await readSampleFiles()
  const body = JSON.parse(
    (await Workspace.CopySample(JSON.stringify(files))).body,
  ) as { ok?: boolean; path?: string; cancelled?: boolean; error?: string }
  if (body.error) throw new Error(body.error)
  if (body.cancelled) return
  if (!body.path) throw new Error(i18n.t('errors:workspace.copySampleFailed'))
  await desktopOpenWorkspacePath(body.path)
  leaveSample()
}

/** Copies the sample into a folder the user owns, then leaves sample mode. */
export async function copySampleToWorkspace() {
  if (desktopMode()) await copyToDesktopFolder()
  else await copyToBrowserFolder()
}
