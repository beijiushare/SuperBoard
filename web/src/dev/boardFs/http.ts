import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 20 * 1024 * 1024) throw new HttpError(413, '请求体超过 20MB')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req)
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'JSON 解析失败')
  }
}
