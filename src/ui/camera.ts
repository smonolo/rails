import { clamp } from '../utils/math.ts'
import type { WorldBounds } from '../types.ts'

export type { WorldBounds }

export class Camera {
  public x: number = 0
  public y: number = 0
  public targetX: number = 0
  public targetY: number = 0

  public zoom: number = 1.0
  public targetZoom: number = 1.0

  public isDragging: number = 0
  private dragStartX: number = 0
  private dragStartY: number = 0
  public isUserPanning: boolean = false

  private touchStartDist: number = 0
  private touchStartZoom: number = 1.0

  public minZoom: number = 0.35
  public maxZoom: number = 2.4

  public worldBounds: WorldBounds = {
    minX: 100,
    maxX: 2450,
    minY: 150,
    maxY: 1800,
  }

  constructor(initialX: number, initialY: number) {
    this.x = initialX
    this.y = initialY
    this.targetX = initialX
    this.targetY = initialY

    this.clampTarget()
  }

  public setWorldBounds(bounds: WorldBounds): void {
    this.worldBounds = { ...bounds }
    this.clampTarget()
  }

  private clampTarget(): void {
    this.targetX = clamp(
      this.targetX,
      this.worldBounds.minX,
      this.worldBounds.maxX
    )
    this.targetY = clamp(
      this.targetY,
      this.worldBounds.minY,
      this.worldBounds.maxY
    )
  }

  public follow(tx: number, ty: number): void {
    if (!this.isUserPanning) {
      this.targetX = tx
      this.targetY = ty

      this.clampTarget()
    }
  }

  public resetToTrain(tx: number, ty: number): void {
    this.isUserPanning = false
    this.targetX = tx
    this.targetY = ty

    this.clampTarget()
  }

  public update(dt: number): void {
    const lerpSpeed = 8.0
    const factor = 1 - Math.exp(-lerpSpeed * dt)

    this.x += (this.targetX - this.x) * factor
    this.y += (this.targetY - this.y) * factor

    this.x = clamp(
      this.x,
      this.worldBounds.minX - 30,
      this.worldBounds.maxX + 30
    )
    this.y = clamp(
      this.y,
      this.worldBounds.minY - 30,
      this.worldBounds.maxY + 30
    )

    const zoomSpeed = 10.0
    const zoomFactor = 1 - Math.exp(-zoomSpeed * dt)

    this.zoom += (this.targetZoom - this.zoom) * zoomFactor
  }

  public applyTransform(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.translate(width / 2, height / 2)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-this.x, -this.y)
  }

  public screenToWorld(
    sx: number,
    sy: number,
    width: number,
    height: number
  ): { x: number; y: number } {
    const cx = width / 2
    const cy = height / 2
    const wx = (sx - cx) / this.zoom + this.x
    const wy = (sy - cy) / this.zoom + this.y

    return { x: wx, y: wy }
  }

  public onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.isDragging = 1
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
    }
  }

  public onMouseMove(e: MouseEvent): void {
    if (this.isDragging === 1) {
      const dx = (e.clientX - this.dragStartX) / this.zoom
      const dy = (e.clientY - this.dragStartY) / this.zoom

      if (Math.hypot(dx, dy) > 4) {
        this.isUserPanning = true
      }

      this.targetX -= dx
      this.targetY -= dy

      this.clampTarget()

      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
    }
  }

  public onMouseUp(): void {
    this.isDragging = 0
  }

  public onWheel(e: WheelEvent): void {
    e.preventDefault()

    let dy = e.deltaY

    if (e.deltaMode === 1) {
      dy *= 18
    } else if (e.deltaMode === 2) {
      dy *= 60
    }

    const clampedDy = clamp(dy, -100, 100)
    const zoomDelta = Math.exp(-clampedDy * 0.002)

    this.targetZoom = clamp(
      this.targetZoom * zoomDelta,
      this.minZoom,
      this.maxZoom
    )
  }

  public onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = 1
      this.dragStartX = e.touches[0].clientX
      this.dragStartY = e.touches[0].clientY
    } else if (e.touches.length >= 2) {
      this.isDragging = 2
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      this.touchStartDist = Math.hypot(dx, dy) || 1
      this.touchStartZoom = this.targetZoom
    }
  }

  public onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1 && this.isDragging === 1) {
      const dx = (e.touches[0].clientX - this.dragStartX) / this.zoom
      const dy = (e.touches[0].clientY - this.dragStartY) / this.zoom

      if (Math.hypot(dx, dy) > 3) {
        this.isUserPanning = true
      }

      this.targetX -= dx
      this.targetY -= dy

      this.clampTarget()

      this.dragStartX = e.touches[0].clientX
      this.dragStartY = e.touches[0].clientY
    } else if (e.touches.length >= 2 && this.isDragging === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const currentDist = Math.hypot(dx, dy) || 1
      const ratio = currentDist / this.touchStartDist

      this.targetZoom = clamp(
        this.touchStartZoom * ratio,
        this.minZoom,
        this.maxZoom
      )
      this.isUserPanning = true
    }
  }

  public onTouchEnd(): void {
    this.isDragging = 0
  }
}
