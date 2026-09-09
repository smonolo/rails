import type { Point2D, Station } from './types.ts';
import { TrackNetwork } from './track.ts';
import { PRNG } from './prng.ts';

interface RoadSegment {
  points: Point2D[];
}

interface CatenaryMast {
  poleX: number;
  poleY: number;
  wireX: number;
  wireY: number;
  angle: number;
  isTensioner: boolean;
  normalX: number;
  normalY: number;
}

interface TreeProp {
  x: number;
  y: number;
  r: number;
}

interface HouseProp {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

interface CrossingDef {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
}

export class SceneryManager {
  private roads: RoadSegment[] = [];
  private trackMasts: CatenaryMast[][] = [];
  private trees: TreeProp[] = [];
  private houses: HouseProp[] = [];
  private crossings: CrossingDef[] = [];
  private isClosed: boolean = true;

  constructor(trackNet: TrackNetwork, stations: Station[] = [], seed: number | string = 12345) {
    this.generateScenery(trackNet, stations, seed);
  }

  public generateScenery(trackNet: TrackNetwork, stations: Station[], seed: number | string): void {
    this.roads = [];
    this.trackMasts = [];
    this.trees = [];
    this.houses = [];
    this.crossings = [];
    this.isClosed = trackNet.tracks[0]?.isClosed ?? true;

    const prng = new PRNG(seed);

    this.buildCatenaryMasts(trackNet);
    this.buildCrossingsAndRoads(trackNet, stations, prng);
    this.buildSettlements(trackNet, stations, prng);
    this.buildVegetation(trackNet, stations, prng);
  }

  private getMinTrackDistance(x: number, y: number, trackNet: TrackNetwork): number {
    let minDist = Infinity;

    for (const track of trackNet.tracks) {
      const step = Math.max(1, Math.floor(track.points.length / 250));

      for (let i = 0; i < track.points.length; i += step) {
        const pt = track.points[i];
        const dist = Math.hypot(pt.x - x, pt.y - y);

        if (dist < minDist) {
          minDist = dist;
        }
      }
    }

    return minDist;
  }

  private buildCatenaryMasts(trackNet: TrackNetwork): void {
    this.trackMasts = [];
    const spacing = 125;

    for (let trackId = 0; trackId < trackNet.tracks.length; trackId++) {
      const track = trackNet.tracks[trackId];
      const masts: CatenaryMast[] = [];
      this.trackMasts.push(masts);

      if (!track || track.totalLength < spacing) continue;

      const normalSign = trackId === 0 ? 1 : -1;
      const mastOffsetDist = 16;
      const isLinear = !track.isClosed;

      const startDist = isLinear ? 35 : (trackId === 0 ? 25 : 85);
      const endDist = isLinear ? track.totalLength - 35 : track.totalLength;
      const count = Math.floor((endDist - startDist) / spacing);

      for (let i = 0; i <= count; i++) {
        const dist = startDist + i * spacing;

        if (dist > track.totalLength) break;

        const pt = trackNet.getStaticPointAtDistance(trackId, dist);
        const perpAngle = pt.angle + (Math.PI / 2) * normalSign;
        const nx = Math.cos(perpAngle);
        const ny = Math.sin(perpAngle);

        const poleX = pt.x + nx * mastOffsetDist;
        const poleY = pt.y + ny * mastOffsetDist;

        const stagger = (i % 2 === 0 ? 1 : -1) * 2.6;
        const wireX = pt.x + nx * stagger;
        const wireY = pt.y + ny * stagger;

        const isTensioner = i % 8 === 0;

        masts.push({
          poleX,
          poleY,
          wireX,
          wireY,
          angle: pt.angle,
          isTensioner,
          normalX: nx,
          normalY: ny
        });
      }
    }
  }

  private buildCrossingsAndRoads(trackNet: TrackNetwork, stations: Station[], prng: PRNG): void {
    const track0 = trackNet.tracks[0];
    const track1 = trackNet.tracks[1];

    if (!track0 || !track1) return;

    const crossingDistances: number[] = [];

    if (!track0.isClosed) {
      crossingDistances.push(
        Math.round(track0.totalLength * 0.44),
        Math.round(track0.totalLength * 0.82)
      );
    } else {
      crossingDistances.push(
        Math.round(track0.totalLength * 0.40),
        Math.round(track0.totalLength * 0.90)
      );
    }

    for (const targetDist of crossingDistances) {
      if (targetDist >= track0.totalLength - 150 || targetDist <= 150) continue;

      let nearStation = false;

      for (const st of stations) {
        if (Math.abs(st.distance - targetDist) < 220) {
          nearStation = true;
          break;
        }
      }

      if (nearStation) continue;

      let nearSwitch = false;

      for (const sw of trackNet.switches) {
        if (targetDist >= sw.fromDistance - 50 && targetDist <= sw.toDistance + 50) {
          nearSwitch = true;
          break;
        }
      }

      if (nearSwitch) continue;

      const p0 = trackNet.getStaticPointAtDistance(0, targetDist);
      const p1 = trackNet.getStaticPointAtDistance(1, Math.min(targetDist, track1.totalLength));

      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      const spanWidth = 54;

      this.crossings.push({
        cx,
        cy,
        w: 24,
        h: spanWidth,
        angle: p0.angle
      });

      const perpAngle = p0.angle + Math.PI / 2;
      const rnx = Math.cos(perpAngle);
      const rny = Math.sin(perpAngle);

      const arm = 550 + prng.range(0, 100);

      const roadPoints: Point2D[] = [
        {
          x: cx - rnx * arm,
          y: cy - rny * arm
        },
        {
          x: cx + rnx * arm,
          y: cy + rny * arm
        }
      ];

      this.roads.push({ points: roadPoints });
    }
  }

  private buildSettlements(trackNet: TrackNetwork, stations: Station[], prng: PRNG): void {
    for (const st of stations) {
      const pt = trackNet.getStaticPointAtDistance(st.trackId, st.distance);
      const side = st.trackId === 0 ? 1 : -1;
      const perpAngle = pt.angle + (Math.PI / 2) * side;
      const nx = Math.cos(perpAngle);
      const ny = Math.sin(perpAngle);
      const tx = Math.cos(pt.angle);
      const ty = Math.sin(pt.angle);

      const houseCount = prng.rangeInt(8, 14);

      for (let i = 0; i < houseCount; i++) {
        const along = (i - houseCount / 2) * 28 + (prng.next() - 0.5) * 10;
        const row = i % 2;
        const offset = row === 0 ? 46 + (prng.next() - 0.5) * 8 : 74 + (prng.next() - 0.5) * 10;

        const hx = pt.x + tx * along + nx * offset;
        const hy = pt.y + ty * along + ny * offset;

        if (this.getMinTrackDistance(hx, hy, trackNet) >= 32) {
          this.houses.push({
            x: hx,
            y: hy,
            w: prng.range(22, 32),
            h: prng.range(16, 22),
            angle: pt.angle + (prng.next() - 0.5) * 0.16
          });
        }
      }
    }
  }

  private buildVegetation(trackNet: TrackNetwork, stations: Station[], prng: PRNG): void {
    for (const st of stations) {
      const pt = trackNet.getStaticPointAtDistance(st.trackId, st.distance);
      const treeCount = prng.rangeInt(4, 8);

      for (let i = 0; i < treeCount; i++) {
        const angle = prng.range(0, Math.PI * 2);
        const dist = prng.range(38, 110);
        const tx = pt.x + Math.cos(angle) * dist;
        const ty = pt.y + Math.sin(angle) * dist;

        if (this.getMinTrackDistance(tx, ty, trackNet) >= 28) {
          this.trees.push({
            x: tx,
            y: ty,
            r: prng.range(9, 13)
          });
        }
      }
    }

    const bounds = trackNet.worldBounds;
    const clusterCount = prng.rangeInt(10, 16);

    for (let c = 0; c < clusterCount; c++) {
      const cx = prng.range(bounds.minX + 80, bounds.maxX - 80);
      const cy = prng.range(bounds.minY + 80, bounds.maxY - 80);

      if (this.getMinTrackDistance(cx, cy, trackNet) < 36) continue;

      const clusterSize = prng.rangeInt(4, 9);

      for (let i = 0; i < clusterSize; i++) {
        const offsetAngle = prng.range(0, Math.PI * 2);
        const offsetDist = prng.range(0, 36);
        const tx = cx + Math.cos(offsetAngle) * offsetDist;
        const ty = cy + Math.sin(offsetAngle) * offsetDist;

        if (this.getMinTrackDistance(tx, ty, trackNet) >= 26) {
          this.trees.push({
            x: tx,
            y: ty,
            r: prng.range(8, 12)
          });
        }
      }
    }
  }

  public renderGround(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const road of this.roads) {
      if (road.points.length < 2) continue;

      ctx.strokeStyle = '#15151c';
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);

      for (let i = 1; i < road.points.length; i++) {
        ctx.lineTo(road.points[i].x, road.points[i].y);
      }

      ctx.stroke();

      ctx.strokeStyle = '#1d1d26';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);

      for (let i = 1; i < road.points.length; i++) {
        ctx.lineTo(road.points[i].x, road.points[i].y);
      }

      ctx.stroke();

      ctx.strokeStyle = '#262632';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);

      for (let i = 1; i < road.points.length; i++) {
        ctx.lineTo(road.points[i].x, road.points[i].y);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const c of this.crossings) {
      ctx.save();
      ctx.translate(c.cx, c.cy);
      ctx.rotate(c.angle);

      ctx.fillStyle = '#1c1c24';
      ctx.strokeStyle = '#383846';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);

      ctx.fillStyle = '#ffffff';

      if (c.w < c.h) {
        ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 2, c.w - 4, 2);
        ctx.fillRect(-c.w / 2 + 2, c.h / 2 - 4, c.w - 4, 2);

        ctx.strokeStyle = '#5a5a6e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-c.w / 2 - 6, -c.h / 2);
        ctx.lineTo(-c.w / 2 - 2, -c.h / 2 + 4);
        ctx.moveTo(-c.w / 2 - 6, -c.h / 2 + 4);
        ctx.lineTo(-c.w / 2 - 2, -c.h / 2);

        ctx.moveTo(c.w / 2 + 2, c.h / 2 - 4);
        ctx.lineTo(c.w / 2 + 6, c.h / 2);
        ctx.moveTo(c.w / 2 + 2, c.h / 2);
        ctx.lineTo(c.w / 2 + 6, c.h / 2 - 4);
        ctx.stroke();
      } else {
        ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 2, 2, c.h - 4);
        ctx.fillRect(c.w / 2 - 4, -c.h / 2 + 2, 2, c.h - 4);

        ctx.strokeStyle = '#5a5a6e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-c.w / 2, -c.h / 2 - 6);
        ctx.lineTo(-c.w / 2 + 4, -c.h / 2 - 2);
        ctx.moveTo(-c.w / 2 + 4, -c.h / 2 - 6);
        ctx.lineTo(-c.w / 2, -c.h / 2 - 2);

        ctx.moveTo(c.w / 2 - 4, c.h / 2 + 2);
        ctx.lineTo(c.w / 2, c.h / 2 + 6);
        ctx.moveTo(c.w / 2, c.h / 2 + 2);
        ctx.lineTo(c.w / 2 - 4, c.h / 2 + 6);
        ctx.stroke();
      }

      ctx.restore();
    }

    for (const h of this.houses) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);

      ctx.fillStyle = '#16161d';
      ctx.strokeStyle = '#242430';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h);
      ctx.strokeRect(-h.w / 2, -h.h / 2, h.w, h.h);

      ctx.strokeStyle = '#1d1d26';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-h.w / 2, 0);
      ctx.lineTo(h.w / 2, 0);
      ctx.stroke();

      ctx.restore();
    }

    for (const t of this.trees) {
      ctx.fillStyle = '#15151c';
      ctx.strokeStyle = '#1e1e28';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1a1a23';
      ctx.beginPath();
      ctx.arc(t.x + t.r * 0.15, t.y - t.r * 0.15, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public renderCatenary(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (let trackId = 0; trackId < this.trackMasts.length; trackId++) {
      const masts = this.trackMasts[trackId];

      if (!masts || masts.length < 2) continue;

      ctx.strokeStyle = 'rgba(215, 225, 240, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();

      for (let i = 0; i < masts.length - 1; i++) {
        const segDist = Math.hypot(masts[i + 1].wireX - masts[i].wireX, masts[i + 1].wireY - masts[i].wireY);

        if (segDist < 180) {
          ctx.moveTo(masts[i].wireX, masts[i].wireY);
          ctx.lineTo(masts[i + 1].wireX, masts[i + 1].wireY);
        }
      }

      if (this.isClosed && masts.length > 2) {
        const last = masts[masts.length - 1];
        const first = masts[0];
        const closingDist = Math.hypot(first.wireX - last.wireX, first.wireY - last.wireY);

        if (closingDist < 180) {
          ctx.moveTo(last.wireX, last.wireY);
          ctx.lineTo(first.wireX, first.wireY);
        }
      }

      ctx.stroke();

      for (const m of masts) {
        ctx.fillStyle = '#22222d';
        ctx.strokeStyle = '#343444';
        ctx.lineWidth = 1.2;
        ctx.fillRect(m.poleX - 3, m.poleY - 3, 6, 6);
        ctx.strokeRect(m.poleX - 3, m.poleY - 3, 6, 6);

        ctx.fillStyle = '#3c3c4e';
        ctx.fillRect(m.poleX - 1.5, m.poleY - 1.5, 3, 3);

        const armDx = m.wireX - m.poleX;
        const armDy = m.wireY - m.poleY;

        ctx.strokeStyle = '#363648';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.poleX, m.poleY);
        ctx.lineTo(m.wireX, m.wireY);
        ctx.stroke();

        const insX = m.poleX + armDx * 0.25;
        const insY = m.poleY + armDy * 0.25;

        ctx.fillStyle = '#5c5c70';
        ctx.beginPath();
        ctx.arc(insX, insY, 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#7a7a94';
        ctx.beginPath();
        ctx.arc(m.wireX, m.wireY, 1.4, 0, Math.PI * 2);
        ctx.fill();

        if (m.isTensioner) {
          const pulleyX = m.poleX + m.normalX * 4;
          const pulleyY = m.poleY + m.normalY * 4;

          ctx.strokeStyle = '#444458';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pulleyX, pulleyY, 2.5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#282834';
          ctx.strokeStyle = '#3a3a4c';
          ctx.lineWidth = 1;
          ctx.fillRect(pulleyX - 1.5, pulleyY + 2, 3, 6);
          ctx.strokeRect(pulleyX - 1.5, pulleyY + 2, 3, 6);
        }
      }
    }

    ctx.restore();
  }
}
