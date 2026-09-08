import { TrackNetwork, type CrossoverZone } from './track.ts';
import type { ReverserPosition } from './types.ts';

export class Train {
  public trackId: number = 0;
  public distance: number = 0;
  public speed: number = 0;

  public activeTransition: {
    zone: CrossoverZone;
    distSinceExit: number;
    direction: 1 | -1;
  } | null = null;

  public throttle: number = 0;
  public brake: number = 0;
  public reverser: ReverserPosition = 1;

  public targetThrottle: number = 0;
  public targetBrake: number = 0;

  public readonly locoLength = 46;
  public readonly locoWidth = 18;
  public readonly carriageLength = 42;
  public readonly carriageWidth = 18;
  public readonly couplerGap = 3;
  public carriageCount: number = 3;

  private readonly rollingFriction = 0.015;
  private readonly airDragCoeff = 0.000004;

  public isEmergencyBrakeLocked: boolean = false;
  public emergencyBrakeReason: string | null = null;

  public isCrashed: boolean = false;
  public crashReason: string | null = null;

  constructor(trackNet: TrackNetwork) {
    this.spawnRandom(trackNet);
  }

  public get totalWeightTons(): number {
    return 80 + this.carriageCount * 38;
  }

  public get maxSpeedFwd(): number {
    const weightFactor = (this.totalWeightTons - 80) / 380;
    const maxKmh = 220 - weightFactor * 95;

    return maxKmh / 0.42;
  }

  public get maxSpeedRev(): number {
    const weightFactor = (this.totalWeightTons - 80) / 380;
    const maxKmh = 80 - weightFactor * 35;

    return maxKmh / 0.42;
  }

  public get currentMaxAccel(): number {
    return 36 * (120 / (this.totalWeightTons + 40));
  }

  public get currentServiceBrake(): number {
    return 34 * (140 / (this.totalWeightTons + 60));
  }

  public get currentEmergencyBrake(): number {
    return 65 * (140 / (this.totalWeightTons + 60));
  }

  public setCarriageCount(count: number): void {
    this.carriageCount = Math.max(0, Math.min(10, Math.round(count)));
  }

  public get totalTrainLength(): number {
    if (this.carriageCount === 0) return this.locoLength;

    const locoToCarr = (this.locoLength / 2) + this.couplerGap + (this.carriageLength / 2);
    const carrToCarr = this.carriageLength + this.couplerGap;

    return locoToCarr + (this.carriageCount - 1) * carrToCarr + (this.carriageLength / 2);
  }

  public get headDistance(): number {
    return this.distance;
  }

  public get tailDistance(): number {
    return this.distance - this.totalTrainLength;
  }

  public spawnRandom(trackNet: TrackNetwork): void {
    this.isCrashed = false;
    this.crashReason = null;
    this.isEmergencyBrakeLocked = false;
    this.emergencyBrakeReason = null;

    this.trackId = Math.random() < 0.5 ? 0 : 1;
    const currentTrack = trackNet.tracks[this.trackId];

    this.distance = Math.random() * currentTrack.totalLength;
    this.speed = 0;
    this.throttle = 0;
    this.targetThrottle = 0;
    this.brake = 0;
    this.targetBrake = 0;
    this.reverser = 1;
    this.activeTransition = null;
  }

  public crash(reason: string): void {
    this.isCrashed = true;
    this.crashReason = reason;
    this.speed = 0;
    this.throttle = 0;
    this.targetThrottle = 0;
    this.brake = 1.0;
    this.targetBrake = 1.0;
    this.isEmergencyBrakeLocked = true;
    this.emergencyBrakeReason = reason;
  }

  public tripEmergencyBrake(reason: string): void {
    if (this.isCrashed) return;

    this.isEmergencyBrakeLocked = true;
    this.emergencyBrakeReason = reason;
    this.targetThrottle = 0;
    this.throttle = 0;
    this.targetBrake = 1.0;
  }

  public resetEmergencyBrake(): boolean {
    if (this.isCrashed) return false;

    if (Math.abs(this.speed) < 0.01) {
      this.isEmergencyBrakeLocked = false;
      this.emergencyBrakeReason = null;
      this.targetBrake = 0;

      return true;
    }

    return false;
  }

  public get speedKmH(): number {
    return Math.round(Math.abs(this.speed) * 0.42);
  }

  public update(dt: number, trackNet: TrackNetwork): void {
    if (this.isEmergencyBrakeLocked) {
      this.targetThrottle = 0;
      this.throttle = 0;
      this.targetBrake = 1.0;
    }

    const leverRampSpeed = 0.6;

    if (this.throttle < this.targetThrottle) {
      this.throttle = Math.min(this.targetThrottle, this.throttle + leverRampSpeed * dt);
    } else if (this.throttle > this.targetThrottle) {
      this.throttle = Math.max(this.targetThrottle, this.throttle - leverRampSpeed * dt);
    }

    if (this.brake < this.targetBrake) {
      this.brake = Math.min(this.targetBrake, this.brake + leverRampSpeed * dt);
    } else if (this.brake > this.targetBrake) {
      this.brake = Math.max(this.targetBrake, this.brake - leverRampSpeed * dt);
    }

    let tractiveAcc = 0;

    if (!this.isEmergencyBrakeLocked && this.reverser !== 0 && this.throttle > 0) {
      const currentMax = this.reverser > 0 ? this.maxSpeedFwd : this.maxSpeedRev;
      const speedRatio = Math.min(1, Math.max(0, Math.abs(this.speed) / currentMax));
      const powerCurve = Math.max(0.05, 1 - Math.pow(speedRatio, 2));

      tractiveAcc = this.throttle * this.currentMaxAccel * powerCurve * this.reverser;
    }

    let brakeDecel = 0;

    if (this.brake > 0) {
      const brakeRate = this.isEmergencyBrakeLocked ? this.currentEmergencyBrake : this.currentServiceBrake;
      brakeDecel = this.brake * brakeRate;
    }

    const dir = Math.sign(this.speed);
    const drag = dir * this.airDragCoeff * this.speed * this.speed;
    const rolling = dir * this.rollingFriction;

    let netAcc = tractiveAcc - drag;

    if (this.speed !== 0) {
      netAcc -= dir * brakeDecel + rolling;
    }

    const prevSpeed = this.speed;
    this.speed += netAcc * dt;

    if (tractiveAcc === 0 && Math.abs(prevSpeed) > 0.0001) {
      if ((prevSpeed > 0 && this.speed <= 0) || (prevSpeed < 0 && this.speed >= 0)) {
        this.speed = 0;
      }
    }

    if (this.speed > this.maxSpeedFwd) this.speed = this.maxSpeedFwd;
    if (this.speed < -this.maxSpeedRev) this.speed = -this.maxSpeedRev;

    const prevDist = this.distance;
    const moveDist = this.speed * dt;
    this.distance += moveDist;

    if (this.activeTransition) {
      this.activeTransition.distSinceExit += moveDist;

      if (this.activeTransition.distSinceExit >= this.totalTrainLength + 30) {
        this.activeTransition = null;
      } else if (this.activeTransition.distSinceExit < 0) {
        this.trackId = this.activeTransition.zone.fromTrackId;
        this.distance = this.activeTransition.zone.endDistance + this.activeTransition.distSinceExit;
        this.activeTransition = null;
      }
    }

    for (const zone of trackNet.crossoverZones) {
      if (zone.fromTrackId === this.trackId) {
        const sw = trackNet.switches.find(s => s.id === zone.switchId);

        if (sw && sw.state === 'diverging') {
          if (moveDist > 0 && prevDist <= zone.endDistance && this.distance > zone.endDistance) {
            const overflow = this.distance - zone.endDistance;
            this.trackId = zone.toTrackId;
            this.distance = zone.targetEndDistance + overflow;
            this.activeTransition = { zone, distSinceExit: overflow, direction: 1 };
            break;
          } else if (moveDist < 0 && prevDist >= zone.startDistance && this.distance < zone.startDistance) {
            const overflow = zone.startDistance - this.distance;
            this.trackId = zone.toTrackId;
            this.distance = zone.targetStartDistance - overflow;
            this.activeTransition = { zone, distSinceExit: -overflow, direction: -1 };
            break;
          }
        }
      }
    }

    const activeTrackLen = trackNet.tracks[this.trackId].totalLength;

    if (this.trackId === 2) {
      const bufferStopDist = activeTrackLen - 12;

      if (this.distance >= bufferStopDist) {
        this.distance = bufferStopDist;

        if (!this.isCrashed) {
          this.crash('Collision with buffer stop at terminal dead track');
        }
      } else if (this.distance < 0) {
        this.distance = 0;
      }
    } else {
      this.distance = ((this.distance % activeTrackLen) + activeTrackLen) % activeTrackLen;
    }
  }

  public getVehiclePosition(offset: number, trackNet: TrackNetwork): { x: number; y: number; angle: number } {
    if (this.activeTransition) {
      const zone = this.activeTransition.zone;
      const X = this.activeTransition.distSinceExit - offset;

      if (X >= 0) {
        const targetDist = zone.targetEndDistance + X;
        return trackNet.getPointAtDistance(zone.toTrackId, targetDist);
      } else if (X >= -zone.totalLength) {
        const distOnCurve = zone.totalLength + X;
        const progress = Math.max(0, Math.min(1, distOnCurve / zone.totalLength));
        return trackNet.sampleCrossoverPoint(zone, progress);
      } else {
        const distBeforeStart = -zone.totalLength - X;
        const fromDist = zone.startDistance - distBeforeStart;
        return trackNet.getStaticPointAtDistance(zone.fromTrackId, fromDist);
      }
    }

    const currentTrack = trackNet.tracks[this.trackId] || trackNet.tracks[0];
    const totalLen = currentTrack.totalLength;
    let carrDist = this.distance - offset;

    if (this.trackId === 2) {
      carrDist = Math.max(0, carrDist);
    } else {
      carrDist = ((carrDist % totalLen) + totalLen) % totalLen;
    }

    return trackNet.getPointAtDistance(this.trackId, carrDist);
  }

  public render(ctx: CanvasRenderingContext2D, trackNet: TrackNetwork): void {
    const positions: { x: number; y: number; angle: number }[] = [];

    const locoPos = this.getVehiclePosition(0, trackNet);
    positions.push(locoPos);

    if (this.carriageCount > 0) {
      const locoToCarrSpacing = (this.locoLength / 2) + this.couplerGap + (this.carriageLength / 2);
      const carrToCarrSpacing = this.carriageLength + this.couplerGap;

      let cumulativeOffset = locoToCarrSpacing;

      for (let i = 0; i < this.carriageCount; i++) {
        positions.push(this.getVehiclePosition(cumulativeOffset, trackNet));
        cumulativeOffset += carrToCarrSpacing;
      }

      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;

      for (let i = 0; i < positions.length - 1; i++) {
        const frontCar = positions[i];
        const rearCar = positions[i + 1];

        ctx.beginPath();
        ctx.moveTo(rearCar.x, rearCar.y);
        ctx.lineTo(frontCar.x, frontCar.y);
        ctx.stroke();
      }

      ctx.restore();

      for (let i = this.carriageCount; i >= 1; i--) {
        const pos = positions[i];
        this.renderCarriage(ctx, pos.x, pos.y, pos.angle, i);
      }
    }

    this.renderLocomotive(ctx, locoPos.x, locoPos.y, locoPos.angle);
  }

  private renderLocomotive(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const w = this.locoLength;
    const h = this.locoWidth;
    const r = 3;

    ctx.fillStyle = '#ffffff';
    this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();

    ctx.fillStyle = '#121215';
    ctx.fillRect(w / 2 - 8, -h / 2 + 3, 3, h - 6);

    ctx.fillStyle = '#121215';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 4, 12, 2);
    ctx.fillRect(-w / 2 + 8, h / 2 - 6, 12, 2);

    if (this.isCrashed) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      this.drawRoundedRect(ctx, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, r + 2);
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 4, -5);
      ctx.lineTo(w / 2 + 4, 5);
      ctx.moveTo(w / 2 + 4, -5);
      ctx.lineTo(w / 2 - 4, 5);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderCarriage(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, _index: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const w = this.carriageLength;
    const h = this.carriageWidth;
    const r = 3;

    ctx.fillStyle = '#ffffff';
    this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();

    ctx.fillStyle = '#121215';
    const numWindows = 3;
    const winW = 5;
    const winH = 2.5;
    const spacing = 9;
    const startX = -((numWindows - 1) * spacing) / 2;

    for (let i = 0; i < numWindows; i++) {
      const wx = startX + i * spacing;
      ctx.fillRect(wx - winW / 2, -h / 2 + 3, winW, winH);
      ctx.fillRect(wx - winW / 2, h / 2 - 3 - winH, winW, winH);
    }

    ctx.restore();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
