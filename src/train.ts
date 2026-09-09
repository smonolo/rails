import { TrackNetwork, type CrossoverZone } from './track.ts';
import type { ReverserPosition, TrainType } from './types.ts';

export class Train {
  public trainType: TrainType = 'regional';

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

  public readonly couplerGap = 3;
  public carriageCount: number = 3;
  public facing: 1 | -1 = 1;

  public isEmergencyBrakeLocked: boolean = false;
  public emergencyBrakeReason: string | null = null;

  public isCrashed: boolean = false;
  public isDerailed: boolean = false;
  public crashReason: string | null = null;

  public currentLateralAcc: number = 0;
  public currentLateralG: number = 0;

  constructor(trackNet: TrackNetwork) {
    this.spawnRandom(trackNet);
  }

  public setTrainType(type: TrainType): void {
    this.trainType = type;

    if (type === 'cargo' && this.carriageCount < 4) {
      this.carriageCount = 4;
    } else if (type === 'high_speed' && this.carriageCount < 4) {
      this.carriageCount = 4;
    }
  }

  public get locoLength(): number {
    if (this.trainType === 'cargo') return 48;
    if (this.trainType === 'high_speed') return 48;
    return 46;
  }

  public get locoWidth(): number {
    return 18;
  }

  public get carriageLength(): number {
    return 42;
  }

  public get carriageWidth(): number {
    return 18;
  }

  public get totalWeightTons(): number {
    if (this.trainType === 'cargo') {
      return 88 + this.carriageCount * 74;
    }

    if (this.trainType === 'high_speed') {
      return 56 + this.carriageCount * 48;
    }

    return 84 + this.carriageCount * 48;
  }

  public get maxSpeedFwd(): number {
    if (this.trainType === 'cargo') {
      const weightTaper = (this.totalWeightTons - 88) / 740;
      const maxKmh = 120 - weightTaper * 20;
      return maxKmh / 0.42;
    }

    if (this.trainType === 'high_speed') {
      const weightTaper = (this.totalWeightTons - 56) / 480;
      const maxKmh = 330 - weightTaper * 40;
      return maxKmh / 0.42;
    }

    const weightTaper = (this.totalWeightTons - 84) / 480;
    const maxKmh = 160 - weightTaper * 20;

    return maxKmh / 0.42;
  }

  public get maxSpeedRev(): number {
    if (this.trainType === 'cargo') return 40 / 0.42;
    if (this.trainType === 'high_speed') return 100 / 0.42;
    return 80 / 0.42;
  }

  public get currentMaxAccel(): number {
    if (this.trainType === 'cargo') {
      return 18 * (200 / (this.totalWeightTons + 100));
    }

    if (this.trainType === 'high_speed') {
      return 48 * (150 / (this.totalWeightTons + 50));
    }

    return 34 * (160 / (this.totalWeightTons + 60));
  }

  public get currentServiceBrake(): number {
    if (this.trainType === 'cargo') {
      return 22 * (250 / (this.totalWeightTons + 100));
    }

    if (this.trainType === 'high_speed') {
      return 42 * (150 / (this.totalWeightTons + 50));
    }

    return 34 * (160 / (this.totalWeightTons + 60));
  }

  public get currentEmergencyBrake(): number {
    if (this.trainType === 'cargo') {
      return 48 * (250 / (this.totalWeightTons + 100));
    }

    if (this.trainType === 'high_speed') {
      return 80 * (150 / (this.totalWeightTons + 50));
    }

    return 65 * (160 / (this.totalWeightTons + 60));
  }

  public get criticalLateralAcc(): number {
    let base = 6.8;

    if (this.trainType === 'cargo') base = 4.6;
    if (this.trainType === 'high_speed') base = 8.5;

    const weightPenalty = Math.max(0.70, 1 - (this.totalWeightTons - 84) / 2800);

    return base * weightPenalty;
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
    return this.facing === 1 ? this.distance - this.totalTrainLength : this.distance + this.totalTrainLength;
  }

  public invert(trackNet?: TrackNetwork): void {
    if (this.facing === 1) {
      this.distance = this.distance - this.totalTrainLength;
      this.facing = -1;
    } else {
      this.distance = this.distance + this.totalTrainLength;
      this.facing = 1;
    }

    if (trackNet) {
      const activeTrack = trackNet.tracks[this.trackId];

      if (activeTrack) {
        if (activeTrack.isClosed) {
          this.distance = ((this.distance % activeTrack.totalLength) + activeTrack.totalLength) % activeTrack.totalLength;
        } else {
          this.distance = Math.max(15, Math.min(activeTrack.totalLength - 15, this.distance));
        }
      }
    }

    this.activeTransition = null;
    this.speed = 0;
    this.throttle = 0;
    this.targetThrottle = 0;
  }

  public spawnRandom(trackNet: TrackNetwork): void {
    this.isCrashed = false;
    this.isDerailed = false;
    this.crashReason = null;
    this.isEmergencyBrakeLocked = false;
    this.emergencyBrakeReason = null;
    this.facing = 1;

    this.trackId = Math.random() < 0.5 ? 0 : 1;
    this.facing = this.trackId === 0 ? 1 : -1;
    const currentTrack = trackNet.tracks[this.trackId];

    if (currentTrack) {
      if (currentTrack.isClosed) {
        this.distance = Math.random() * currentTrack.totalLength;
      } else {
        const margin = Math.min(1100, currentTrack.totalLength * 0.25);
        this.distance = margin + Math.random() * (currentTrack.totalLength - 2 * margin);
      }
    }
    this.speed = 0;
    this.throttle = 0;
    this.targetThrottle = 0;
    this.brake = 0;
    this.targetBrake = 0;
    this.reverser = 1;
    this.activeTransition = null;
    this.currentLateralAcc = 0;
    this.currentLateralG = 0;
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

    const leverRampSpeed = this.trainType === 'cargo' ? 0.45 : 0.65;

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

    const rollingFriction = this.trainType === 'cargo' ? 0.024 : 0.015;
    const airDragCoeff = this.trainType === 'high_speed' ? 0.000003 : 0.0000045;

    const dir = Math.sign(this.speed);
    const drag = dir * airDragCoeff * this.speed * this.speed;
    const rolling = dir * rollingFriction;

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
    const moveDist = this.speed * dt * this.facing;
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

    const activeTrack = trackNet.tracks[this.trackId];
    const activeTrackLen = activeTrack.totalLength;

    if (!activeTrack.isClosed) {
      const bufferStopEnd = activeTrackLen - 12;
      const bufferStopStart = 12;

      if (this.distance >= bufferStopEnd) {
        this.distance = bufferStopEnd;

        if (!this.isCrashed) {
          this.crash('Collision with buffer stop at terminal dead track');
        }
      } else if (this.distance <= bufferStopStart) {
        this.distance = bufferStopStart;

        if (!this.isCrashed) {
          this.crash('Collision with buffer stop at terminal dead track');
        }
      }
    } else {
      this.distance = ((this.distance % activeTrackLen) + activeTrackLen) % activeTrackLen;
    }

    const pFront = this.getVehiclePosition(0, trackNet);
    const pRear = this.getVehiclePosition(this.locoLength, trackNet);
    let da = pFront.angle - pRear.angle;

    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;

    const curvature = Math.abs(da) / this.locoLength;
    const v_ms = (Math.abs(this.speed) * 0.42) / 3.6;

    this.currentLateralAcc = (v_ms * v_ms) * curvature;
    this.currentLateralG = +(this.currentLateralAcc / 9.81).toFixed(2);

    if (this.speedKmH > 22 && !this.isCrashed) {
      if (this.currentLateralAcc > this.criticalLateralAcc) {
        this.isDerailed = true;
        this.crash(`Derailment on curve: excessive speed (${this.speedKmH} km/h). Lateral force reached ${this.currentLateralG} g, exceeding limit of ${(this.criticalLateralAcc / 9.81).toFixed(2)} g.`);
      }
    }
  }

  public getVehiclePosition(offset: number, trackNet: TrackNetwork): { x: number; y: number; angle: number } {
    if (this.activeTransition) {
      const zone = this.activeTransition.zone;
      const effectiveOffset = this.facing === 1 ? offset : -offset;
      const X = this.activeTransition.distSinceExit - effectiveOffset;

      if (X >= 0) {
        const targetDist = zone.targetEndDistance + X;
        const pt = trackNet.getPointAtDistance(zone.toTrackId, targetDist);

        return {
          x: pt.x,
          y: pt.y,
          angle: this.facing === 1 ? pt.angle : pt.angle + Math.PI
        };
      } else if (X >= -zone.totalLength) {
        const distOnCurve = zone.totalLength + X;
        const progress = Math.max(0, Math.min(1, distOnCurve / zone.totalLength));
        const pt = trackNet.sampleCrossoverPoint(zone, progress);

        return {
          x: pt.x,
          y: pt.y,
          angle: this.facing === 1 ? pt.angle : pt.angle + Math.PI
        };
      } else {
        const distBeforeStart = -zone.totalLength - X;
        const fromDist = zone.startDistance - distBeforeStart;
        const pt = trackNet.getStaticPointAtDistance(zone.fromTrackId, fromDist);

        return {
          x: pt.x,
          y: pt.y,
          angle: this.facing === 1 ? pt.angle : pt.angle + Math.PI
        };
      }
    }

    const currentTrack = trackNet.tracks[this.trackId] || trackNet.tracks[0];
    const totalLen = currentTrack.totalLength;
    let carrDist = this.facing === 1 ? this.distance - offset : this.distance + offset;

    if (!currentTrack.isClosed) {
      carrDist = Math.max(0, Math.min(totalLen, carrDist));
    } else {
      carrDist = ((carrDist % totalLen) + totalLen) % totalLen;
    }

    const pt = trackNet.getPointAtDistance(this.trackId, carrDist);

    return {
      x: pt.x,
      y: pt.y,
      angle: this.facing === 1 ? pt.angle : pt.angle + Math.PI
    };
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
      ctx.lineWidth = 5;

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
        let renderX = pos.x;
        let renderY = pos.y;
        let renderAngle = pos.angle;

        if (this.isDerailed) {
          const skew = (i % 2 === 0 ? 1 : -1) * 0.16;
          renderAngle += skew;
          renderX += Math.cos(pos.angle + Math.PI / 2) * (i % 2 === 0 ? 6 : -6);
          renderY += Math.sin(pos.angle + Math.PI / 2) * (i % 2 === 0 ? 6 : -6);
        }

        this.renderCarriage(ctx, renderX, renderY, renderAngle);
      }
    }

    let locoX = locoPos.x;
    let locoY = locoPos.y;
    let locoAngle = locoPos.angle;

    if (this.isDerailed) {
      locoAngle += 0.22;
      locoX += Math.cos(locoPos.angle + Math.PI / 2) * 8;
      locoY += Math.sin(locoPos.angle + Math.PI / 2) * 8;
    }

    this.renderLocomotive(ctx, locoX, locoY, locoAngle);
  }

  private renderLocomotive(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const w = this.locoLength;
    const h = this.locoWidth;
    const r = 3;

    if (this.trainType === 'cargo') {
      ctx.fillStyle = '#ffffff';
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 2.5);
      ctx.fill();

      ctx.fillStyle = '#121215';
      ctx.fillRect(w / 2 - 8, -h / 2 + 3.5, 2.5, h - 7);
      ctx.fillRect(-w / 2 + 5.5, -h / 2 + 3.5, 2.5, h - 7);

      ctx.strokeStyle = '#383844';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(-w / 2 + 15, -3);
      ctx.lineTo(-w / 2 + 20, 0);
      ctx.lineTo(-w / 2 + 15, 3);

      ctx.moveTo(w / 2 - 15, -3);
      ctx.lineTo(w / 2 - 20, 0);
      ctx.lineTo(w / 2 - 15, 3);
      ctx.stroke();

      ctx.fillStyle = '#121215';
      ctx.fillRect(-4, -3, 8, 6);
    } else if (this.trainType === 'high_speed') {
      const noseStart = w / 2 - 12;
      const noseFront = w / 2;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(noseStart, -h / 2);
      ctx.bezierCurveTo(noseStart + 6, -h / 2, noseFront, -h / 2 + 4, noseFront, 0);
      ctx.bezierCurveTo(noseFront, h / 2 - 4, noseStart + 6, h / 2, noseStart, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#121215';
      ctx.beginPath();
      ctx.moveTo(noseStart + 1, -h / 2 + 2.5);
      ctx.bezierCurveTo(noseStart + 5, -h / 2 + 2.5, noseFront - 3, -4, noseFront - 3, 0);
      ctx.bezierCurveTo(noseFront - 3, 4, noseStart + 5, h / 2 - 2.5, noseStart + 1, h / 2 - 2.5);
      ctx.quadraticCurveTo(noseStart + 3, 0, noseStart + 1, -h / 2 + 2.5);
      ctx.fill();

      ctx.fillStyle = '#181820';
      ctx.fillRect(-w / 2 + 12, -2.5, 14, 5);

      ctx.strokeStyle = '#008cff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2 - 2);
      ctx.lineTo(noseStart - 2, h / 2 - 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(noseFront - 1.5, -4, 1.2, 0, Math.PI * 2);
      ctx.arc(noseFront - 1.5, 4, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffffff';
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.fill();

      ctx.fillStyle = '#121215';
      ctx.fillRect(w / 2 - 8, -h / 2 + 3, 3, h - 6);

      ctx.fillStyle = '#121215';
      ctx.fillRect(-w / 2 + 8, -h / 2 + 4, 12, 2);
      ctx.fillRect(-w / 2 + 8, h / 2 - 6, 12, 2);

      ctx.strokeStyle = '#383844';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 14, -h / 2 + 2);
      ctx.lineTo(-w / 2 + 20, 0);
      ctx.lineTo(-w / 2 + 14, h / 2 - 2);
      ctx.stroke();
    }

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

  private renderCarriage(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const w = this.carriageLength;
    const h = this.carriageWidth;
    const r = 3;

    if (this.trainType === 'cargo') {
      ctx.fillStyle = '#ffffff';
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.fill();

      ctx.fillStyle = '#121215';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 3, 15, h - 6);
      ctx.fillRect(1, -h / 2 + 3, 15, h - 6);

      ctx.fillStyle = '#1e1e28';
      ctx.fillRect(-w / 2 + 6, -h / 2 + 5, 11, h - 10);
      ctx.fillRect(3, -h / 2 + 5, 11, h - 10);

      ctx.strokeStyle = '#383848';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 11.5, -h / 2 + 5);
      ctx.lineTo(-w / 2 + 11.5, h / 2 - 5);
      ctx.moveTo(8.5, -h / 2 + 5);
      ctx.lineTo(8.5, h / 2 - 5);
      ctx.stroke();
    } else if (this.trainType === 'high_speed') {
      ctx.fillStyle = '#ffffff';
      this.drawRoundedRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.fill();

      ctx.fillStyle = '#121215';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, 3.5);
      ctx.fillRect(-w / 2 + 4, h / 2 - 7.5, w - 8, 3.5);

      ctx.strokeStyle = '#008cff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2 - 2);
      ctx.lineTo(w / 2, h / 2 - 2);
      ctx.stroke();
    } else {
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
