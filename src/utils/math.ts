import type { Point2D } from '../types.ts'

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function wrap(val: number, max: number): number {
  return ((val % max) + max) % max
}

export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function normalizeAngle(angle: number): number {
  let a = angle

  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI

  return a
}

export function angleDiff(fromAngle: number, toAngle: number): number {
  return normalizeAngle(toAngle - fromAngle)
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t
}

export function shortestLoopDelta(
  fromDist: number,
  toDist: number,
  loopLength: number
): number {
  let delta = toDist - fromDist

  if (delta > loopLength / 2) delta -= loopLength
  if (delta < -loopLength / 2) delta += loopLength

  return delta
}

export function binarySearchByDistance<T extends { distance: number }>(
  items: T[],
  targetDist: number
): number {
  let low = 0
  let high = items.length - 1

  while (low <= high) {
    const mid = (low + high) >> 1

    if (items[mid].distance < targetDist) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return Math.max(0, low - 1)
}

export function catmullRom2D(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const t2 = t * t
  const t3 = t2 * t
  const f0 = -0.5 * t3 + t2 - 0.5 * t
  const f1 = 1.5 * t3 - 2.5 * t2 + 1.0
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t
  const f3 = 0.5 * t3 - 0.5 * t2

  return {
    x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3,
  }
}
