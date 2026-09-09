import type { AdvancedSystemsConfig, DeadmanStatus } from '../types.ts'
import { DeadmanControlSystem, type DeadmanEvent } from './deadman.ts'
import { loadAdvancedConfig, saveAdvancedConfig } from '../utils/config.ts'

export class AdvancedSystemsManager {
  public deadman: DeadmanControlSystem
  private _config: AdvancedSystemsConfig

  constructor() {
    this._config = loadAdvancedConfig()
    this.deadman = new DeadmanControlSystem()
    this.syncSystemStates()
  }

  public get config(): AdvancedSystemsConfig {
    return { ...this._config }
  }

  public setAdvancedControls(enabled: boolean): void {
    this._config.advancedControls = enabled
    this.syncSystemStates()
    saveAdvancedConfig(this._config)
  }

  public setDeadman(enabled: boolean): void {
    this._config.deadman = enabled
    this.syncSystemStates()
    saveAdvancedConfig(this._config)
  }

  private syncSystemStates(): void {
    this.deadman.enabled = this._config.advancedControls && this._config.deadman

    if (!this.deadman.enabled) {
      this.deadman.reset()
    }
  }

  public update(
    dt: number,
    speedKmH: number,
    isEmergencyBrakeLocked: boolean
  ): DeadmanEvent | null {
    if (!this._config.advancedControls) {
      return null
    }

    return this.deadman.update(dt, speedKmH, isEmergencyBrakeLocked)
  }

  public acknowledgeDeadman(): boolean {
    if (!this._config.advancedControls || !this._config.deadman) {
      return false
    }

    return this.deadman.acknowledge()
  }

  public reset(): void {
    this.deadman.reset()
  }

  public getDeadmanStatus(speedKmH: number): DeadmanStatus {
    return this.deadman.getStatus(speedKmH)
  }
}
