import type { Point2D, TrackPoint, JunctionSwitch, SwitchState } from './types.ts';

export interface CrossoverZone {
  switchId: string;
  fromTrackId: number;
  toTrackId: number;
  startDistance: number;
  endDistance: number;
  targetStartDistance: number;
  targetEndDistance: number;
  path: TrackPoint[];
  totalLength: number;
}

export class TrackNetwork {
  public tracks: { points: TrackPoint[]; totalLength: number }[] = [];
  public switches: JunctionSwitch[] = [];
  public crossoverZones: CrossoverZone[] = [];
  public readonly trackSpacing = 44;

  constructor() {
    this.buildTracks();
    this.setupSwitchesAndCrossovers();
  }

  private getCatmullRomPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
    const t2 = t * t;
    const t3 = t2 * t;
    const f0 = -0.5 * t3 + t2 - 0.5 * t;
    const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const f3 = 0.5 * t3 - 0.5 * t2;

    return {
      x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
      y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3
    };
  }

  private buildTracks(): void {
    const waypoints: Point2D[] = [
      { x: 750, y: 520 },
      { x: 1250, y: 460 },
      { x: 1750, y: 520 },
      { x: 2140, y: 720 },
      { x: 2280, y: 1040 },
      { x: 2140, y: 1360 },
      { x: 1750, y: 1560 },
      { x: 1250, y: 1620 },
      { x: 750, y: 1560 },
      { x: 420, y: 1360 },
      { x: 280, y: 1040 },
      { x: 420, y: 720 }
    ];

    const N = waypoints.length;
    const rawPoints: Point2D[] = [];
    const stepsPerSeg = 80;

    for (let i = 0; i < N; i++) {
      const p0 = waypoints[(i - 1 + N) % N];
      const p1 = waypoints[i];
      const p2 = waypoints[(i + 1) % N];
      const p3 = waypoints[(i + 2) % N];

      for (let s = 0; s < stepsPerSeg; s++) {
        const t = s / stepsPerSeg;
        rawPoints.push(this.getCatmullRomPoint(p0, p1, p2, p3, t));
      }
    }

    let rawTotalLen = 0;

    for (let i = 0; i < rawPoints.length; i++) {
      const next = rawPoints[(i + 1) % rawPoints.length];
      rawTotalLen += Math.hypot(next.x - rawPoints[i].x, next.y - rawPoints[i].y);
    }

    const numSamples = Math.round(rawTotalLen / 4);
    const centerPoints: Point2D[] = [];
    let rawIdx = 0;
    let currentDist = 0;

    for (let i = 0; i < numSamples; i++) {
      const targetDist = (i / numSamples) * rawTotalLen;

      while (rawIdx < rawPoints.length - 1) {
        const next = rawPoints[(rawIdx + 1) % rawPoints.length];
        const seg = Math.hypot(next.x - rawPoints[rawIdx].x, next.y - rawPoints[rawIdx].y);

        if (currentDist + seg >= targetDist) break;

        currentDist += seg;
        rawIdx++;
      }

      const pA = rawPoints[rawIdx];
      const pB = rawPoints[(rawIdx + 1) % rawPoints.length];
      const seg = Math.hypot(pB.x - pA.x, pB.y - pA.y) || 1;
      const t = Math.max(0, Math.min(1, (targetDist - currentDist) / seg));

      centerPoints.push({
        x: pA.x + (pB.x - pA.x) * t,
        y: pA.y + (pB.y - pA.y) * t
      });
    }

    const generateOffsetTrack = (offsetD: number) => {
      const pts: TrackPoint[] = [];

      for (let i = 0; i < centerPoints.length; i++) {
        const prev = centerPoints[(i - 1 + centerPoints.length) % centerPoints.length];
        const next = centerPoints[(i + 1) % centerPoints.length];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const tx = dx / len;
        const ty = dy / len;
        const nx = -ty;
        const ny = tx;
        const angle = Math.atan2(ty, tx);

        pts.push({
          x: centerPoints[i].x + nx * offsetD,
          y: centerPoints[i].y + ny * offsetD,
          angle,
          normalX: nx,
          normalY: ny,
          distance: 0
        });
      }

      let dist = 0;

      for (let i = 0; i < pts.length; i++) {
        pts[i].distance = dist;
        const next = pts[(i + 1) % pts.length];
        dist += Math.hypot(next.x - pts[i].x, next.y - pts[i].y);
      }

      return { points: pts, totalLength: dist };
    };

    const track0 = generateOffsetTrack(22);
    const track1 = generateOffsetTrack(-22);

    this.tracks.push(track0, track1);

    const sidingBranchDistT1 = 588;
    const sidingBranchPt = this.getStaticPointAtDistance(1, sidingBranchDistT1);
    const sidingPoints: TrackPoint[] = [];
    let sidingDist = 0;

    const pEndCurve = { x: 1540, y: 330, angle: 0 };
    const curveTurnout = this.sampleBézierCurve(
      { x: sidingBranchPt.x, y: sidingBranchPt.y, angle: sidingBranchPt.angle },
      pEndCurve,
      50
    );

    sidingPoints.push(...curveTurnout.points);
    sidingDist = curveTurnout.totalLength;

    const straightLen = 1950 - 1540;
    const straightSteps = Math.round(straightLen / 4);

    for (let i = 1; i <= straightSteps; i++) {
      const x = 1540 + (i / straightSteps) * straightLen;
      const y = 330;
      const prev = sidingPoints[sidingPoints.length - 1];

      sidingDist += Math.hypot(x - prev.x, y - prev.y);

      sidingPoints.push({
        x,
        y,
        angle: 0,
        distance: sidingDist,
        normalX: 0,
        normalY: -1
      });
    }

    this.tracks.push({ points: sidingPoints, totalLength: sidingDist });
  }

  private setupSwitchesAndCrossovers(): void {
    const sidingBranchDistT1 = 588;
    const sidingBranchPt = this.getStaticPointAtDistance(1, sidingBranchDistT1);

    const turnoutCurve = this.sampleBézierCurve(
      { x: sidingBranchPt.x, y: sidingBranchPt.y, angle: sidingBranchPt.angle },
      { x: 1540, y: 330, angle: 0 },
      50
    );

    this.switches.push({
      id: 'sw-siding',
      name: 'Industrial Siding Switch (Track 2 Dead End)',
      fromTrackId: 1,
      toTrackId: 2,
      fromDistance: sidingBranchDistT1,
      toDistance: sidingBranchDistT1 + turnoutCurve.totalLength,
      state: 'straight',
      length: turnoutCurve.totalLength,
      path: turnoutCurve.points,
      worldX: sidingBranchPt.x,
      worldY: sidingBranchPt.y
    });

    this.crossoverZones.push({
      switchId: 'sw-siding',
      fromTrackId: 1,
      toTrackId: 2,
      startDistance: sidingBranchDistT1,
      endDistance: sidingBranchDistT1 + turnoutCurve.totalLength,
      targetStartDistance: 0,
      targetEndDistance: turnoutCurve.totalLength,
      path: turnoutCurve.points,
      totalLength: turnoutCurve.totalLength
    });

    const startDistT0 = 2841;
    const endDistT1 = 3191;
    const pStartT0 = this.getStaticPointAtDistance(0, startDistT0);
    const pEndT1 = this.getStaticPointAtDistance(1, endDistT1);

    const curve0to1 = this.sampleBézierCurve(
      { x: pStartT0.x, y: pStartT0.y, angle: pStartT0.angle },
      { x: pEndT1.x, y: pEndT1.y, angle: pEndT1.angle },
      50
    );

    this.switches.push({
      id: 'sw-crossover-0-1',
      name: 'South Crossover (Track 1 → 2)',
      fromTrackId: 0,
      toTrackId: 1,
      fromDistance: startDistT0,
      toDistance: startDistT0 + curve0to1.totalLength,
      state: 'straight',
      length: curve0to1.totalLength,
      path: curve0to1.points,
      worldX: pStartT0.x,
      worldY: pStartT0.y
    });

    this.crossoverZones.push({
      switchId: 'sw-crossover-0-1',
      fromTrackId: 0,
      toTrackId: 1,
      startDistance: startDistT0,
      endDistance: startDistT0 + curve0to1.totalLength,
      targetStartDistance: endDistT1 - curve0to1.totalLength,
      targetEndDistance: endDistT1,
      path: curve0to1.points,
      totalLength: curve0to1.totalLength
    });

    const startDistT1 = 2993;
    const endDistT0 = 3039;
    const pStartT1 = this.getStaticPointAtDistance(1, startDistT1);
    const pEndT0 = this.getStaticPointAtDistance(0, endDistT0);

    const curve1to0 = this.sampleBézierCurve(
      { x: pStartT1.x, y: pStartT1.y, angle: pStartT1.angle },
      { x: pEndT0.x, y: pEndT0.y, angle: pEndT0.angle },
      50
    );

    this.switches.push({
      id: 'sw-crossover-1-0',
      name: 'South Crossover (Track 2 → 1)',
      fromTrackId: 1,
      toTrackId: 0,
      fromDistance: startDistT1,
      toDistance: startDistT1 + curve1to0.totalLength,
      state: 'straight',
      length: curve1to0.totalLength,
      path: curve1to0.points,
      worldX: pStartT1.x,
      worldY: pStartT1.y
    });

    this.crossoverZones.push({
      switchId: 'sw-crossover-1-0',
      fromTrackId: 1,
      toTrackId: 0,
      startDistance: startDistT1,
      endDistance: startDistT1 + curve1to0.totalLength,
      targetStartDistance: endDistT0 - curve1to0.totalLength,
      targetEndDistance: endDistT0,
      path: curve1to0.points,
      totalLength: curve1to0.totalLength
    });
  }

  private sampleBézierCurve(
    start: { x: number; y: number; angle: number },
    end: { x: number; y: number; angle: number },
    steps: number
  ): { points: TrackPoint[]; totalLength: number } {
    const raw: Point2D[] = [];
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const cpDist = dist * 0.45;

    const cp1x = start.x + Math.cos(start.angle) * cpDist;
    const cp1y = start.y + Math.sin(start.angle) * cpDist;
    const cp2x = end.x - Math.cos(end.angle) * cpDist;
    const cp2y = end.y - Math.sin(end.angle) * cpDist;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const it = 1 - t;
      const x = it * it * it * start.x + 3 * it * it * t * cp1x + 3 * it * t * t * cp2x + t * t * t * end.x;
      const y = it * it * it * start.y + 3 * it * it * t * cp1y + 3 * it * t * t * cp2y + t * t * t * end.y;

      raw.push({ x, y });
    }

    const points: TrackPoint[] = [];
    let cumulative = 0;

    for (let i = 0; i < raw.length; i++) {
      const curr = raw[i];
      const next = raw[Math.min(raw.length - 1, i + 1)];
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const angle = (dx === 0 && dy === 0) ? start.angle : Math.atan2(dy, dx);

      points.push({
        x: curr.x,
        y: curr.y,
        angle,
        distance: cumulative,
        normalX: -Math.sin(angle),
        normalY: Math.cos(angle)
      });

      cumulative += Math.hypot(dx, dy);
    }

    return { points, totalLength: cumulative };
  }

  public isSwitchOccupied(
    switchId: string,
    trainTrackId: number,
    trainHeadDist: number,
    trainTailDist: number,
    activeTransitionSwitchId?: string | null
  ): boolean {
    if (activeTransitionSwitchId && activeTransitionSwitchId === switchId) {
      return true;
    }

    const sw = this.switches.find(s => s.id === switchId);

    if (!sw) return false;

    const margin = 35;
    const zones = this.crossoverZones.filter(z => z.switchId === switchId);

    for (const zone of zones) {
      if (trainTrackId === zone.fromTrackId) {
        const trackLen = this.tracks[zone.fromTrackId].totalLength;
        const minD = Math.min(zone.startDistance, zone.endDistance) - margin;
        const maxD = Math.max(zone.startDistance, zone.endDistance) + margin;

        if (this.isSpanOverlapping(trainTailDist, trainHeadDist, minD, maxD, trackLen)) {
          return true;
        }
      }

      if (trainTrackId === zone.toTrackId) {
        const trackLen = this.tracks[zone.toTrackId].totalLength;
        const minD = Math.min(zone.targetStartDistance, zone.targetEndDistance) - margin;
        const maxD = Math.max(zone.targetStartDistance, zone.targetEndDistance) + margin;

        if (this.isSpanOverlapping(trainTailDist, trainHeadDist, minD, maxD, trackLen)) {
          return true;
        }
      }
    }

    if (trainTrackId === sw.fromTrackId) {
      const trackLen = this.tracks[sw.fromTrackId].totalLength;
      const minD = Math.min(sw.fromDistance, sw.toDistance) - margin;
      const maxD = Math.max(sw.fromDistance, sw.toDistance) + margin;

      if (this.isSpanOverlapping(trainTailDist, trainHeadDist, minD, maxD, trackLen)) {
        return true;
      }
    }

    return false;
  }

  private isSpanOverlapping(
    tailDist: number,
    headDist: number,
    zoneStart: number,
    zoneEnd: number,
    trackLen: number
  ): boolean {
    const norm = (d: number) => ((d % trackLen) + trackLen) % trackLen;
    const s = norm(tailDist);
    const e = norm(headDist);
    const zs = norm(zoneStart);
    const ze = norm(zoneEnd);

    if (zs <= ze) {
      if (s <= e) {
        return Math.max(s, zs) < Math.min(e, ze);
      } else {
        return s < ze || e > zs;
      }
    } else {
      if (s <= e) {
        return s < ze || e > zs;
      } else {
        return true;
      }
    }
  }

  public getStaticPointAtDistance(trackId: number, s: number): { x: number; y: number; angle: number } {
    const track = this.tracks[trackId] || this.tracks[0];
    const isClosedLoop = trackId < 2;
    const normS = isClosedLoop
      ? ((s % track.totalLength) + track.totalLength) % track.totalLength
      : Math.max(0, Math.min(track.totalLength, s));

    let low = 0;
    let high = track.points.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;

      if (track.points[mid].distance < normS) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx1 = Math.max(0, low - 1);
    const idx2 = isClosedLoop ? (idx1 + 1) % track.points.length : Math.min(track.points.length - 1, idx1 + 1);

    const p1 = track.points[idx1];
    const p2 = track.points[idx2];

    let segLen = p2.distance - p1.distance;

    if (segLen < 0 && isClosedLoop) segLen += track.totalLength;

    let t = 0;

    if (segLen > 0.0001) {
      let dFromP1 = normS - p1.distance;

      if (dFromP1 < 0 && isClosedLoop) dFromP1 += track.totalLength;

      t = Math.min(1, Math.max(0, dFromP1 / segLen));
    }

    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;

    let da = p2.angle - p1.angle;

    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;

    const angle = p1.angle + da * t;

    return { x, y, angle };
  }

  public getPointAtDistance(trackId: number, s: number): { x: number; y: number; angle: number } {
    const track = this.tracks[trackId] || this.tracks[0];
    const isClosedLoop = trackId < 2;
    const normS = isClosedLoop
      ? ((s % track.totalLength) + track.totalLength) % track.totalLength
      : Math.max(0, Math.min(track.totalLength, s));

    for (const zone of this.crossoverZones) {
      if (zone.fromTrackId === trackId) {
        const sw = this.switches.find(x => x.id === zone.switchId);

        if (sw && sw.state === 'diverging') {
          if (normS >= zone.startDistance && normS <= zone.endDistance) {
            const progress = (normS - zone.startDistance) / (zone.endDistance - zone.startDistance);
            return this.sampleCrossoverPoint(zone, progress);
          }
        }
      }
    }

    return this.getStaticPointAtDistance(trackId, s);
  }

  public sampleCrossoverPoint(zone: CrossoverZone, t: number): { x: number; y: number; angle: number } {
    const clampedT = Math.max(0, Math.min(1, t));
    const targetDist = clampedT * zone.totalLength;

    const pts = zone.path;
    let low = 0;
    let high = pts.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;

      if (pts[mid].distance < targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx1 = Math.max(0, low - 1);
    const idx2 = Math.min(pts.length - 1, idx1 + 1);

    const p1 = pts[idx1];
    const p2 = pts[idx2];
    const span = p2.distance - p1.distance || 1;
    const localT = Math.max(0, Math.min(1, (targetDist - p1.distance) / span));

    let da = p2.angle - p1.angle;

    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;

    const angle = p1.angle + da * localT;

    return {
      x: p1.x + (p2.x - p1.x) * localT,
      y: p1.y + (p2.y - p1.y) * localT,
      angle
    };
  }

  public toggleSwitch(switchId: string): SwitchState | null {
    const sw = this.switches.find(s => s.id === switchId);

    if (!sw) return null;

    sw.state = sw.state === 'straight' ? 'diverging' : 'straight';
    return sw.state;
  }

  public findSwitchAt(worldX: number, worldY: number, radius: number = 24): JunctionSwitch | null {
    for (const sw of this.switches) {
      const d = Math.hypot(sw.worldX - worldX, sw.worldY - worldY);

      if (d <= radius) return sw;
    }

    return null;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let trackId = 0; trackId < 2; trackId++) {
      const track = this.tracks[trackId];

      if (!track || track.points.length < 2) continue;

      ctx.strokeStyle = '#4a4a54';
      ctx.lineWidth = 7;

      ctx.beginPath();
      ctx.moveTo(track.points[0].x, track.points[0].y);

      for (let i = 1; i < track.points.length; i++) {
        ctx.lineTo(track.points[i].x, track.points[i].y);
      }

      ctx.closePath();
      ctx.stroke();
    }

    const deadTrack = this.tracks[2];

    if (deadTrack && deadTrack.points.length >= 2) {
      ctx.strokeStyle = '#4a4a54';
      ctx.lineWidth = 7;

      ctx.beginPath();
      ctx.moveTo(deadTrack.points[0].x, deadTrack.points[0].y);

      for (let i = 1; i < deadTrack.points.length; i++) {
        ctx.lineTo(deadTrack.points[i].x, deadTrack.points[i].y);
      }

      ctx.stroke();

      const bufferPt = deadTrack.points[deadTrack.points.length - 1];
      this.renderBufferStop(ctx, bufferPt.x, bufferPt.y, bufferPt.angle);
    }

    for (const sw of this.switches) {
      if (sw.path.length < 2) continue;

      ctx.strokeStyle = sw.state === 'diverging' ? '#ffffff' : '#33333b';
      ctx.lineWidth = 6;

      ctx.beginPath();
      ctx.moveTo(sw.path[0].x, sw.path[0].y);

      for (let i = 1; i < sw.path.length; i++) {
        ctx.lineTo(sw.path[i].x, sw.path[i].y);
      }

      ctx.stroke();

      ctx.save();
      ctx.translate(sw.worldX, sw.worldY);

      ctx.fillStyle = '#18181d';
      ctx.strokeStyle = sw.state === 'diverging' ? '#008cff' : '#71717a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeRect(-9, -9, 18, 18);

      ctx.strokeStyle = sw.state === 'diverging' ? '#008cff' : '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();

      if (sw.state === 'straight') {
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.lineTo(2, -3);
        ctx.moveTo(5, 0);
        ctx.lineTo(2, 3);
      } else {
        ctx.moveTo(-4, 3);
        ctx.lineTo(4, -3);
        ctx.lineTo(4, 1);
        ctx.moveTo(4, -3);
        ctx.lineTo(0, -3);
      }

      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  private renderBufferStop(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = '#27272a';
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-10, -18, 8, 36);
    ctx.strokeRect(-10, -18, 8, 36);

    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -9, 4, 0, Math.PI * 2);
    ctx.arc(-2, 9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const beamW = 10;
    const beamH = 40;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, -beamH / 2, beamW, beamH);
    ctx.clip();

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, -beamH / 2, beamW, beamH);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    for (let i = -beamH / 2 - 10; i < beamH / 2 + 10; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(beamW, i + 8);
      ctx.stroke();
    }

    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -beamH / 2, beamW, beamH);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(beamW + 3, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
