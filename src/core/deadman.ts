import type { DeadmanStatus, DeadmanWarningStage } from '../types.ts'

export interface DeadmanEvent {
  type: 'visual' | 'urgent' | 'enforce' | 'cleared'
  reason?: string
}

export class DeadmanControlSystem {
  public enabled: boolean = true
  public timer: number = 0
  public stage: DeadmanWarningStage = 'none'
  public isEnforced: boolean = false

  public readonly visualTime: number = 30.0
  public readonly urgentTime: number = 32.5
  public readonly enforcementTime: number = 35.0

  public update(
    dt: number,
    speedKmH: number,
    isEmergencyBrakeLocked: boolean
  ): DeadmanEvent | null {
    if (!this.enabled) {
      this.timer = 0
      this.stage = 'none'
      this.isEnforced = false
      return null
    }

    if (this.isEnforced) {
      if (!isEmergencyBrakeLocked) {
        this.isEnforced = false
        this.timer = 0
        this.stage = 'none'
        return { type: 'cleared' }
      }
      return null
    }

    if (speedKmH === 0) {
      this.timer = 0
      this.stage = 'none'
      return null
    }

    this.timer += dt

    if (this.timer >= this.enforcementTime) {
      this.stage = 'enforced'
      this.isEnforced = true
      return {
        type: 'enforce',
        reason: 'Deadman control enforcement: vigilance unacknowledged',
      }
    }

    if (this.timer >= this.urgentTime) {
      const prev = this.stage
      this.stage = 'urgent'

      if (prev !== 'urgent') {
        return { type: 'urgent' }
      }
      return null
    }

    if (this.timer >= this.visualTime) {
      const prev = this.stage
      this.stage = 'visual'

      if (prev !== 'visual') {
        return { type: 'visual' }
      }
      return null
    }

    this.stage = 'none'
    return null
  }

  public acknowledge(): boolean {
    if (!this.enabled) return false

    this.timer = 0
    this.stage = 'none'

    return true
  }

  public reset(): void {
    this.timer = 0
    this.stage = 'none'
    this.isEnforced = false
  }

  public getStatus(speedKmH: number): DeadmanStatus {
    const active = this.enabled && speedKmH > 0 && !this.isEnforced
    const countdown = Math.max(
      0,
      +(this.enforcementTime - this.timer).toFixed(1)
    )

    return {
      enabled: this.enabled,
      active,
      stage: this.stage,
      timer: +this.timer.toFixed(1),
      maxTimer: this.enforcementTime,
      countdown,
      warningVisual:
        this.stage === 'visual' ||
        this.stage === 'urgent' ||
        this.stage === 'enforced',
      warningUrgent: this.stage === 'urgent',
      enforced: this.isEnforced,
    }
  }
}
