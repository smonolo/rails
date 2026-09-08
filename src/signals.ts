import type { Signal, Block } from './types.ts';
import { TrackNetwork } from './track.ts';

export class SignalManager {
  public signals: Signal[] = [];
  public blocks: Block[] = [];
  private prevTrainHeadDist: number = 0;
  private prevTrainTrackId: number = 0;
  private hasInitialized: boolean = false;

  constructor(trackNet: TrackNetwork) {
    this.setupBlocksAndSignals(trackNet);
  }

  private setupBlocksAndSignals(trackNet: TrackNetwork): void {
    this.signals = [];
    this.blocks = [];

    for (let trackId = 0; trackId < 2; trackId++) {
      const totalLen = trackNet.tracks[trackId].totalLength;
      const numBlocks = 4;
      const blockLen = totalLen / numBlocks;
      const trackName = trackId === 0 ? 'Track 1' : 'Track 2';

      for (let b = 0; b < numBlocks; b++) {
        const blockStart = (b * blockLen) % totalLen;
        const blockEnd = ((b + 1) * blockLen) % totalLen;

        const primaryId = `sig-p-t${trackId}-b${b + 1}`;
        const secondaryId = `sig-s-t${trackId}-b${b + 1}`;
        const primaryDist = blockStart;

        let secondaryDist = primaryDist - 800;

        if (secondaryDist < 0) secondaryDist += totalLen;

        const side = -1;

        const pPt = trackNet.getStaticPointAtDistance(trackId, primaryDist);
        const pPerp = pPt.angle + (Math.PI / 2) * side;
        const pWorldX = pPt.x + Math.cos(pPerp) * 22;
        const pWorldY = pPt.y + Math.sin(pPerp) * 22;

        const sPt = trackNet.getStaticPointAtDistance(trackId, secondaryDist);
        const sPerp = sPt.angle + (Math.PI / 2) * side;
        const sWorldX = sPt.x + Math.cos(sPerp) * 22;
        const sWorldY = sPt.y + Math.sin(sPerp) * 22;

        const primSig: Signal = {
          id: primaryId,
          name: `${trackName} Home ${b + 1}`,
          trackId,
          type: 'primary',
          distance: primaryDist,
          aspect: 'green',
          side,
          manualOverride: false,
          blockId: b,
          worldX: pWorldX,
          worldY: pWorldY
        };

        const secSig: Signal = {
          id: secondaryId,
          name: `${trackName} Distant ${b + 1}`,
          trackId,
          type: 'secondary',
          distance: secondaryDist,
          aspect: 'green',
          side,
          manualOverride: false,
          blockId: b,
          linkedPrimaryId: primaryId,
          worldX: sWorldX,
          worldY: sWorldY
        };

        this.signals.push(primSig, secSig);

        this.blocks.push({
          id: b,
          trackId,
          startDistance: blockStart,
          endDistance: blockEnd,
          isOccupied: false,
          primarySignalId: primaryId,
          secondarySignalId: secondaryId
        });
      }
    }

    if (trackNet.tracks[2]) {
      const sidingLen = trackNet.tracks[2].totalLength;
      const sPt = trackNet.getStaticPointAtDistance(2, 40);
      const sPerp = sPt.angle - Math.PI / 2;

      this.signals.push({
        id: 'sig-siding-1',
        name: 'Siding Shunt Signal',
        trackId: 2,
        type: 'primary',
        distance: 40,
        aspect: 'yellow',
        side: -1,
        manualOverride: false,
        blockId: 99,
        worldX: sPt.x + Math.cos(sPerp) * 20,
        worldY: sPt.y + Math.sin(sPerp) * 20
      });

      this.blocks.push({
        id: 99,
        trackId: 2,
        startDistance: 0,
        endDistance: sidingLen,
        isOccupied: false,
        primarySignalId: 'sig-siding-1',
        secondarySignalId: 'sig-siding-1'
      });
    }
  }

  private isSpanOverlappingBlock(
    trainStart: number,
    trainEnd: number,
    blockStart: number,
    blockEnd: number,
    trackLength: number
  ): boolean {
    const normalize = (dist: number) => ((dist % trackLength) + trackLength) % trackLength;
    const s = normalize(trainStart);
    const e = normalize(trainEnd);
    const bs = normalize(blockStart);
    const be = normalize(blockEnd);

    if (bs < be) {
      if (s <= e) {
        return Math.max(s, bs) < Math.min(e, be);
      } else {
        return (s < be) || (e > bs);
      }
    } else {
      if (s <= e) {
        return (s < be) || (e > bs);
      } else {
        return true;
      }
    }
  }

  public update(
    trainTrackId: number,
    trainHeadDist: number,
    trainTailDist: number,
    trackNet: TrackNetwork,
    _dt: number
  ): { spad: boolean; signalName?: string } {
    if (!this.hasInitialized) {
      this.prevTrainHeadDist = trainHeadDist;
      this.prevTrainTrackId = trainTrackId;
      this.hasInitialized = true;
    }

    const currentTrack = trackNet.tracks[trainTrackId];

    if (!currentTrack) return { spad: false };

    const trackLen = currentTrack.totalLength;

    for (const block of this.blocks) {
      if (block.trackId !== trainTrackId) {
        block.isOccupied = false;
        continue;
      }

      block.isOccupied = this.isSpanOverlappingBlock(
        trainTailDist,
        trainHeadDist,
        block.startDistance,
        block.endDistance,
        trackLen
      );
    }

    let spadOccurred = false;
    let spadSigName = '';

    if (this.prevTrainTrackId === trainTrackId) {
      let forwardDelta = trainHeadDist - this.prevTrainHeadDist;

      if (forwardDelta < -trackLen / 2) forwardDelta += trackLen;
      else if (forwardDelta > trackLen / 2) forwardDelta -= trackLen;

      if (forwardDelta > 0) {
        for (const sig of this.signals) {
          if (sig.trackId === trainTrackId && sig.type === 'primary') {
            let distToSig = (sig.distance - this.prevTrainHeadDist) % trackLen;

            if (distToSig < 0) distToSig += trackLen;

            if (distToSig <= forwardDelta && sig.aspect === 'red') {
              spadOccurred = true;
              spadSigName = sig.name;
              break;
            }
          }
        }
      }
    }

    for (const block of this.blocks) {
      const primSig = this.signals.find(s => s.id === block.primarySignalId);

      if (primSig) {
        if (primSig.manualOverride) {
          primSig.aspect = 'red';
        } else if (block.isOccupied) {
          primSig.aspect = 'red';
        } else {
          primSig.aspect = 'green';
        }
      }
    }

    for (const secSig of this.signals) {
      if (secSig.type === 'secondary' && secSig.linkedPrimaryId) {
        const linkedPrim = this.signals.find(s => s.id === secSig.linkedPrimaryId);

        if (linkedPrim) {
          secSig.aspect = linkedPrim.aspect === 'red' ? 'yellow' : 'green';
        }
      }
    }

    this.prevTrainHeadDist = trainHeadDist;
    this.prevTrainTrackId = trainTrackId;

    return { spad: spadOccurred, signalName: spadSigName };
  }

  public toggleSignalAt(worldX: number, worldY: number, radius: number = 22): { signal: Signal; message: string } | null {
    for (const sig of this.signals) {
      if (sig.worldX !== undefined && sig.worldY !== undefined) {
        const d = Math.hypot(sig.worldX - worldX, sig.worldY - worldY);

        if (d <= radius) {
          if (sig.type === 'primary') {
            sig.manualOverride = !sig.manualOverride;
            sig.aspect = sig.manualOverride ? 'red' : 'green';

            const linkedSec = this.signals.find(s => s.linkedPrimaryId === sig.id);

            if (linkedSec) {
              linkedSec.aspect = sig.aspect === 'red' ? 'yellow' : 'green';
            }

            const msg = sig.manualOverride
              ? `${sig.name} set to Stop (Red)`
              : `${sig.name} set to Auto (Green)`;

            return { signal: sig, message: msg };
          } else {
            const linkedPrim = this.signals.find(s => s.id === sig.linkedPrimaryId);

            if (linkedPrim) {
              linkedPrim.manualOverride = !linkedPrim.manualOverride;
              linkedPrim.aspect = linkedPrim.manualOverride ? 'red' : 'green';
              sig.aspect = linkedPrim.aspect === 'red' ? 'yellow' : 'green';

              const msg = sig.aspect === 'yellow'
                ? `${sig.name} Caution: upcoming signal is Stop`
                : `${sig.name} Clear: upcoming signal is Clear`;

              return { signal: sig, message: msg };
            }
          }
        }
      }
    }

    return null;
  }

  public getNextSignalAhead(trackId: number, trainHeadDist: number, trackLength: number): { signal: Signal; distanceAhead: number } | null {
    let closest: Signal | null = null;
    let minDistance = Infinity;

    for (const sig of this.signals) {
      if (sig.trackId !== trackId) continue;

      let delta = (sig.distance - trainHeadDist) % trackLength;

      if (delta < 0) delta += trackLength;

      if (delta > 0 && delta < minDistance) {
        minDistance = delta;
        closest = sig;
      }
    }

    return closest ? { signal: closest, distanceAhead: minDistance } : null;
  }

  public render(ctx: CanvasRenderingContext2D, trackNet: TrackNetwork): void {
    ctx.save();

    for (const sig of this.signals) {
      const pt = trackNet.getStaticPointAtDistance(sig.trackId, sig.distance);
      const perpAngle = pt.angle + (Math.PI / 2) * sig.side;
      const offsetDist = 22;
      const sx = pt.x + Math.cos(perpAngle) * offsetDist;
      const sy = pt.y + Math.sin(perpAngle) * offsetDist;

      ctx.strokeStyle = '#4a4a54';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.save();
      ctx.translate(sx, sy);

      if (sig.type === 'primary') {
        const r = 10;

        ctx.fillStyle = '#121215';
        ctx.strokeStyle = sig.manualOverride ? '#008cff' : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = sig.aspect === 'red' ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '700 8px "Geist Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', 0, 16);
      } else {
        const size = 9;

        ctx.fillStyle = '#121215';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = sig.aspect === 'yellow' ? '#f59e0b' : '#10b981';
        ctx.beginPath();
        ctx.moveTo(0, -size + 3);
        ctx.lineTo(size - 3, 0);
        ctx.lineTo(0, size - 3);
        ctx.lineTo(-size + 3, 0);
        ctx.closePath();
        ctx.fill();

        ctx.font = '700 8px "Geist Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 16);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
