import './style.css'
import { TrackNetwork } from './core/track.ts'
import { Train } from './core/train.ts'
import { SignalManager } from './core/signals.ts'
import { StationManager } from './core/stations.ts'
import { SceneryManager } from './core/scenery.ts'
import { Camera } from './ui/camera.ts'
import { HUD } from './ui/hud.ts'
import { AdvancedSystemsManager } from './core/advanced.ts'
import { loadWorldConfig, saveWorldConfig } from './utils/config.ts'
import { distance } from './utils/math.ts'
import type { WorldShape, WorldSize, WorldBounds } from './types.ts'

class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private trackNet: TrackNetwork
  private train: Train
  private signalMgr: SignalManager
  private stationMgr: StationManager
  private sceneryMgr: SceneryManager
  private advancedSystemsMgr: AdvancedSystemsManager
  private camera: Camera
  private hud: HUD

  private seed: number | string = 12345
  private currentShape: WorldShape = 'O'
  private currentSize: WorldSize = 'M'
  private loadingOverlayEl: HTMLElement | null = null
  private loadingSeedInfoEl: HTMLElement | null = null

  private lastTime: number = 0
  private dpr: number = 1
  private mouseDownPos: { x: number; y: number } = { x: 0, y: 0 }
  private touchStartPos: { x: number; y: number } = { x: 0, y: 0 }
  private touchStartTime: number = 0
  private lastTouchEndTime: number = 0

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.loadingOverlayEl = document.getElementById('loading-overlay')
    this.loadingSeedInfoEl = document.getElementById('loading-seed-info')

    const config = loadWorldConfig()
    this.seed = config.seed
    this.currentShape = config.shape
    this.currentSize = config.size

    saveWorldConfig(config)

    this.trackNet = new TrackNetwork(
      this.seed,
      this.currentShape,
      this.currentSize
    )
    this.train = new Train(this.trackNet)
    this.signalMgr = new SignalManager(this.trackNet)
    this.stationMgr = new StationManager(this.trackNet, this.seed)
    this.sceneryMgr = new SceneryManager(
      this.trackNet,
      this.stationMgr.stations,
      this.seed
    )
    this.advancedSystemsMgr = new AdvancedSystemsManager()

    const spawnPt = this.train.getVehiclePosition(0, this.trackNet)
    this.camera = new Camera(spawnPt.x, spawnPt.y)
    this.camera.setWorldBounds(this.trackNet.worldBounds)

    this.hud = new HUD(
      this.train,
      this.stationMgr,
      this.signalMgr,
      this.trackNet,
      this.camera,
      this.advancedSystemsMgr
    )
    this.hud.selectedShape = this.currentShape
    this.hud.selectedSize = this.currentSize
    this.hud.syncWorldConfigUI()
    this.hud.onRegenerateShape = (shape, size) => {
      this.regenerateWorld(undefined, shape, size)
    }

    if (!this.advancedSystemsMgr.config.advancedControls) {
      localStorage.removeItem('rails_advanced_controls')
    }

    this.setupResize()
    this.setupInput()

    requestAnimationFrame(t => this.loop(t))
  }

  public async regenerateWorld(
    explicitSeed?: number | string,
    explicitShape?: WorldShape,
    explicitSize?: WorldSize
  ): Promise<void> {
    const nextSeed =
      explicitSeed !== undefined
        ? explicitSeed
        : Math.floor(Math.random() * 900000) + 100000
    const nextShape =
      explicitShape !== undefined ? explicitShape : this.currentShape
    const nextSize =
      explicitSize !== undefined ? explicitSize : this.currentSize

    this.seed = nextSeed
    this.currentShape = nextShape
    this.currentSize = nextSize

    saveWorldConfig({ seed: nextSeed, shape: nextShape, size: nextSize })

    if (this.loadingOverlayEl && this.loadingSeedInfoEl) {
      this.loadingSeedInfoEl.textContent = `Seed #${nextSeed} · Synthesizing ${nextShape}-shape (${nextSize}) layout...`
      this.loadingOverlayEl.classList.remove('hidden')
    }

    await new Promise(resolve => setTimeout(resolve, 60))

    this.trackNet.generate(this.seed, this.currentShape, this.currentSize)
    this.camera.setWorldBounds(this.trackNet.worldBounds)
    this.stationMgr.generateStations(this.trackNet, this.seed)
    this.signalMgr = new SignalManager(this.trackNet)
    this.sceneryMgr.generateScenery(
      this.trackNet,
      this.stationMgr.stations,
      this.seed
    )
    this.train = new Train(this.trackNet)
    this.hud.resetForWorld(
      this.train,
      this.stationMgr,
      this.signalMgr,
      this.trackNet,
      this.advancedSystemsMgr
    )

    const spawnPt = this.train.getVehiclePosition(0, this.trackNet)
    this.camera.resetToTrain(spawnPt.x, spawnPt.y)

    await new Promise(resolve => setTimeout(resolve, 140))

    if (this.loadingOverlayEl) {
      this.loadingOverlayEl.classList.add('hidden')
    }
  }

  private setupResize(): void {
    const resize = () => {
      this.dpr = window.devicePixelRatio || 1
      this.canvas.width = window.innerWidth * this.dpr
      this.canvas.height = window.innerHeight * this.dpr
      this.canvas.style.width = `${window.innerWidth}px`
      this.canvas.style.height = `${window.innerHeight}px`
    }

    window.addEventListener('resize', resize)
    resize()
  }

  private setupInput(): void {
    const container = document.getElementById('canvas-container')!

    container.addEventListener('mousedown', e => {
      if (performance.now() - this.lastTouchEndTime < 600) {
        return
      }

      this.mouseDownPos = { x: e.clientX, y: e.clientY }
      this.camera.onMouseDown(e)
    })

    window.addEventListener('mousemove', e => {
      if (performance.now() - this.lastTouchEndTime < 600) {
        return
      }

      this.camera.onMouseMove(e)

      const width = this.canvas.width / this.dpr
      const height = this.canvas.height / this.dpr
      const world = this.camera.screenToWorld(
        e.clientX,
        e.clientY,
        width,
        height
      )

      const isOverSwitch = !!this.trackNet.findSwitchAt(world.x, world.y, 20)
      let isOverSignal = false

      for (const sig of this.signalMgr.signals) {
        if (sig.worldX !== undefined && sig.worldY !== undefined) {
          if (distance(sig.worldX, sig.worldY, world.x, world.y) <= 18) {
            isOverSignal = true
            break
          }
        }
      }

      if (isOverSwitch || isOverSignal) {
        container.style.cursor = 'pointer'
      } else {
        container.style.cursor = this.camera.isDragging ? 'grabbing' : 'grab'
      }
    })

    window.addEventListener('mouseup', e => {
      if (performance.now() - this.lastTouchEndTime < 600) {
        this.camera.onMouseUp()
        container.style.cursor = 'grab'
        return
      }

      const dragDist = distance(
        e.clientX,
        e.clientY,
        this.mouseDownPos.x,
        this.mouseDownPos.y
      )

      if (dragDist < 6) {
        const width = this.canvas.width / this.dpr
        const height = this.canvas.height / this.dpr
        const world = this.camera.screenToWorld(
          e.clientX,
          e.clientY,
          width,
          height
        )

        this.handleWorldClick(world.x, world.y, 22)
      }

      this.camera.onMouseUp()
      container.style.cursor = 'grab'
    })

    container.addEventListener(
      'touchstart',
      e => {
        this.lastTouchEndTime = performance.now()

        if (e.touches.length === 1) {
          this.touchStartPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          }
          this.touchStartTime = Date.now()
        }

        this.camera.onTouchStart(e)
      },
      { passive: false }
    )

    window.addEventListener(
      'touchmove',
      e => {
        this.camera.onTouchMove(e)

        if (e.cancelable) {
          e.preventDefault()
        }
      },
      { passive: false }
    )

    window.addEventListener(
      'touchend',
      e => {
        this.lastTouchEndTime = performance.now()

        if (e.changedTouches.length === 1 && this.camera.isDragging <= 1) {
          const touch = e.changedTouches[0]
          const dist = distance(
            touch.clientX,
            touch.clientY,
            this.touchStartPos.x,
            this.touchStartPos.y
          )
          const elapsed = Date.now() - this.touchStartTime

          if (dist < 18 && elapsed < 450) {
            if (e.cancelable) {
              e.preventDefault()
            }

            const width = this.canvas.width / this.dpr
            const height = this.canvas.height / this.dpr
            const world = this.camera.screenToWorld(
              touch.clientX,
              touch.clientY,
              width,
              height
            )

            this.handleWorldClick(world.x, world.y, 22)
          }
        }

        this.camera.onTouchEnd()
      },
      { passive: false }
    )

    window.addEventListener('touchcancel', () => {
      this.lastTouchEndTime = performance.now()
      this.camera.onTouchEnd()
    })

    container.addEventListener('wheel', e => this.camera.onWheel(e), {
      passive: false,
    })
  }

  private handleWorldClick(
    worldX: number,
    worldY: number,
    radius: number = 22
  ): void {
    const clickedSwitch = this.trackNet.findSwitchAt(worldX, worldY, radius)

    if (clickedSwitch) {
      const isSwitchTraversing = this.train.activeCrossovers.some(
        c => c.zone.switchId === clickedSwitch.id
      )

      if (
        isSwitchTraversing ||
        this.trackNet.isSwitchOccupied(
          clickedSwitch.id,
          this.train.trackId,
          this.train.headDistance,
          this.train.tailDistance,
          this.train.activeTransition?.zone.switchId,
          this.train.getAllVehiclePositions(this.trackNet)
        )
      ) {
        this.hud.triggerAlert({
          type: 'info',
          title: clickedSwitch.name,
          message: 'Switch locked: track segment is occupied by a train.',
          canReset: true,
        })

        setTimeout(() => this.hud.clearAlert(), 3500)
      } else {
        const newState = this.trackNet.toggleSwitch(clickedSwitch.id)
        this.signalMgr.onSwitchToggled(clickedSwitch.id, this.trackNet)
        const stateStr =
          newState === 'diverging' ? 'diverging route' : 'straight route'

        this.hud.triggerAlert({
          type: 'info',
          title: `${clickedSwitch.name}`,
          message: `Route switched to: ${stateStr}`,
          canReset: true,
        })

        setTimeout(() => this.hud.clearAlert(), 3500)
      }
    } else {
      const result = this.signalMgr.toggleSignalAt(
        worldX,
        worldY,
        radius,
        this.train.trackId,
        this.train.facing,
        this.trackNet
      )

      if (result) {
        this.hud.triggerAlert({
          type: 'info',
          title: `${result.signal.name}`,
          message: result.message,
          canReset: true,
        })

        setTimeout(() => this.hud.clearAlert(), 3500)
      }
    }
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1)
    this.lastTime = timestamp

    this.update(dt)
    this.render()

    requestAnimationFrame(t => this.loop(t))
  }

  private update(dt: number): void {
    this.train.update(dt, this.trackNet)

    if (this.train.isCrashed) {
      if (this.train.isDerailed) {
        this.hud.triggerAlert({
          type: 'danger',
          title: 'Train derailed',
          message:
            this.train.crashReason ||
            'Catastrophic derailment on curve. Respawn required.',
          canReset: false,
        })
      } else {
        this.hud.triggerAlert({
          type: 'danger',
          title: 'Train crashed',
          message:
            'Collision with buffer stop at terminal dead track. Respawn required.',
          canReset: false,
        })
      }
    }

    const signalEvent = this.signalMgr.update(
      this.train.trackId,
      this.train.headDistance,
      this.train.tailDistance,
      this.trackNet,
      dt,
      this.train.facing
    )

    if (signalEvent.spad && !this.train.isEmergencyBrakeLocked) {
      this.train.tripEmergencyBrake(
        `Signal passed at danger: ${signalEvent.signalName}`
      )

      this.hud.triggerAlert({
        type: 'danger',
        title: 'Signal passed at danger (Stop)',
        message: `Passed ${signalEvent.signalName} at Danger (Stop). Emergency brake enforcement active.`,
        canReset: false,
      })
    }

    const deadmanEvent = this.advancedSystemsMgr.update(
      dt,
      this.train.speedKmH,
      this.train.isEmergencyBrakeLocked
    )

    if (deadmanEvent) {
      if (
        deadmanEvent.type === 'enforce' &&
        !this.train.isEmergencyBrakeLocked
      ) {
        this.train.tripEmergencyBrake(
          deadmanEvent.reason ||
            'Deadman control enforcement: vigilance unacknowledged'
        )

        this.hud.triggerAlert({
          type: 'danger',
          title: 'Deadman emergency braking enforcement',
          message:
            'Deadman vigilance unacknowledged within 35 seconds. Emergency brake locked until standstill.',
          canReset: false,
        })
      } else if (deadmanEvent.type === 'urgent') {
        this.hud.triggerAlert({
          type: 'danger',
          title: 'Deadman alert active',
          message:
            'Acknowledge vigilance immediately (press Q or cab pedal). Emergency braking in 2.5s.',
          canReset: true,
        })
      } else if (deadmanEvent.type === 'visual') {
        this.hud.triggerAlert({
          type: 'warning',
          title: 'Deadman vigilance warning',
          message: 'Acknowledge deadman control (press Q or cab pedal).',
          canReset: true,
        })
      }
    }

    const stationStatus = this.stationMgr.update(
      this.train.trackId,
      this.train.distance,
      this.train.speed,
      dt,
      this.trackNet
    )

    const trainPt = this.train.getVehiclePosition(0, this.trackNet)

    this.camera.follow(trainPt.x, trainPt.y)
    this.camera.update(dt)

    this.hud.update(stationStatus)
  }

  private render(): void {
    const width = this.canvas.width / this.dpr
    const height = this.canvas.height / this.dpr

    this.ctx.save()
    this.ctx.scale(this.dpr, this.dpr)

    this.ctx.fillStyle = '#121215'
    this.ctx.fillRect(0, 0, width, height)

    this.ctx.save()
    this.camera.applyTransform(this.ctx, width, height)

    const bounds = this.camera.worldBounds
    const bW = bounds.maxX - bounds.minX
    const bH = bounds.maxY - bounds.minY

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([8, 8])
    this.ctx.strokeRect(bounds.minX, bounds.minY, bW, bH)
    this.ctx.setLineDash([])

    const cLen = 22

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
    this.ctx.lineWidth = 1.5
    this.ctx.beginPath()

    this.ctx.moveTo(bounds.minX, bounds.minY + cLen)
    this.ctx.lineTo(bounds.minX, bounds.minY)
    this.ctx.lineTo(bounds.minX + cLen, bounds.minY)

    this.ctx.moveTo(bounds.maxX - cLen, bounds.minY)
    this.ctx.lineTo(bounds.maxX, bounds.minY)
    this.ctx.lineTo(bounds.maxX, bounds.minY + cLen)

    this.ctx.moveTo(bounds.maxX, bounds.maxY - cLen)
    this.ctx.lineTo(bounds.maxX, bounds.maxY)
    this.ctx.lineTo(bounds.maxX - cLen, bounds.maxY)

    this.ctx.moveTo(bounds.minX + cLen, bounds.maxY)
    this.ctx.lineTo(bounds.minX, bounds.maxY)
    this.ctx.lineTo(bounds.minX, bounds.maxY - cLen)
    this.ctx.stroke()

    this.renderMapCartouche(this.ctx, bounds)

    this.sceneryMgr.renderGround(this.ctx)
    this.trackNet.render(this.ctx, this.train.trackId, this.train.facing)
    this.sceneryMgr.renderCatenary(this.ctx)
    this.stationMgr.render(this.ctx, this.trackNet)
    this.signalMgr.render(
      this.ctx,
      this.trackNet,
      this.train.trackId,
      this.train.facing
    )
    this.train.render(this.ctx, this.trackNet)

    this.ctx.restore()
    this.ctx.restore()
  }

  private renderMapCartouche(
    ctx: CanvasRenderingContext2D,
    bounds: WorldBounds
  ): void {
    const pad = 24
    const x = bounds.minX + pad
    const y = bounds.minY + pad
    const w = 210
    const h = 114

    ctx.save()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.lineWidth = 1.2
    const c = 5
    ctx.beginPath()
    ctx.moveTo(x, y + c)
    ctx.lineTo(x, y)
    ctx.lineTo(x + c, y)
    ctx.moveTo(x + w - c, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + c)
    ctx.moveTo(x + w, y + h - c)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x + w - c, y + h)
    ctx.moveTo(x + c, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + h - c)
    ctx.stroke()

    const bW = bounds.maxX - bounds.minX
    const bH = bounds.maxY - bounds.minY
    const boundsKm = `${(bW / 1000).toFixed(2)} × ${(bH / 1000).toFixed(2)} km`
    const totalTrackKm = `${(this.trackNet.tracks.reduce((sum, t) => sum + t.totalLength, 0) / 1000).toFixed(1)} km`

    ctx.font = '600 8.5px "Geist Mono", monospace'
    ctx.fillStyle = '#484856'
    ctx.fillText('BOUNDS', x + 12, y + 18)
    ctx.fillStyle = '#7c7c8c'
    ctx.fillText(boundsKm, x + 76, y + 18)

    ctx.fillStyle = '#484856'
    ctx.fillText('TRACKAGE', x + 12, y + 32)
    ctx.fillStyle = '#7c7c8c'
    ctx.fillText(totalTrackKm, x + 76, y + 32)

    ctx.fillStyle = '#484856'
    ctx.fillText('LAYOUT', x + 12, y + 46)
    ctx.fillStyle = '#7c7c8c'
    ctx.fillText(`${this.trackNet.shape}-SHAPE`, x + 76, y + 46)

    ctx.fillStyle = '#484856'
    ctx.fillText('SEED', x + 12, y + 60)
    ctx.fillStyle = '#7c7c8c'
    ctx.fillText(String(this.seed), x + 76, y + 60)

    ctx.fillStyle = '#484856'
    ctx.fillText('SCALE', x + 12, y + 78)

    const barX = x + 76
    const barY = y + 76
    const barLen = 100

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(barX, barY)
    ctx.lineTo(barX + barLen, barY)
    ctx.moveTo(barX, barY - 3)
    ctx.lineTo(barX, barY + 3)
    ctx.moveTo(barX + barLen / 2, barY - 2.5)
    ctx.lineTo(barX + barLen / 2, barY + 2.5)
    ctx.moveTo(barX + barLen, barY - 3)
    ctx.lineTo(barX + barLen, barY + 3)
    ctx.stroke()

    ctx.font = '500 7.5px "Geist Mono", monospace'
    ctx.fillStyle = '#525260'
    ctx.textAlign = 'left'
    ctx.fillText('0', barX, barY + 14)
    ctx.textAlign = 'center'
    ctx.fillText('50 m', barX + barLen / 2, barY + 14)
    ctx.textAlign = 'right'
    ctx.fillText('100 m', barX + barLen, barY + 14)

    ctx.restore()
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game()
})
