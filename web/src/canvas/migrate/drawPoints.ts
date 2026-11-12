interface DecodedPoint {
  x: number
  y: number
  z: number
}

interface SegmentLike {
  type?: string
  path?: string
  dim?: 2 | 3
  points?: Array<{ x: number; y: number; z?: number } | [number, number, number?]>
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_LOOKUP = new Uint8Array(128)
for (let index = 0; index < 64; index += 1) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(index)] = index
}

function base64ToBytes(value: string) {
  let padding = 0
  if (value.endsWith('=')) padding += 1
  if (value.endsWith('==')) padding += 1
  const bytes = new Uint8Array(Math.floor((value.length * 3) / 4) - padding)
  let byteIndex = 0
  const fullGroups = Math.floor((value.length - padding) / 4) * 4
  for (let index = 0; index < fullGroups; index += 4) {
    const c0 = BASE64_LOOKUP[value.charCodeAt(index)]
    const c1 = BASE64_LOOKUP[value.charCodeAt(index + 1)]
    const c2 = BASE64_LOOKUP[value.charCodeAt(index + 2)]
    const c3 = BASE64_LOOKUP[value.charCodeAt(index + 3)]
    const bitmap = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    bytes[byteIndex++] = (bitmap >> 16) & 255
    bytes[byteIndex++] = (bitmap >> 8) & 255
    bytes[byteIndex++] = bitmap & 255
  }
  if (padding === 1) {
    const c0 = BASE64_LOOKUP[value.charCodeAt(fullGroups)]
    const c1 = BASE64_LOOKUP[value.charCodeAt(fullGroups + 1)]
    const c2 = BASE64_LOOKUP[value.charCodeAt(fullGroups + 2)]
    const bitmap = (c0 << 18) | (c1 << 12) | (c2 << 6)
    bytes[byteIndex++] = (bitmap >> 16) & 255
    bytes[byteIndex++] = (bitmap >> 8) & 255
  } else if (padding === 2) {
    const c0 = BASE64_LOOKUP[value.charCodeAt(fullGroups)]
    const c1 = BASE64_LOOKUP[value.charCodeAt(fullGroups + 1)]
    const bitmap = (c0 << 18) | (c1 << 12)
    bytes[byteIndex++] = (bitmap >> 16) & 255
  }
  return bytes
}

function float16ToNumber(bits: number) {
  const sign = bits >> 15 ? -1 : 1
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  if (exponent === 0) return sign * fraction * 2 ** -24
  if (exponent === 31) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15)
}

function readFloat16(view: DataView, offset: number) {
  return float16ToNumber(view.getUint16(offset, true))
}

function decodePoints(value: string, dim?: 2 | 3): DecodedPoint[] {
  if (!value) return []
  const bytes = base64ToBytes(value)
  if (bytes.length < (dim === 2 ? 8 : 12)) return []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const result: DecodedPoint[] = []
  if (dim === 2) {
    let x = view.getFloat32(0, true)
    let y = view.getFloat32(4, true)
    result.push({ x, y, z: 0.5 })
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
      x += readFloat16(view, offset)
      y += readFloat16(view, offset + 2)
      result.push({ x, y, z: 0.5 })
    }
    return result
  }
  let x = view.getFloat32(0, true)
  let y = view.getFloat32(4, true)
  let z = view.getFloat32(8, true)
  result.push({ x, y, z })
  for (let offset = 12; offset + 6 <= bytes.length; offset += 6) {
    x += readFloat16(view, offset)
    y += readFloat16(view, offset + 2)
    z += readFloat16(view, offset + 4)
    result.push({ x, y, z })
  }
  return result
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function interpolateStraight(start: DecodedPoint, end: DecodedPoint) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  if (distance === 0) return [start]
  const unitX = (end.x - start.x) / distance
  const unitY = (end.y - start.y) / distance
  const nudge = Math.min(1, Math.floor(distance / 4))
  const controlA = { x: start.x + unitX * nudge, y: start.y + unitY * nudge }
  const controlB = { x: end.x - unitX * nudge, y: end.y - unitY * nudge }
  const count = Math.max(4, Math.floor(distance / 16))
  const points: DecodedPoint[] = [start]
  for (let index = 1; index < count; index += 1) {
    const t = easeInOutCubic(index / count)
    points.push({
      x: controlA.x + (controlB.x - controlA.x) * t,
      y: controlA.y + (controlB.y - controlA.y) * t,
      z: 0.5,
    })
  }
  points.push(end)
  return points
}

function decodeSegment(segment: SegmentLike): DecodedPoint[] {
  if (typeof segment.path === 'string' && segment.path) {
    return decodePoints(segment.path, segment.dim)
  }
  if (Array.isArray(segment.points)) {
    return segment.points.map((point) => {
      if (Array.isArray(point)) return { x: point[0], y: point[1], z: point[2] ?? 0.5 }
      return { x: point.x, y: point.y, z: point.z ?? 0.5 }
    })
  }
  return []
}

export function pointsFromDrawSegments(
  segments: SegmentLike[],
  scaleX = 1,
  scaleY = 1,
) {
  const points: DecodedPoint[] = []
  for (const segment of segments) {
    const decoded = decodeSegment(segment)
    if (decoded.length === 0) continue
    for (const point of decoded) {
      point.x *= scaleX
      point.y *= scaleY
    }
    if (segment.type === 'free' || decoded.length < 2) {
      points.push(...decoded)
      continue
    }
    points.push(...interpolateStraight(decoded[0], decoded[1]))
  }
  return points
}
