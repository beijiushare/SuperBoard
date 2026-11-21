import type { BoardScope } from '../shared/board/types'
import { configureWorkspaceFetcher } from '../canvas/editor/workspaceApi'
import * as Workspace from './bindings/superboard/desktop/services/workspaceservice'
import * as Exporter from './bindings/superboard/desktop/services/exportservice'
import type { Result } from './bindings/superboard/desktop/services/models'

export type DesktopModeState = 'unknown' | 'desktop' | 'browser'

let state: DesktopModeState = 'unknown'
let workspaceName = ''

export function desktopMode() {
  return state === 'desktop'
}

export function desktopState() {
  return state
}

function timeout<T>(promise: Promise<T>, ms = 400) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error('桌面桥接超时')), ms),
    ),
  ])
}

export async function detectDesktop() {
  if (state !== 'unknown') return state === 'desktop'
  try {
    const name = await timeout(Workspace.WorkspaceName())
    state = typeof name === 'string' ? 'desktop' : 'browser'
    workspaceName = name
  } catch {
    state = 'browser'
  }
  return state === 'desktop'
}

function parse<T>(result: Result): T {
  return JSON.parse(result.body) as T
}

export function desktopWorkspaceName() {
  return workspaceName
}

export async function desktopWorkspacePath() {
  try {
    return await Workspace.WorkspacePath()
  } catch {
    return ''
  }
}

export async function openDesktopWorkspace() {
  const result = await Workspace.OpenWorkspace()
  const data = parse<{ name?: string; cancelled?: boolean; error?: string }>(result)
  if (data.error) throw new Error(data.error)
  if (data.cancelled) return null
  workspaceName = data.name ?? ''
  return workspaceName
}

export async function restoreDesktopWorkspace() {
  const result = await Workspace.RestoreWorkspace()
  const data = parse<{ name?: string; error?: string }>(result)
  workspaceName = data.name ?? ''
  return workspaceName || null
}

export interface DesktopRecentWorkspace {
  path: string
  name: string
  lastOpened?: string
  available: boolean
}

export async function desktopRecentWorkspaces() {
  const result = await Workspace.RecentWorkspaces()
  const data = parse<{ recent?: DesktopRecentWorkspace[]; error?: string }>(
    result,
  )
  if (data.error) throw new Error(data.error)
  return data.recent ?? []
}

export async function desktopOpenWorkspacePath(path: string) {
  const result = await Workspace.OpenWorkspaceAt(path)
  const data = parse<{ name?: string; error?: string }>(result)
  if (data.error) throw new Error(data.error)
  workspaceName = data.name ?? ''
  return workspaceName || null
}

export async function desktopForgetWorkspace(path: string) {
  const result = await Workspace.ForgetWorkspace(path)
  const data = parse<{ error?: string }>(result)
  if (data.error) throw new Error(data.error)
}

export async function desktopGetLanguage() {
  const result = await Workspace.GetLanguage()
  const data = parse<{ language?: string; error?: string }>(result)
  if (data.error) throw new Error(data.error)
  return data.language ?? ''
}

export async function desktopSetLanguage(language: string) {
  const result = await Workspace.SetLanguage(language)
  const data = parse<{ error?: string }>(result)
  if (data.error) throw new Error(data.error)
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export interface ImportedFile {
  path: string
  name: string
  mime: string
  size: number
}

export async function desktopImportFile(
  file: File,
  scope: BoardScope,
): Promise<ImportedFile> {
  const data = await readAsDataUrl(file)
  const result = await Workspace.ImportFile(file.name, data, scope)
  const body = parse<ImportedFile & { error?: string }>(result)
  if (!body.path) throw new Error(body.error ?? '导入文件失败')
  return body
}

export async function desktopPickFiles(scope: BoardScope) {
  const result = await Workspace.PickFiles(scope)
  const body = parse<{
    files?: ImportedFile[]
    cancelled?: boolean
    error?: string
  }>(result)
  if (body.error) throw new Error(body.error)
  return body.files ?? []
}

export async function desktopFileUrl(path: string) {
  try {
    const url = await Workspace.FileURL(path)
    return new URL(url, window.location.href).toString()
  } catch {
    return null
  }
}

export async function desktopOpenFile(path: string) {
  await Workspace.OpenFile(path)
}

export async function desktopRevealFile(path: string) {
  await Workspace.RevealFile(path)
}

export async function desktopDeleteFile(path: string) {
  await Workspace.DeleteFile(path)
}

export async function desktopExportHtml(html: string, suggestedName: string) {
  const result = await Exporter.ExportHtml(html, suggestedName)
  const data = parse<{ cancelled?: boolean; error?: string }>(result)
  if (data.error) throw new Error(data.error)
  return !data.cancelled
}

export async function desktopExportFolder(
  html: string,
  attachments: Array<{ source: string; target: string }>,
) {
  const result = await Exporter.ExportFolder(html, JSON.stringify(attachments))
  const data = parse<{ cancelled?: boolean; error?: string }>(result)
  if (data.error) throw new Error(data.error)
  return !data.cancelled
}

function jsonResponse(result: Result) {
  return new Response(result.body, {
    status: result.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function guarded(run: () => Promise<Result>) {
  try {
    return jsonResponse(await run())
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
}

function notFound() {
  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function handleCanvases(url: URL, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  if (url.pathname === '/__canvases' && method === 'GET') {
    return guarded(() => Workspace.ListBoards())
  }
  if (url.pathname === '/__canvases' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      title?: string
      slug?: string
      folder?: string
      scope?: string
    }
    return guarded(() =>
      Workspace.CreateBoard(
        String(body.title ?? ''),
        String(body.slug ?? ''),
        String(body.folder ?? ''),
        body.scope === 'private' ? 'private' : 'public',
      ),
    )
  }
  const match = url.pathname.match(/^\/__canvases\/([a-z0-9][a-z0-9-]*)$/)
  if (!match) return notFound()
  const slug = match[1]
  const scope = url.searchParams.get('scope') === 'private' ? 'private' : 'public'
  if (method === 'GET') {
    return guarded(() => Workspace.ReadBoard(slug, scope))
  }
  if (method === 'PUT') {
    const force =
      new Headers(init?.headers).get('x-superboard-force') === '1'
    return guarded(() =>
      Workspace.WriteBoard(slug, scope, String(init?.body ?? ''), force),
    )
  }
  if (method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      title?: string
      slug?: string
      folder?: string
      summary?: string
    }
    return guarded(() =>
      Workspace.UpdateBoard(
        slug,
        scope,
        String(body.title ?? ''),
        String(body.slug ?? slug),
        String(body.folder ?? ''),
        String(body.summary ?? ''),
      ),
    )
  }
  if (method === 'DELETE') {
    return guarded(() => Workspace.DeleteBoard(slug, scope))
  }
  return notFound()
}

async function handleFolders(url: URL, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  if (url.pathname === '/__folders' && method === 'GET') {
    return guarded(() => Workspace.ListFolders())
  }
  if (url.pathname === '/__folders' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      parent?: string
      name?: string
      scope?: string
    }
    return guarded(() =>
      Workspace.CreateFolder(
        String(body.parent ?? ''),
        String(body.name ?? ''),
        body.scope === 'private' ? 'private' : 'public',
      ),
    )
  }
  if (url.pathname === '/__folders' && method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      path?: string
      name?: string
      parent?: string
      scope?: string
    }
    return guarded(() =>
      Workspace.UpdateFolder(
        String(body.path ?? ''),
        String(body.name ?? ''),
        String(body.parent ?? ''),
        body.scope === 'private' ? 'private' : 'public',
      ),
    )
  }
  if (url.pathname === '/__folders' && method === 'DELETE') {
    return guarded(() =>
      Workspace.DeleteFolder(
        String(url.searchParams.get('path') ?? ''),
        url.searchParams.get('scope') === 'private' ? 'private' : 'public',
      ),
    )
  }
  return notFound()
}

export async function desktopRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof Request
        ? input.url
        : input.toString()
  const url = new URL(rawUrl, window.location.href)
  if (url.pathname.startsWith('/__canvases')) return handleCanvases(url, init)
  if (url.pathname.startsWith('/__folders')) return handleFolders(url, init)
  return notFound()
}

export function installDesktopFolderBackend() {
  configureWorkspaceFetcher(desktopRequest)
}
