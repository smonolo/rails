import type { Point2D, TrackPoint, JunctionSwitch, SwitchState, TrackData, WorldShape, WorldSize } from './types.ts';
import type { WorldBounds } from './camera.ts';
import { PRNG } from './prng.ts';

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
  public tracks: TrackData[] = [];
  public switches: JunctionSwitch[] = [];
  public crossoverZones: CrossoverZone[] = [];
  public worldBounds: WorldBounds = { minX: 100, maxX: 2500, minY: 150, maxY: 1800 };
  public seed: number | string = 12345;
  public shape: WorldShape = 'O';
  public size: WorldSize = 'M';
  public readonly trackSpacing = 27;

  constructor(seed: number | string = 12345, shape?: WorldShape, size: WorldSize = 'M') {
    this.generate(seed, shape, size);
  }

  public generate(seed: number | string, shape?: WorldShape, size: WorldSize = 'M'): void {
    this.seed = seed;
    this.size = size;
    this.tracks = [];
    this.switches = [];
    this.crossoverZones = [];

    const prng = new PRNG(seed);

    if (shape) {
      this.shape = shape;
    } else {
      const archetypes: WorldShape[] = ['I', 'S', 'O'];
      this.shape = prng.choice(archetypes);
    }

    if (this.shape === 'I') {
      this.generateIShape(this.size);
    } else if (this.shape === 'S') {
      this.generateSShape(prng, this.size);
    } else {
      this.generateOShape(prng, this.size);
    }

    this.computeWorldBounds();
  }

  private computeWorldBounds(): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const track of this.tracks) {
      for (const pt of track.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    this.worldBounds = {
      minX: Math.floor(minX - 250),
      maxX: Math.ceil(maxX + 250),
      minY: Math.floor(minY - 220),
      maxY: Math.ceil(maxY + 220)
    };
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

  private sampleSpline(waypoints: Point2D[], isClosed: boolean): Point2D[] {
    const N = waypoints.length;
    const rawPoints: Point2D[] = [];
    const stepsPerSeg = 80;

    if (isClosed) {
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
    } else {
      for (let i = 0; i < N - 1; i++) {
        const p0 = waypoints[Math.max(0, i - 1)];
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const p3 = waypoints[Math.min(N - 1, i + 2)];

        for (let s = 0; s < stepsPerSeg; s++) {
          const t = s / stepsPerSeg;
          rawPoints.push(this.getCatmullRomPoint(p0, p1, p2, p3, t));
        }
      }
      rawPoints.push(waypoints[N - 1]);
    }

    let rawTotalLen = 0;
    const limit = isClosed ? rawPoints.length : rawPoints.length - 1;

    for (let i = 0; i < limit; i++) {
      const next = rawPoints[(i + 1) % rawPoints.length];
      rawTotalLen += Math.hypot(next.x - rawPoints[i].x, next.y - rawPoints[i].y);
    }

    const numSamples = Math.max(10, Math.round(rawTotalLen / 4));
    const centerPoints: Point2D[] = [];
    let rawIdx = 0;
    let currentDist = 0;

    for (let i = 0; i < numSamples; i++) {
      const targetDist = (i / (isClosed ? numSamples : numSamples - 1)) * rawTotalLen;

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

    return centerPoints;
  }

  private generateOffsetTracks(centerPoints: Point2D[], isClosed: boolean): void {
    const N = centerPoints.length;

    const buildTrack = (offsetD: number): TrackData => {
      const pts: TrackPoint[] = [];

      for (let i = 0; i < N; i++) {
        let prev: Point2D;
        let next: Point2D;

        if (isClosed) {
          prev = centerPoints[(i - 1 + N) % N];
          next = centerPoints[(i + 1) % N];
        } else {
          prev = centerPoints[Math.max(0, i - 1)];
          next = centerPoints[Math.min(N - 1, i + 1)];
        }

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

        if (i < pts.length - 1) {
          dist += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        } else if (isClosed) {
          dist += Math.hypot(pts[0].x - pts[i].x, pts[0].y - pts[i].y);
        }
      }

      return { points: pts, totalLength: dist, isClosed };
    };

    const track0 = buildTrack(13.5);
    const track1 = buildTrack(-13.5);

    this.tracks.push(track0, track1);
  }

  private generateIShape(size: WorldSize): void {
    let totalLen = 4600;
    let crossWest = 1250;
    let crossEast = 2800;
    let crossLen = 240;
    let crossGap = 80;

    if (size === 'S') {
      totalLen = 3200;
      crossWest = 900;
      crossEast = 2000;
      crossLen = 200;
      crossGap = 60;
    } else if (size === 'L') {
      totalLen = 7000;
      crossWest = 1900;
      crossEast = 4300;
      crossLen = 240;
      crossGap = 80;
    }

    const startX = 400;
    const centerY = 800;
    const pts0: TrackPoint[] = [];
    const pts1: TrackPoint[] = [];
    const numSamples = Math.round(totalLen / 2);
    const step = totalLen / (numSamples - 1);

    for (let i = 0; i < numSamples; i++) {
      const d = i * step;
      const x = startX + d;

      pts0.push({
        x,
        y: centerY - 13.5,
        angle: 0,
        distance: d,
        normalX: 0,
        normalY: -1
      });

      pts1.push({
        x,
        y: centerY + 13.5,
        angle: 0,
        distance: d,
        normalX: 0,
        normalY: 1
      });
    }

    this.tracks.push(
      { points: pts0, totalLength: totalLen, isClosed: false },
      { points: pts1, totalLength: totalLen, isClosed: false }
    );

    this.addSequentialCrossovers('sw-cross-w', 'West Crossover', crossWest, crossLen, crossGap);
    this.addSequentialCrossovers('sw-cross-e', 'East Crossover', crossEast, crossLen, crossGap);
  }

  private generateSShape(prng: PRNG, size: WorldSize): void {
    const startX = 400;
    const centerY = 1000;
    let deltaY = prng.range(260, 320);
    let waypoints: Point2D[];
    let crossWest = 1250;
    let crossEast = 3150;
    let crossLen = 240;
    let crossGap = 80;

    if (size === 'S') {
      deltaY = prng.range(180, 220);
      waypoints = [
        { x: startX, y: centerY },
        { x: startX + 630, y: centerY },
        { x: startX + 1100, y: centerY - deltaY },
        { x: startX + 1600, y: centerY },
        { x: startX + 2100, y: centerY + deltaY },
        { x: startX + 2570, y: centerY },
        { x: startX + 3200, y: centerY }
      ];
      crossWest = 900;
      crossEast = 2000;
      crossLen = 200;
      crossGap = 60;
    } else if (size === 'L') {
      deltaY = prng.range(380, 460);
      waypoints = [
        { x: startX, y: centerY },
        { x: startX + 1425, y: centerY },
        { x: startX + 2475, y: centerY - deltaY },
        { x: startX + 3600, y: centerY },
        { x: startX + 4725, y: centerY + deltaY },
        { x: startX + 5775, y: centerY },
        { x: startX + 7200, y: centerY }
      ];
      crossWest = 1900;
      crossEast = 4700;
      crossLen = 240;
      crossGap = 80;
    } else {
      waypoints = [
        { x: startX, y: centerY },
        { x: startX + 950, y: centerY },
        { x: startX + 1650, y: centerY - deltaY },
        { x: startX + 2400, y: centerY },
        { x: startX + 3150, y: centerY + deltaY },
        { x: startX + 3850, y: centerY },
        { x: startX + 4800, y: centerY }
      ];
    }

    const centerPoints = this.sampleSpline(waypoints, false);
    this.generateOffsetTracks(centerPoints, false);

    this.addSequentialCrossovers('sw-cross-w', 'West Crossover', crossWest, crossLen, crossGap);
    this.addSequentialCrossovers('sw-cross-e', 'East Crossover', crossEast, crossLen, crossGap);
  }

  private generateOShape(prng: PRNG, size: WorldSize): void {
    let centerX = 2400;
    let centerY = 1200;
    let rx = 1150 + prng.range(-30, 30);
    let ry = 700 + prng.range(-20, 20);
    let crossLen = 240;
    let crossGap = 80;

    if (size === 'S') {
      centerX = 1600;
      centerY = 1000;
      rx = 750 + prng.range(-20, 20);
      ry = 480 + prng.range(-15, 15);
      crossLen = 200;
      crossGap = 60;
    } else if (size === 'L') {
      centerX = 3200;
      centerY = 1600;
      rx = 1750 + prng.range(-40, 40);
      ry = 1050 + prng.range(-30, 30);
      crossLen = 240;
      crossGap = 80;
    }

    const numWp = 12;
    const waypoints: Point2D[] = [];

    for (let i = 0; i < numWp; i++) {
      const angle = (i / numWp) * Math.PI * 2;
      const rVar = prng.range(-15, 15);
      const curRx = rx + rVar;
      const curRy = ry + rVar * 0.7;

      waypoints.push({
        x: centerX + Math.cos(angle) * curRx,
        y: centerY + Math.sin(angle) * curRy
      });
    }

    const centerPoints = this.sampleSpline(waypoints, true);
    this.generateOffsetTracks(centerPoints, true);

    const totalLen = this.tracks[0].totalLength;
    const cross1Dist = Math.round(totalLen * 0.18);
    const cross2Dist = Math.round(totalLen * 0.68);

    this.addSequentialCrossovers('sw-cross-n', 'North Crossover', cross1Dist, crossLen, crossGap);
    this.addSequentialCrossovers('sw-cross-s', 'South Crossover', cross2Dist, crossLen, crossGap);
  }

  private addSequentialCrossovers(
    idPrefix: string,
    namePrefix: string,
    startDist: number,
    length: number = 240,
    gap: number = 80
  ): void {
    const cross1Start = startDist;
    const cross1End = cross1Start + length;

    const cross2Start = cross1End + gap;
    const cross2End = cross2Start + length;

    this.addCrossover(
      `${idPrefix}-0-1`,
      `${namePrefix} (Track 1 → 2)`,
      0,
      1,
      cross1Start,
      cross1End
    );

    this.addCrossover(
      `${idPrefix}-1-0`,
      `${namePrefix} (Track 2 → 1)`,
      1,
      0,
      cross2Start,
      cross2End
    );
  }

  private addCrossover(
    id: string,
    name: string,
    fromTrackId: number,
    toTrackId: number,
    startDist: number,
    endDist: number
  ): void {
    const pStart = this.getStaticPointAtDistance(fromTrackId, startDist);
    const pEnd = this.getStaticPointAtDistance(toTrackId, endDist);

    const curve = this.sampleBézierCurve(
      { x: pStart.x, y: pStart.y, angle: pStart.angle },
      { x: pEnd.x, y: pEnd.y, angle: pEnd.angle },
      60
    );

    this.switches.push({
      id,
      name,
      fromTrackId,
      toTrackId,
      fromDistance: startDist,
      toDistance: endDist,
      state: 'straight',
      length: curve.totalLength,
      path: curve.points,
      worldX: pStart.x,
      worldY: pStart.y
    });

    this.crossoverZones.push({
      switchId: id,
      fromTrackId,
      toTrackId,
      startDistance: startDist,
      endDistance: endDist,
      targetStartDistance: startDist,
      targetEndDistance: endDist,
      path: curve.points,
      totalLength: curve.totalLength
    });
  }

  public isSwitchOccupied(
    switchId: string,
    trainTrackId: number,
    trainHeadDist: number,
    trainTailDist: number,
    activeTransitionSwitchId?: string
  ): boolean {
    if (activeTransitionSwitchId && activeTransitionSwitchId === switchId) {
      return true;
    }

    const sw = this.switches.find(s => s.id === switchId);

    if (!sw) return false;

    const zones = this.crossoverZones.filter(z => z.switchId === switchId);

    for (const zone of zones) {
      if (trainTrackId === zone.fromTrackId) {
        const trackLen = this.tracks[zone.fromTrackId]?.totalLength ?? 1000;
        const minD = zone.startDistance - 15;
        const maxD = zone.startDistance + 15;

        if (this.isSpanOverlapping(trainTailDist, trainHeadDist, minD, maxD, trackLen)) {
          return true;
        }
      }

      if (trainTrackId === zone.toTrackId) {
        const trackLen = this.tracks[zone.toTrackId]?.totalLength ?? 1000;
        const minD = zone.targetEndDistance - 15;
        const maxD = zone.targetEndDistance + 15;

        if (this.isSpanOverlapping(trainTailDist, trainHeadDist, minD, maxD, trackLen)) {
          return true;
        }
      }
    }

    return false;
  }

  private isSpanOverlapping(
    trainTail: number,
    trainHead: number,
    zoneStart: number,
    zoneEnd: number,
    trackLen: number
  ): boolean {
    const minT = Math.min(trainTail, trainHead);
    const maxT = Math.max(trainTail, trainHead);
    const trainLen = maxT - minT;
    const trainMid = minT + trainLen / 2;

    const zoneLen = zoneEnd - zoneStart;
    const zoneMid = zoneStart + zoneLen / 2;

    let diff = Math.abs(trainMid - zoneMid);

    if (diff > trackLen / 2) diff = trackLen - diff;

    return diff < (trainLen + zoneLen) / 2;
  }

  public getStaticPointAtDistance(trackId: number, s: number): { x: number; y: number; angle: number } {
    const track = this.tracks[trackId] || this.tracks[0];
    const isClosedLoop = track.isClosed;
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

  public sampleCrossoverPoint(
    zone: CrossoverZone,
    progress: number
  ): { x: number; y: number; angle: number } {
    const clampedProg = Math.max(0, Math.min(1, progress));
    const idx = Math.min(
      zone.path.length - 1,
      Math.floor(clampedProg * (zone.path.length - 1))
    );
    const pt = zone.path[idx];

    return { x: pt.x, y: pt.y, angle: pt.angle };
  }

  public getPointAtDistance(trackId: number, s: number): { x: number; y: number; angle: number } {
    const track = this.tracks[trackId] || this.tracks[0];
    const isClosedLoop = track.isClosed;
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

  public findSwitchAt(worldX: number, worldY: number, radius: number = 20): JunctionSwitch | null {
    let closest: JunctionSwitch | null = null;
    let minDist = radius;

    for (const sw of this.switches) {
      const p1 = { x: sw.worldX, y: sw.worldY };
      const p2 = sw.path[sw.path.length - 1];

      const d1 = Math.hypot(p1.x - worldX, p1.y - worldY);
      if (d1 < minDist) {
        minDist = d1;
        closest = sw;
      }

      if (p2) {
        const d2 = Math.hypot(p2.x - worldX, p2.y - worldY);
        if (d2 < minDist) {
          minDist = d2;
          closest = sw;
        }
      }
    }

    return closest;
  }

  public toggleSwitch(switchId: string): SwitchState {
    const sw = this.switches.find(s => s.id === switchId);

    if (!sw) return 'straight';

    sw.state = sw.state === 'straight' ? 'diverging' : 'straight';
    return sw.state;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (let trackId = 0; trackId < this.tracks.length; trackId++) {
      const track = this.tracks[trackId];

      if (!track || track.points.length < 2) continue;

      ctx.strokeStyle = '#18181f';
      ctx.lineWidth = 14;
      ctx.lineCap = track.isClosed ? 'round' : 'butt';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(track.points[0].x, track.points[0].y);

      for (let i = 1; i < track.points.length; i++) {
        ctx.lineTo(track.points[i].x, track.points[i].y);
      }

      if (track.isClosed) {
        ctx.closePath();
      }

      ctx.stroke();

      const tieSpacing = 4;
      const numTies = Math.floor(track.totalLength / tieSpacing);

      ctx.strokeStyle = '#272730';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'butt';
      ctx.beginPath();

      for (let i = 0; i < numTies; i++) {
        const s = i * tieSpacing;
        const pt = this.getStaticPointAtDistance(trackId, s);
        const perpX = -Math.sin(pt.angle);
        const perpY = Math.cos(pt.angle);

        ctx.moveTo(pt.x - perpX * 7, pt.y - perpY * 7);
        ctx.lineTo(pt.x + perpX * 7, pt.y + perpY * 7);
      }

      ctx.stroke();

      ctx.strokeStyle = '#42424e';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(track.points[0].x, track.points[0].y);

      for (let i = 1; i < track.points.length; i++) {
        ctx.lineTo(track.points[i].x, track.points[i].y);
      }

      if (track.isClosed) {
        ctx.closePath();
      }

      ctx.stroke();

      ctx.strokeStyle = '#202028';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(track.points[0].x, track.points[0].y);

      for (let i = 1; i < track.points.length; i++) {
        ctx.lineTo(track.points[i].x, track.points[i].y);
      }

      if (track.isClosed) {
        ctx.closePath();
      }

      ctx.stroke();

      if (!track.isClosed) {
        const pStart = track.points[0];
        const pEnd = track.points[track.points.length - 1];
        this.renderBufferStop(ctx, pStart.x, pStart.y, pStart.angle + Math.PI);
        this.renderBufferStop(ctx, pEnd.x, pEnd.y, pEnd.angle);
      }
    }

    for (const sw of this.switches) {
      if (sw.path.length < 2) continue;

      ctx.strokeStyle = '#4a4a54';
      ctx.lineWidth = 7;

      ctx.beginPath();
      ctx.moveTo(sw.path[0].x, sw.path[0].y);

      for (let i = 1; i < sw.path.length; i++) {
        ctx.lineTo(sw.path[i].x, sw.path[i].y);
      }

      ctx.stroke();

      const switchPoints = [
        { x: sw.worldX, y: sw.worldY },
        { x: sw.path[sw.path.length - 1].x, y: sw.path[sw.path.length - 1].y }
      ];

      for (const sp of switchPoints) {
        ctx.save();
        ctx.translate(sp.x, sp.y);

        ctx.fillStyle = '#18181d';
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-9, -9, 18, 18);
        ctx.strokeRect(-9, -9, 18, 18);

        ctx.strokeStyle = '#ffffff';
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

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(-6, -9, 3, 0, Math.PI * 2);
    ctx.arc(-6, 9, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -18);
    ctx.lineTo(-2, 18);
    ctx.stroke();

    ctx.restore();
  }

  public sampleBézierCurve(
    p1: { x: number; y: number; angle: number },
    p2: { x: number; y: number; angle: number },
    steps: number = 40
  ): { points: TrackPoint[]; totalLength: number } {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const handleLen = dist * 0.45;

    const c1x = p1.x + Math.cos(p1.angle) * handleLen;
    const c1y = p1.y + Math.sin(p1.angle) * handleLen;
    const c2x = p2.x - Math.cos(p2.angle) * handleLen;
    const c2y = p2.y - Math.sin(p2.angle) * handleLen;

    const raw: Point2D[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      const uuu = uu * u;
      const ttt = tt * t;

      const x = uuu * p1.x + 3 * uu * t * c1x + 3 * u * tt * c2x + ttt * p2.x;
      const y = uuu * p1.y + 3 * uu * t * c1y + 3 * u * tt * c2y + ttt * p2.y;

      raw.push({ x, y });
    }

    const pts: TrackPoint[] = [];
    let currentDist = 0;

    for (let i = 0; i < raw.length; i++) {
      let angle = 0;

      if (i < raw.length - 1) {
        angle = Math.atan2(raw[i + 1].y - raw[i].y, raw[i + 1].x - raw[i].x);
      } else {
        angle = Math.atan2(raw[i].y - raw[i - 1].y, raw[i].x - raw[i - 1].x);
      }

      if (i > 0) {
        currentDist += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
      }

      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);

      pts.push({
        x: raw[i].x,
        y: raw[i].y,
        angle,
        distance: currentDist,
        normalX: nx,
        normalY: ny
      });
    }

    return { points: pts, totalLength: currentDist };
  }
}
