import { TrackNetwork, type CrossoverZone } from './track.ts'
import type { ReverserPosition, TrainType } from '../types.ts'
import { clamp, wrap, angleDiff, shortestLoopDelta } from '../utils/math.ts'

export interface ActiveCrossover {
  zone: CrossoverZone
  fromTrackId: number
  toTrackId: number
  entryDist: number
  exitDist: number
  direction: 1 | -1
  reverseCurve: boolean
  progressDist: number
}

export class Train {
  public trainType: TrainType = 'regional'

  public trackId: number = 0
  public distance: number = 0
  public speed: number = 0

  public activeCrossovers: ActiveCrossover[] = []

  public get activeTransition(): { zone: CrossoverZone } | null {
    if (this.activeCrossovers.length > 0) {
      return {
        zone: this.activeCrossovers[this.activeCrossovers.length - 1].zone,
      }
    }
    return null
  }

  public set activeTransition(val: { zone: CrossoverZone } | null) {
    if (val === null) {
      this.activeCrossovers = []
    }
  }

  public throttle: number = 0
  public brake: number = 0
  public reverser: ReverserPosition = 1

  public targetThrottle: number = 0
  public targetBrake: number = 0

  public readonly couplerGap = 3
  public carriageCount: number = 3
  public facing: 1 | -1 = 1

  public isEmergencyBrakeLocked: boolean = false
  public emergencyBrakeReason: string | null = null

  public isCrashed: boolean = false
  public isDerailed: boolean = false
  public crashReason: string | null = null

  public currentLateralAcc: number = 0
  public currentLateralG: number = 0

  constructor(trackNet: TrackNetwork) {
    this.spawnRandom(trackNet)
  }

  public setTrainType(type: TrainType): void {
    this.trainType = type

    if (type === 'cargo' && this.carriageCount < 4) {
      this.carriageCount = 4
    } else if (type === 'high_speed' && this.carriageCount < 4) {
      this.carriageCount = 4
    }
  }

  public get locoLength(): number {
    if (this.trainType === 'cargo') return 48
    if (this.trainType === 'high_speed') return 48
    return 46
  }

  public get locoWidth(): number {
    return 18
  }

  public get carriageLength(): number {
    return 42
  }

  public get carriageWidth(): number {
    return 18
  }

  public get totalWeightTons(): number {
    if (this.trainType === 'cargo') {
      return 88 + this.carriageCount * 74
    }

    if (this.trainType === 'high_speed') {
      return 56 + this.carriageCount * 48
    }

    return 84 + this.carriageCount * 48
  }

  public get maxSpeedFwd(): number {
    if (this.trainType === 'cargo') {
      const weightTaper = (this.totalWeightTons - 88) / 740
      const maxKmh = 120 - weightTaper * 20
      return maxKmh / 0.42
    }

    if (this.trainType === 'high_speed') {
      const weightTaper = (this.totalWeightTons - 56) / 480
      const maxKmh = 330 - weightTaper * 40
      return maxKmh / 0.42
    }

    const weightTaper = (this.totalWeightTons - 84) / 480
    const maxKmh = 160 - weightTaper * 20

    return maxKmh / 0.42
  }

  public get maxSpeedRev(): number {
    if (this.trainType === 'cargo') return 40 / 0.42
    if (this.trainType === 'high_speed') return 100 / 0.42
    return 80 / 0.42
  }

  public get currentMaxAccel(): number {
    if (this.trainType === 'cargo') {
      return 18 * (200 / (this.totalWeightTons + 100))
    }

    if (this.trainType === 'high_speed') {
      return 48 * (150 / (this.totalWeightTons + 50))
    }

    return 34 * (160 / (this.totalWeightTons + 60))
  }

  public get currentServiceBrake(): number {
    if (this.trainType === 'cargo') {
      return 22 * (250 / (this.totalWeightTons + 100))
    }

    if (this.trainType === 'high_speed') {
      return 42 * (150 / (this.totalWeightTons + 50))
    }

    return 34 * (160 / (this.totalWeightTons + 60))
  }

  public get currentEmergencyBrake(): number {
    if (this.trainType === 'cargo') {
      return 48 * (250 / (this.totalWeightTons + 100))
    }

    if (this.trainType === 'high_speed') {
      return 80 * (150 / (this.totalWeightTons + 50))
    }

    return 65 * (160 / (this.totalWeightTons + 60))
  }

  public get criticalLateralAcc(): number {
    let base = 6.8

    if (this.trainType === 'cargo') base = 4.6
    if (this.trainType === 'high_speed') base = 8.5

    const weightPenalty = Math.max(0.7, 1 - (this.totalWeightTons - 84) / 2800)

    return base * weightPenalty
  }

  public setCarriageCount(count: number): void {
    this.carriageCount = clamp(Math.round(count), 0, 10)
  }

  public get totalTrainLength(): number {
    if (this.carriageCount === 0) return this.locoLength

    const locoToCarr =
      this.locoLength / 2 + this.couplerGap + this.carriageLength / 2
    const carrToCarr = this.carriageLength + this.couplerGap

    return (
      locoToCarr +
      (this.carriageCount - 1) * carrToCarr +
      this.carriageLength / 2
    )
  }

  public get headDistance(): number {
    return this.distance
  }

  public get tailDistance(): number {
    return this.facing === 1
      ? this.distance - this.totalTrainLength
      : this.distance + this.totalTrainLength
  }

  public invert(trackNet?: TrackNetwork): void {
    if (this.facing === 1) {
      this.distance = this.distance - this.totalTrainLength
      this.facing = -1
    } else {
      this.distance = this.distance + this.totalTrainLength
      this.facing = 1
    }

    if (trackNet) {
      const activeTrack = trackNet.tracks[this.trackId]

      if (activeTrack) {
        if (activeTrack.isClosed) {
          this.distance = wrap(this.distance, activeTrack.totalLength)
        } else {
          this.distance = clamp(this.distance, 15, activeTrack.totalLength - 15)
        }
      }
    }

    this.activeCrossovers = []
    this.speed = 0
    this.throttle = 0
    this.targetThrottle = 0
  }

  public spawnRandom(trackNet: TrackNetwork): void {
    this.isCrashed = false
    this.isDerailed = false
    this.crashReason = null
    this.isEmergencyBrakeLocked = false
    this.emergencyBrakeReason = null
    this.facing = 1

    this.trackId = Math.random() < 0.5 ? 0 : 1
    this.facing = this.trackId % 2 === 0 ? 1 : -1
    const currentTrack = trackNet.tracks[this.trackId]

    if (currentTrack) {
      if (currentTrack.isClosed) {
        this.distance = Math.random() * currentTrack.totalLength
      } else {
        const margin = Math.min(1100, currentTrack.totalLength * 0.25)
        this.distance =
          margin + Math.random() * (currentTrack.totalLength - 2 * margin)
      }
    }
    this.speed = 0
    this.throttle = 0
    this.targetThrottle = 0
    this.brake = 0
    this.targetBrake = 0
    this.reverser = 1
    this.activeCrossovers = []
    this.currentLateralAcc = 0
    this.currentLateralG = 0
  }

  public crash(reason: string): void {
    this.isCrashed = true
    this.crashReason = reason
    this.speed = 0
    this.throttle = 0
    this.targetThrottle = 0
    this.brake = 1.0
    this.targetBrake = 1.0
    this.isEmergencyBrakeLocked = true
    this.emergencyBrakeReason = reason
  }

  public tripEmergencyBrake(reason: string): void {
    if (this.isCrashed) return

    this.isEmergencyBrakeLocked = true
    this.emergencyBrakeReason = reason
    this.targetThrottle = 0
    this.throttle = 0
    this.targetBrake = 1.0
  }

  public resetEmergencyBrake(): boolean {
    if (this.isCrashed) return false

    if (Math.abs(this.speed) < 0.01) {
      this.isEmergencyBrakeLocked = false
      this.emergencyBrakeReason = null
      this.targetBrake = 0

      return true
    }

    return false
  }

  public get speedKmH(): number {
    return Math.round(Math.abs(this.speed) * 0.42)
  }

  public update(dt: number, trackNet: TrackNetwork): void {
    if (this.isEmergencyBrakeLocked) {
      this.targetThrottle = 0
      this.throttle = 0
      this.targetBrake = 1.0
    }

    const leverRampSpeed = this.trainType === 'cargo' ? 0.45 : 0.65

    if (this.throttle < this.targetThrottle) {
      this.throttle = Math.min(
        this.targetThrottle,
        this.throttle + leverRampSpeed * dt
      )
    } else if (this.throttle > this.targetThrottle) {
      this.throttle = Math.max(
        this.targetThrottle,
        this.throttle - leverRampSpeed * dt
      )
    }

    if (this.brake < this.targetBrake) {
      this.brake = Math.min(this.targetBrake, this.brake + leverRampSpeed * dt)
    } else if (this.brake > this.targetBrake) {
      this.brake = Math.max(this.targetBrake, this.brake - leverRampSpeed * dt)
    }

    let tractiveAcc = 0

    if (
      !this.isEmergencyBrakeLocked &&
      this.reverser !== 0 &&
      this.throttle > 0
    ) {
      const currentMax = this.reverser > 0 ? this.maxSpeedFwd : this.maxSpeedRev
      const speedRatio = clamp(Math.abs(this.speed) / currentMax, 0, 1)
      const powerCurve = Math.max(0.05, 1 - Math.pow(speedRatio, 2))

      tractiveAcc =
        this.throttle * this.currentMaxAccel * powerCurve * this.reverser
    }

    let brakeDecel = 0

    if (this.brake > 0) {
      const brakeRate = this.isEmergencyBrakeLocked
        ? this.currentEmergencyBrake
        : this.currentServiceBrake
      brakeDecel = this.brake * brakeRate
    }

    const rollingFriction = this.trainType === 'cargo' ? 0.024 : 0.015
    const airDragCoeff = this.trainType === 'high_speed' ? 0.000003 : 0.0000045

    const dir = Math.sign(this.speed)
    const drag = dir * airDragCoeff * this.speed * this.speed
    const rolling = dir * rollingFriction

    let netAcc = tractiveAcc - drag

    if (this.speed !== 0) {
      netAcc -= dir * brakeDecel + rolling
    }

    const prevSpeed = this.speed
    this.speed += netAcc * dt

    if (tractiveAcc === 0 && Math.abs(prevSpeed) > 0.0001) {
      if (
        (prevSpeed > 0 && this.speed <= 0) ||
        (prevSpeed < 0 && this.speed >= 0)
      ) {
        this.speed = 0
      }
    }

    if (this.speed > this.maxSpeedFwd) this.speed = this.maxSpeedFwd
    if (this.speed < -this.maxSpeedRev) this.speed = -this.maxSpeedRev

    const prevDist = this.distance
    const moveDist = this.speed * dt * this.facing

    for (const cross of this.activeCrossovers) {
      cross.progressDist += moveDist * cross.direction
    }

    this.activeCrossovers = this.activeCrossovers.filter(
      c =>
        c.progressDist < c.zone.totalLength + this.totalTrainLength + 40 &&
        c.progressDist > -40
    )

    const newestCross =
      this.activeCrossovers.length > 0
        ? this.activeCrossovers[this.activeCrossovers.length - 1]
        : null
    const locoTraversingSwitch =
      newestCross !== null &&
      newestCross.progressDist < newestCross.zone.totalLength &&
      newestCross.progressDist >= 0

    if (locoTraversingSwitch && newestCross) {
      this.distance =
        newestCross.exitDist +
        (newestCross.progressDist - newestCross.zone.totalLength) *
          newestCross.direction
    } else {
      this.distance += moveDist

      for (const zone of trackNet.crossoverZones) {
        const sw = trackNet.switches.find(s => s.id === zone.switchId)

        if (!sw || sw.state !== 'diverging') continue

        const fromDir =
          zone.fromDirection ??
          (zone.endDistance >= zone.startDistance ? 1 : -1)
        const toDir = zone.toDirection ?? fromDir
        const entries = [
          {
            trackId: zone.fromTrackId,
            entryDist: zone.startDistance,
            exitDist: zone.targetEndDistance,
            toTrackId: zone.toTrackId,
            direction: fromDir,
            reverseCurve: false,
          },
          {
            trackId: zone.toTrackId,
            entryDist: zone.targetEndDistance,
            exitDist: zone.startDistance,
            toTrackId: zone.fromTrackId,
            direction: -toDir as 1 | -1,
            reverseCurve: true,
          },
        ]

        let triggered = false

        for (const entry of entries) {
          if (this.trackId !== entry.trackId) continue

          const track = trackNet.tracks[this.trackId]
          if (!track) continue

          const trackLen = track.totalLength

          if (entry.direction === 1 && moveDist > 0) {
            let d0 = prevDist - entry.entryDist
            let d1 = this.distance - entry.entryDist

            if (track.isClosed) {
              d0 = shortestLoopDelta(entry.entryDist, prevDist, trackLen)
              d1 = shortestLoopDelta(entry.entryDist, this.distance, trackLen)
            }

            if (d0 <= 0 && d1 > 0 && d1 < 50) {
              const overflow = d1

              this.activeCrossovers.push({
                zone,
                fromTrackId: entry.trackId,
                toTrackId: entry.toTrackId,
                entryDist: entry.entryDist,
                exitDist: entry.exitDist,
                direction: 1,
                reverseCurve: entry.reverseCurve,
                progressDist: overflow,
              })

              this.trackId = entry.toTrackId
              this.distance = entry.exitDist + (overflow - zone.totalLength)
              triggered = true
              break
            }
          } else if (entry.direction === -1 && moveDist < 0) {
            let d0 = entry.entryDist - prevDist
            let d1 = entry.entryDist - this.distance

            if (track.isClosed) {
              d0 = shortestLoopDelta(prevDist, entry.entryDist, trackLen)
              d1 = shortestLoopDelta(this.distance, entry.entryDist, trackLen)
            }

            if (d0 <= 0 && d1 > 0 && d1 < 50) {
              const overflow = d1

              this.activeCrossovers.push({
                zone,
                fromTrackId: entry.trackId,
                toTrackId: entry.toTrackId,
                entryDist: entry.entryDist,
                exitDist: entry.exitDist,
                direction: -1,
                reverseCurve: entry.reverseCurve,
                progressDist: overflow,
              })

              this.trackId = entry.toTrackId
              this.distance = entry.exitDist - (overflow - zone.totalLength)
              triggered = true
              break
            }
          }
        }

        if (triggered) break
      }
    }

    const activeTrack = trackNet.tracks[this.trackId]
    const activeTrackLen = activeTrack.totalLength

    if (!activeTrack.isClosed) {
      const bufferStopEnd = activeTrackLen - 12
      const bufferStopStart = 12

      if (this.distance >= bufferStopEnd) {
        this.distance = bufferStopEnd

        if (!this.isCrashed) {
          this.crash('Collision with buffer stop at terminal dead track')
        }
      } else if (this.distance <= bufferStopStart) {
        this.distance = bufferStopStart

        if (!this.isCrashed) {
          this.crash('Collision with buffer stop at terminal dead track')
        }
      }
    } else {
      this.distance = wrap(this.distance, activeTrackLen)
    }

    const pFront = this.getVehiclePosition(0, trackNet)
    const pRear = this.getVehiclePosition(this.locoLength, trackNet)
    const da = angleDiff(pRear.angle, pFront.angle)

    const curvature = Math.abs(da) / this.locoLength
    const v_ms = (Math.abs(this.speed) * 0.42) / 3.6

    this.currentLateralAcc = v_ms * v_ms * curvature
    this.currentLateralG = +(this.currentLateralAcc / 9.81).toFixed(2)

    if (this.speedKmH > 22 && !this.isCrashed) {
      if (this.currentLateralAcc > this.criticalLateralAcc) {
        this.isDerailed = true
        this.crash(
          `Derailment on curve: excessive speed (${this.speedKmH} km/h). Lateral force reached ${this.currentLateralG} g, exceeding limit of ${(this.criticalLateralAcc / 9.81).toFixed(2)} g.`
        )
      }
    }
  }

  public getVehiclePosition(
    offset: number,
    trackNet: TrackNetwork
  ): { x: number; y: number; angle: number } {
    for (let i = this.activeCrossovers.length - 1; i >= 0; i--) {
      const cross = this.activeCrossovers[i]
      const d = cross.progressDist - offset

      if (d >= cross.zone.totalLength) {
        const toTrack = trackNet.tracks[cross.toTrackId]
        let dist =
          cross.exitDist + (d - cross.zone.totalLength) * cross.direction

        if (toTrack && toTrack.isClosed) {
          dist =
            ((dist % toTrack.totalLength) + toTrack.totalLength) %
            toTrack.totalLength
        }

        const pt = trackNet.getStaticPointAtDistance(cross.toTrackId, dist)
        const baseAngle = pt.angle

        return {
          x: pt.x,
          y: pt.y,
          angle: this.facing === 1 ? baseAngle : baseAngle + Math.PI,
        }
      }

      if (d >= 0) {
        const curveDist = cross.reverseCurve ? cross.zone.totalLength - d : d
        const pt = trackNet.getCrossoverPointAtDistance(cross.zone, curveDist)
        const curveDir = cross.zone.fromDirection ?? 1
        const baseAngle = curveDir === 1 ? pt.angle : pt.angle + Math.PI

        return {
          x: pt.x,
          y: pt.y,
          angle: this.facing === 1 ? baseAngle : baseAngle + Math.PI,
        }
      }

      if (i === 0) {
        const fromTrack = trackNet.tracks[cross.fromTrackId]
        let dist = cross.entryDist + d * cross.direction

        if (fromTrack && fromTrack.isClosed) {
          dist =
            ((dist % fromTrack.totalLength) + fromTrack.totalLength) %
            fromTrack.totalLength
        }

        const pt = trackNet.getStaticPointAtDistance(cross.fromTrackId, dist)
        const baseAngle = pt.angle

        return {
          x: pt.x,
          y: pt.y,
          angle: this.facing === 1 ? baseAngle : baseAngle + Math.PI,
        }
      }
    }

    const currentTrack = trackNet.tracks[this.trackId] || trackNet.tracks[0]
    const totalLen = currentTrack.totalLength
    let carrDist =
      this.facing === 1 ? this.distance - offset : this.distance + offset

    carrDist = !currentTrack.isClosed
      ? clamp(carrDist, 0, totalLen)
      : wrap(carrDist, totalLen)

    const pt = trackNet.getStaticPointAtDistance(this.trackId, carrDist)
    const angle = this.facing === 1 ? pt.angle : pt.angle + Math.PI

    return {
      x: pt.x,
      y: pt.y,
      angle,
    }
  }

  public getAllVehiclePositions(
    trackNet: TrackNetwork
  ): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = []
    const step = 8
    const len = this.totalTrainLength

    for (let d = 0; d <= len; d += step) {
      const pos = this.getVehiclePosition(d, trackNet)
      pts.push({ x: pos.x, y: pos.y })
    }

    const tailPos = this.getVehiclePosition(len, trackNet)
    pts.push({ x: tailPos.x, y: tailPos.y })

    return pts
  }

  public render(ctx: CanvasRenderingContext2D, trackNet: TrackNetwork): void {
    const positions: { x: number; y: number; angle: number }[] = []

    const locoPos = this.getVehiclePosition(0, trackNet)
    positions.push(locoPos)

    if (this.carriageCount > 0) {
      const locoToCarrSpacing =
        this.locoLength / 2 + this.couplerGap + this.carriageLength / 2
      const carrToCarrSpacing = this.carriageLength + this.couplerGap

      let cumulativeOffset = locoToCarrSpacing

      for (let i = 0; i < this.carriageCount; i++) {
        positions.push(this.getVehiclePosition(cumulativeOffset, trackNet))
        cumulativeOffset += carrToCarrSpacing
      }

      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 5

      for (let i = 0; i < positions.length - 1; i++) {
        const frontCar = positions[i]
        const rearCar = positions[i + 1]

        ctx.beginPath()
        ctx.moveTo(rearCar.x, rearCar.y)
        ctx.lineTo(frontCar.x, frontCar.y)
        ctx.stroke()
      }

      ctx.restore()

      for (let i = this.carriageCount; i >= 1; i--) {
        const pos = positions[i]
        let renderX = pos.x
        let renderY = pos.y
        let renderAngle = pos.angle

        if (this.isDerailed) {
          const skew = (i % 2 === 0 ? 1 : -1) * 0.16
          renderAngle += skew
          renderX += Math.cos(pos.angle + Math.PI / 2) * (i % 2 === 0 ? 6 : -6)
          renderY += Math.sin(pos.angle + Math.PI / 2) * (i % 2 === 0 ? 6 : -6)
        }

        const isLastCarriage = i === this.carriageCount
        this.renderCarriage(ctx, renderX, renderY, renderAngle, isLastCarriage)
      }
    }

    let locoX = locoPos.x
    let locoY = locoPos.y
    let locoAngle = locoPos.angle

    if (this.isDerailed) {
      locoAngle += 0.22
      locoX += Math.cos(locoPos.angle + Math.PI / 2) * 8
      locoY += Math.sin(locoPos.angle + Math.PI / 2) * 8
    }

    this.renderLocomotive(ctx, locoX, locoY, locoAngle)
  }

  private renderLocomotive(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number
  ): void {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)

    const w = this.locoLength
    const h = this.locoWidth
    const r = 3

    if (this.reverser === 1) {
      this.renderLightBeam(ctx, w / 2, 1)
    } else if (this.carriageCount === 0 && this.reverser === -1) {
      this.renderLightBeam(ctx, -w / 2, -1)
    }

    if (this.trainType === 'cargo') {
      ctx.fillStyle = '#ffffff'
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 2.5)
      ctx.fill()

      ctx.fillStyle = '#121215'
      ctx.fillRect(w / 2 - 8, -h / 2 + 3.5, 2.5, h - 7)
      ctx.fillRect(-w / 2 + 5.5, -h / 2 + 3.5, 2.5, h - 7)

      ctx.strokeStyle = '#383844'
      ctx.lineWidth = 1.2

      ctx.beginPath()
      ctx.moveTo(-w / 2 + 15, -3)
      ctx.lineTo(-w / 2 + 20, 0)
      ctx.lineTo(-w / 2 + 15, 3)

      ctx.moveTo(w / 2 - 15, -3)
      ctx.lineTo(w / 2 - 20, 0)
      ctx.lineTo(w / 2 - 15, 3)
      ctx.stroke()

      ctx.fillStyle = '#121215'
      ctx.fillRect(-4, -3, 8, 6)
    } else if (this.trainType === 'high_speed') {
      const noseStart = w / 2 - 12
      const noseFront = w / 2

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(-w / 2, -h / 2)
      ctx.lineTo(noseStart, -h / 2)
      ctx.bezierCurveTo(
        noseStart + 6,
        -h / 2,
        noseFront,
        -h / 2 + 4,
        noseFront,
        0
      )
      ctx.bezierCurveTo(
        noseFront,
        h / 2 - 4,
        noseStart + 6,
        h / 2,
        noseStart,
        h / 2
      )
      ctx.lineTo(-w / 2, h / 2)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#121215'
      ctx.beginPath()
      ctx.moveTo(noseStart + 1, -h / 2 + 2.5)
      ctx.bezierCurveTo(
        noseStart + 5,
        -h / 2 + 2.5,
        noseFront - 3,
        -4,
        noseFront - 3,
        0
      )
      ctx.bezierCurveTo(
        noseFront - 3,
        4,
        noseStart + 5,
        h / 2 - 2.5,
        noseStart + 1,
        h / 2 - 2.5
      )
      ctx.quadraticCurveTo(noseStart + 3, 0, noseStart + 1, -h / 2 + 2.5)
      ctx.fill()

      ctx.fillStyle = '#181820'
      ctx.fillRect(-w / 2 + 12, -2.5, 14, 5)

      ctx.strokeStyle = '#008cff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-w / 2, h / 2 - 2)
      ctx.lineTo(noseStart - 2, h / 2 - 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#ffffff'
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r)
      ctx.fill()

      ctx.fillStyle = '#121215'
      ctx.fillRect(w / 2 - 8, -h / 2 + 3, 3, h - 6)

      ctx.fillStyle = '#121215'
      ctx.fillRect(-w / 2 + 8, -h / 2 + 4, 12, 2)
      ctx.fillRect(-w / 2 + 8, h / 2 - 6, 12, 2)

      ctx.strokeStyle = '#383844'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 14, -h / 2 + 2)
      ctx.lineTo(-w / 2 + 20, 0)
      ctx.lineTo(-w / 2 + 14, h / 2 - 2)
      ctx.stroke()
    }

    if (this.isCrashed) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2.5
      this.drawRoundedRect(ctx, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, r + 2)
      ctx.stroke()

      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(w / 2 - 4, -5)
      ctx.lineTo(w / 2 + 4, 5)
      ctx.moveTo(w / 2 + 4, -5)
      ctx.lineTo(w / 2 - 4, 5)
      ctx.stroke()
    }

    const frontLampX =
      this.trainType === 'high_speed' ? w / 2 - 1.5 : w / 2 - 1.2
    const isFrontWhite = this.reverser !== -1
    this.renderLampPair(ctx, frontLampX, isFrontWhite)

    if (this.carriageCount === 0) {
      const isRearWhite = this.reverser === -1
      this.renderLampPair(ctx, -w / 2 + 1.2, isRearWhite)
    }

    ctx.restore()
  }

  private renderCarriage(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    isLastCarriage: boolean = false
  ): void {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)

    const w = this.carriageLength
    const h = this.carriageWidth
    const r = 3

    if (isLastCarriage && this.reverser === -1) {
      this.renderLightBeam(ctx, -w / 2, -1)
    }

    if (this.trainType === 'cargo') {
      ctx.fillStyle = '#ffffff'
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r)
      ctx.fill()

      ctx.fillStyle = '#121215'
      ctx.fillRect(-w / 2 + 4, -h / 2 + 3, 15, h - 6)
      ctx.fillRect(1, -h / 2 + 3, 15, h - 6)

      ctx.fillStyle = '#1e1e28'
      ctx.fillRect(-w / 2 + 6, -h / 2 + 5, 11, h - 10)
      ctx.fillRect(3, -h / 2 + 5, 11, h - 10)

      ctx.strokeStyle = '#383848'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 11.5, -h / 2 + 5)
      ctx.lineTo(-w / 2 + 11.5, h / 2 - 5)
      ctx.moveTo(8.5, -h / 2 + 5)
      ctx.lineTo(8.5, h / 2 - 5)
      ctx.stroke()
    } else if (this.trainType === 'high_speed') {
      ctx.fillStyle = '#ffffff'
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r)
      ctx.fill()

      ctx.fillStyle = '#121215'
      ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, 3.5)
      ctx.fillRect(-w / 2 + 4, h / 2 - 7.5, w - 8, 3.5)

      ctx.strokeStyle = '#008cff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-w / 2, h / 2 - 2)
      ctx.lineTo(w / 2, h / 2 - 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#ffffff'
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r)
      ctx.fill()

      ctx.fillStyle = '#121215'
      const numWindows = 3
      const winW = 5
      const winH = 2.5
      const spacing = 9
      const startX = -((numWindows - 1) * spacing) / 2

      for (let i = 0; i < numWindows; i++) {
        const wx = startX + i * spacing
        ctx.fillRect(wx - winW / 2, -h / 2 + 3, winW, winH)
        ctx.fillRect(wx - winW / 2, h / 2 - 3 - winH, winW, winH)
      }
    }

    if (isLastCarriage) {
      const isRearWhite = this.reverser === -1
      this.renderLampPair(ctx, -w / 2 + 1.2, isRearWhite)
    }

    ctx.restore()
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  private renderLightBeam(
    ctx: CanvasRenderingContext2D,
    originX: number,
    direction: 1 | -1
  ): void {
    const beamLen = 110
    const endX = originX + beamLen * direction
    const grad = ctx.createLinearGradient(originX, 0, endX, 0)
    grad.addColorStop(0, 'rgba(255, 255, 245, 0.18)')
    grad.addColorStop(0.35, 'rgba(255, 255, 245, 0.08)')
    grad.addColorStop(0.7, 'rgba(255, 255, 245, 0.02)')
    grad.addColorStop(1, 'rgba(255, 255, 245, 0)')

    ctx.save()
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(originX, -5)
    ctx.lineTo(endX, -18)
    ctx.lineTo(endX, 18)
    ctx.lineTo(originX, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private renderLampPair(
    ctx: CanvasRenderingContext2D,
    x: number,
    isWhite: boolean
  ): void {
    const haloColor = isWhite
      ? 'rgba(255, 255, 255, 0.25)'
      : 'rgba(239, 68, 68, 0.3)'
    const coreColor = isWhite ? '#ffffff' : '#ef4444'

    ctx.save()
    ctx.fillStyle = haloColor
    ctx.beginPath()
    ctx.arc(x, -3.8, 2.2, 0, Math.PI * 2)
    ctx.arc(x, 3.8, 2.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = coreColor
    ctx.beginPath()
    ctx.arc(x, -3.8, 1.3, 0, Math.PI * 2)
    ctx.arc(x, 3.8, 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
