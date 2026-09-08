import type { Station } from './types.ts';
import { TrackNetwork } from './track.ts';

export interface StationStatus {
  currentStation: Station | null;
}

export class StationManager {
  public stations: Station[] = [];

  constructor(_trackNet: TrackNetwork) {
    this.createStations();
  }

  private createStations(): void {
    this.stations = [
      {
        id: 'stn-t0-hlr',
        name: 'Highland Ridge',
        code: 'HLR',
        trackId: 0,
        distance: 497,
        platformLength: 120
      },
      {
        id: 'stn-t0-epg',
        name: 'Eastport Gateway',
        code: 'EPG',
        trackId: 0,
        distance: 1770,
        platformLength: 120
      },
      {
        id: 'stn-t0-sjv',
        name: 'St. Jude Valley',
        code: 'SJV',
        trackId: 0,
        distance: 3039,
        platformLength: 120
      },
      {
        id: 'stn-t0-wpt',
        name: 'Westport Terminal',
        code: 'WPT',
        trackId: 0,
        distance: 4257,
        platformLength: 120,
        isTerminal: true
      },
      {
        id: 'stn-t1-hlr',
        name: 'Highland Ridge',
        code: 'HLR',
        trackId: 1,
        distance: 511,
        platformLength: 120
      },
      {
        id: 'stn-t1-epg',
        name: 'Eastport Gateway',
        code: 'EPG',
        trackId: 1,
        distance: 1853,
        platformLength: 120
      },
      {
        id: 'stn-t1-sjv',
        name: 'St. Jude Valley',
        code: 'SJV',
        trackId: 1,
        distance: 3191,
        platformLength: 120
      },
      {
        id: 'stn-t1-wpt',
        name: 'Westport Terminal',
        code: 'WPT',
        trackId: 1,
        distance: 4477,
        platformLength: 120,
        isTerminal: true
      }
    ];
  }

  public update(trainTrackId: number, trainDistance: number, _trainSpeed: number, _dt: number, trackNet: TrackNetwork): StationStatus {
    let currentStation: Station | null = null;
    const track = trackNet.tracks[trainTrackId];

    if (!track) return { currentStation: null };

    const trackLen = track.totalLength;

    for (const stn of this.stations) {
      if (stn.trackId !== trainTrackId) continue;

      let delta = Math.abs(trainDistance - stn.distance);

      if (trainTrackId < 2 && delta > trackLen / 2) {
        delta = trackLen - delta;
      }

      if (delta < stn.platformLength / 2) {
        currentStation = stn;
        break;
      }
    }

    return { currentStation };
  }

  public getNextStationAhead(trainTrackId: number, trainDistance: number, trackLength: number): { station: Station; distanceAhead: number } | null {
    let closest: Station | null = null;
    let minDistance = Infinity;

    for (const stn of this.stations) {
      if (stn.trackId !== trainTrackId) continue;

      let delta = (stn.distance - trainDistance) % trackLength;

      if (delta < 0) delta += trackLength;

      if (delta > 0 && delta < minDistance) {
        minDistance = delta;
        closest = stn;
      }
    }

    return closest ? { station: closest, distanceAhead: minDistance } : null;
  }

  public render(ctx: CanvasRenderingContext2D, trackNet: TrackNetwork): void {
    for (const stn of this.stations) {
      const pt = trackNet.getStaticPointAtDistance(stn.trackId, stn.distance);
      const side = stn.trackId === 1 ? -1 : 1;
      const perpAngle = pt.angle + (Math.PI / 2) * side;

      const platHalfLen = 32;
      const tangX = Math.cos(pt.angle);
      const tangY = Math.sin(pt.angle);
      const platEdgeDist = 9 * side;

      const px1 = pt.x + Math.cos(pt.angle + Math.PI / 2) * platEdgeDist - tangX * platHalfLen;
      const py1 = pt.y + Math.sin(pt.angle + Math.PI / 2) * platEdgeDist - tangY * platHalfLen;
      const px2 = pt.x + Math.cos(pt.angle + Math.PI / 2) * platEdgeDist + tangX * platHalfLen;
      const py2 = pt.y + Math.sin(pt.angle + Math.PI / 2) * platEdgeDist + tangY * platHalfLen;

      const iconDist = 24;
      const sx = pt.x + Math.cos(perpAngle) * iconDist;
      const sy = pt.y + Math.sin(perpAngle) * iconDist;

      const labelDist = 44;
      const lx = pt.x + Math.cos(perpAngle) * labelDist;
      const ly = pt.y + Math.sin(perpAngle) * labelDist;

      ctx.save();

      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pt.x + Math.cos(perpAngle) * Math.abs(platEdgeDist), pt.y + Math.sin(perpAngle) * Math.abs(platEdgeDist));
      ctx.lineTo(sx, sy);
      ctx.stroke();

      const size = 11;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();

      for (let i = 0; i < 3; i++) {
        const th = (i * 2 * Math.PI) / 3 - Math.PI / 2;
        const tx = sx + Math.cos(th) * size;
        const ty = sy + Math.sin(th) * size;

        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }

      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#121215';
      ctx.beginPath();

      const innerSize = size * 0.45;

      for (let i = 0; i < 3; i++) {
        const th = (i * 2 * Math.PI) / 3 - Math.PI / 2;
        const tx = sx + Math.cos(th) * innerSize;
        const ty = sy + Math.sin(th) * innerSize;

        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }

      ctx.closePath();
      ctx.fill();

      ctx.font = '500 11px "Geist", system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(stn.name);
      const textWidth = textMetrics.width;

      ctx.fillStyle = 'rgba(24, 24, 28, 0.94)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.fillRect(lx - textWidth / 2 - 6, ly - 9, textWidth + 12, 18);
      ctx.strokeRect(lx - textWidth / 2 - 6, ly - 9, textWidth + 12, 18);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stn.name, lx, ly);

      ctx.restore();
    }
  }
}
