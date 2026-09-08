import type { Point2D } from './types.ts';
import { TrackNetwork } from './track.ts';

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

  constructor(trackNet: TrackNetwork) {
    this.buildRoads();
    this.buildCatenaryMasts(trackNet);
    this.buildCrossings();
    this.buildHouses();
    this.buildTrees();
  }

  private buildRoads(): void {
    this.roads = [
      {
        points: [
          { x: 884, y: 150 },
          { x: 884, y: 350 },
          { x: 884, y: 489 },
          { x: 890, y: 750 },
          { x: 895, y: 1100 },
          { x: 905, y: 1450 },
          { x: 910, y: 1596 },
          { x: 910, y: 1800 }
        ]
      },
      {
        points: [
          { x: 100, y: 872 },
          { x: 250, y: 872 },
          { x: 319, y: 877 },
          { x: 500, y: 890 },
          { x: 680, y: 920 },
          { x: 895, y: 920 }
        ]
      },
      {
        points: [
          { x: 1800, y: 1640 },
          { x: 1920, y: 1690 },
          { x: 2040, y: 1720 },
          { x: 2150, y: 1730 }
        ]
      },
      {
        points: [
          { x: 895, y: 920 },
          { x: 1150, y: 920 },
          { x: 1380, y: 950 },
          { x: 1600, y: 1020 }
        ]
      }
    ];
  }

  private buildCrossings(): void {
    this.crossings = [
      {
        cx: 884,
        cy: 489,
        w: 26,
        h: 74,
        angle: 0
      },
      {
        cx: 910,
        cy: 1596,
        w: 26,
        h: 74,
        angle: 0
      },
      {
        cx: 319,
        cy: 877,
        w: 74,
        h: 26,
        angle: 0
      }
    ];
  }

  private buildCatenaryMasts(trackNet: TrackNetwork): void {
    this.trackMasts = [[], []];
    const spacing = 130;

    for (let trackId = 0; trackId < 2; trackId++) {
      const track = trackNet.tracks[trackId];

      if (!track) continue;

      const count = Math.floor(track.totalLength / spacing);
      const normalSign = trackId === 0 ? 1 : -1;
      const mastOffsetDist = 16;

      for (let i = 0; i < count; i++) {
        const dist = i * spacing + (trackId === 0 ? 25 : 85);
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

        this.trackMasts[trackId].push({
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

  private buildHouses(): void {
    this.houses = [
      { x: 580, y: 390, w: 26, h: 18, angle: 0.08 },
      { x: 615, y: 385, w: 22, h: 16, angle: 0.05 },
      { x: 648, y: 390, w: 28, h: 20, angle: 0.12 },
      { x: 685, y: 395, w: 24, h: 18, angle: 0.06 },
      { x: 720, y: 400, w: 26, h: 18, angle: 0.08 },
      { x: 570, y: 420, w: 24, h: 16, angle: 0.1 },
      { x: 605, y: 425, w: 30, h: 22, angle: 0.08 },
      { x: 645, y: 430, w: 26, h: 18, angle: 0.04 },
      { x: 680, y: 435, w: 22, h: 16, angle: 0.08 },
      { x: 715, y: 440, w: 28, h: 20, angle: 0.05 },
      { x: 745, y: 430, w: 24, h: 17, angle: 0.06 },
      { x: 590, y: 450, w: 25, h: 18, angle: 0.08 },
      { x: 630, y: 455, w: 24, h: 17, angle: 0.06 },
      { x: 665, y: 455, w: 28, h: 19, angle: 0.09 },
      { x: 700, y: 450, w: 26, h: 18, angle: 0.05 },

      { x: 1830, y: 1670, w: 26, h: 18, angle: -0.1 },
      { x: 1868, y: 1680, w: 24, h: 18, angle: -0.08 },
      { x: 1905, y: 1690, w: 30, h: 20, angle: -0.12 },
      { x: 1945, y: 1700, w: 26, h: 18, angle: -0.15 },
      { x: 1985, y: 1710, w: 28, h: 20, angle: -0.1 },
      { x: 2025, y: 1720, w: 24, h: 16, angle: -0.14 },
      { x: 1845, y: 1710, w: 24, h: 18, angle: -0.08 },
      { x: 1885, y: 1720, w: 28, h: 20, angle: -0.12 },
      { x: 1925, y: 1730, w: 32, h: 22, angle: -0.15 },
      { x: 1968, y: 1740, w: 26, h: 18, angle: -0.1 },
      { x: 2005, y: 1750, w: 28, h: 20, angle: -0.14 },
      { x: 2045, y: 1760, w: 22, h: 16, angle: -0.08 },

      { x: 175, y: 825, w: 42, h: 24, angle: 0 },
      { x: 225, y: 825, w: 36, h: 22, angle: 0 },
      { x: 145, y: 940, w: 44, h: 26, angle: 0 },
      { x: 195, y: 940, w: 38, h: 22, angle: 0 },
      { x: 140, y: 980, w: 32, h: 20, angle: 0 },
      { x: 185, y: 980, w: 28, h: 18, angle: 0 },
      { x: 135, y: 1020, w: 30, h: 20, angle: 0 },
      { x: 180, y: 1020, w: 34, h: 22, angle: 0 },
      { x: 130, y: 1060, w: 28, h: 18, angle: 0 },
      { x: 175, y: 1060, w: 32, h: 20, angle: 0 },
      { x: 130, y: 1100, w: 28, h: 18, angle: 0 },

      { x: 1050, y: 950, w: 28, h: 18, angle: 0.02 },
      { x: 1090, y: 955, w: 24, h: 16, angle: 0.02 },
      { x: 1130, y: 960, w: 32, h: 22, angle: 0.04 },
      { x: 1170, y: 965, w: 26, h: 18, angle: 0.04 },
      { x: 1210, y: 970, w: 30, h: 20, angle: 0.05 },
      { x: 1060, y: 985, w: 26, h: 18, angle: 0.02 },
      { x: 1100, y: 990, w: 30, h: 20, angle: 0.03 },
      { x: 1145, y: 995, w: 28, h: 18, angle: 0.04 },
      { x: 1190, y: 1000, w: 32, h: 22, angle: 0.05 },

      { x: 1420, y: 1060, w: 36, h: 24, angle: 0.08 },
      { x: 1470, y: 1070, w: 30, h: 20, angle: 0.08 },
      { x: 1515, y: 1080, w: 28, h: 18, angle: 0.1 },
      { x: 1430, y: 1100, w: 32, h: 22, angle: 0.08 },
      { x: 1475, y: 1110, w: 34, h: 22, angle: 0.09 },
      { x: 1520, y: 1120, w: 26, h: 18, angle: 0.1 }
    ];
  }

  private buildTrees(): void {
    this.trees = [
      { x: 535, y: 365, r: 10 },
      { x: 550, y: 380, r: 9 },
      { x: 745, y: 405, r: 11 },

      { x: 1785, y: 1655, r: 10 },
      { x: 2075, y: 1745, r: 11 },

      { x: 145, y: 835, r: 11 },
      { x: 140, y: 915, r: 10 },
      { x: 135, y: 1035, r: 11 },

      { x: 1010, y: 940, r: 11 },
      { x: 1250, y: 975, r: 10 },
      { x: 1380, y: 1050, r: 11 },
      { x: 1560, y: 1130, r: 10 },

      { x: 1280, y: 350, r: 11 },
      { x: 1305, y: 365, r: 9 }
    ];
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

    for (let trackId = 0; trackId < 2; trackId++) {
      const masts = this.trackMasts[trackId];

      if (masts.length < 2) continue;

      ctx.strokeStyle = 'rgba(215, 225, 240, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(masts[0].wireX, masts[0].wireY);

      for (let i = 1; i < masts.length; i++) {
        ctx.lineTo(masts[i].wireX, masts[i].wireY);
      }

      ctx.closePath();
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
