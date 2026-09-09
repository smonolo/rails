import type { Signal, Block, SignalAspect } from '../types.ts';
import { TrackNetwork } from './track.ts';
import { wrap, shortestLoopDelta, distance } from '../utils/math.ts';

export class SignalManager {
  public signals: Signal[] = [];
  public blocks: Block[] = [];
  private prevTrainHeadDist: number = 0;
  private prevTrainTrackId: number = 0;
  private hasInitialized: boolean = false;
  private trainHasMoved: boolean = false;
  private initialTrainHeadDist: number = 0;

  constructor(trackNet: TrackNetwork) {
    this.setupBlocksAndSignals(trackNet);
  }

  public setupBlocksAndSignals(trackNet: TrackNetwork): void {
    this.signals = [];
    this.blocks = [];

    for (let trackId = 0; trackId < 2; trackId++) {
      const track = trackNet.tracks[trackId];

      if (!track) continue;

      const totalLen = track.totalLength;
      const trackNum = trackId + 1;
      const trackSide = trackId === 1 ? -1 : 1;
      const isClosed = track.isClosed;

      if (isClosed) {
        const numBlocks = Math.max(3, Math.round(totalLen / 1250));
        const blockLen = totalLen / numBlocks;

        for (let i = 0; i < numBlocks; i++) {
          const boundaryDist = Math.round(i * blockLen);
          const fwdPrimDist = Math.round(wrap(boundaryDist + 18, totalLen));
          const revPrimDist = Math.round(wrap(boundaryDist - 18, totalLen));

          const fwdSecDist = Math.round(wrap(fwdPrimDist - 800, totalLen));
          const revSecDist = Math.round(wrap(revPrimDist + 800, totalLen));

          const fwdPrimId = `sig-p-t${trackId}-fwd-b${i + 1}`;
          const revPrimId = `sig-p-t${trackId}-rev-b${i + 1}`;
          const fwdSecId = `sig-d-t${trackId}-fwd-b${i + 1}`;
          const revSecId = `sig-d-t${trackId}-rev-b${i + 1}`;

          const primFwd = this.createSignal(
            trackNet, fwdPrimId, `Primary Signal ${trackNum}.${i + 1} ▸`,
            trackId, 'primary', fwdPrimDist, 1, trackSide, i
          );

          const primRev = this.createSignal(
            trackNet, revPrimId, `Primary Signal ${trackNum}.${i + 1}R ◂`,
            trackId, 'primary', revPrimDist, -1, trackSide, i + 50
          );

          const secFwd = this.createSignal(
            trackNet, fwdSecId, `Distant Signal ${trackNum}.${i + 1} ▸`,
            trackId, 'secondary', fwdSecDist, 1, trackSide, i, fwdPrimId
          );

          const secRev = this.createSignal(
            trackNet, revSecId, `Distant Signal ${trackNum}.${i + 1}R ◂`,
            trackId, 'secondary', revSecDist, -1, trackSide, i + 50, revPrimId
          );

          this.signals.push(primFwd, primRev, secFwd, secRev);
        }

        for (let b = 0; b < numBlocks; b++) {
          const startD = Math.round(b * blockLen) + 18;
          const endD = b === numBlocks - 1
            ? totalLen - 18
            : Math.round((b + 1) * blockLen) - 18;
          const nextIdx = (b + 1) % numBlocks;

          const fwdPrimId = `sig-p-t${trackId}-fwd-b${b + 1}`;
          const fwdSecId = `sig-d-t${trackId}-fwd-b${b + 1}`;
          const revPrimId = `sig-p-t${trackId}-rev-b${nextIdx + 1}`;
          const revSecId = `sig-d-t${trackId}-rev-b${nextIdx + 1}`;

          this.blocks.push({
            id: b,
            trackId,
            direction: 1,
            startDistance: startD,
            endDistance: endD,
            isOccupied: false,
            primarySignalId: fwdPrimId,
            secondarySignalId: fwdSecId
          });

          this.blocks.push({
            id: b + 50,
            trackId,
            direction: -1,
            startDistance: startD,
            endDistance: endD,
            isOccupied: false,
            primarySignalId: revPrimId,
            secondarySignalId: revSecId
          });
        }
      } else {
        const leadLen = Math.min(950, Math.round(totalLen * 0.20));
        const availableLen = totalLen - 2 * leadLen;
        const numBlocks = Math.max(2, Math.round(availableLen / 1200));
        const blockLen = availableLen / numBlocks;

        for (let i = 0; i <= numBlocks; i++) {
          const boundaryDist = Math.round(leadLen + i * blockLen);
          const fwdPrimDist = boundaryDist + 18;
          const revPrimDist = boundaryDist - 18;

          const fwdSecDist = Math.max(80, fwdPrimDist - 800);
          const revSecDist = Math.min(totalLen - 80, revPrimDist + 800);

          const fwdPrimId = `sig-p-t${trackId}-fwd-b${i + 1}`;
          const revPrimId = `sig-p-t${trackId}-rev-b${i + 1}`;
          const fwdSecId = `sig-d-t${trackId}-fwd-b${i + 1}`;
          const revSecId = `sig-d-t${trackId}-rev-b${i + 1}`;

          const primFwd = this.createSignal(
            trackNet, fwdPrimId, `Primary Signal ${trackNum}.${i + 1} ▸`,
            trackId, 'primary', fwdPrimDist, 1, trackSide, i
          );

          const primRev = this.createSignal(
            trackNet, revPrimId, `Primary Signal ${trackNum}.${i + 1}R ◂`,
            trackId, 'primary', revPrimDist, -1, trackSide, i + 50
          );

          const secFwd = this.createSignal(
            trackNet, fwdSecId, `Distant Signal ${trackNum}.${i + 1} ▸`,
            trackId, 'secondary', fwdSecDist, 1, trackSide, i, fwdPrimId
          );

          const secRev = this.createSignal(
            trackNet, revSecId, `Distant Signal ${trackNum}.${i + 1}R ◂`,
            trackId, 'secondary', revSecDist, -1, trackSide, i + 50, revPrimId
          );

          this.signals.push(primFwd, primRev, secFwd, secRev);
        }

        for (let b = 0; b < numBlocks; b++) {
          const startD = Math.round(leadLen + b * blockLen) + 18;
          const endD = Math.round(leadLen + (b + 1) * blockLen) - 18;

          const fwdPrimId = `sig-p-t${trackId}-fwd-b${b + 1}`;
          const fwdSecId = `sig-d-t${trackId}-fwd-b${b + 1}`;
          const revPrimId = `sig-p-t${trackId}-rev-b${b + 2}`;
          const revSecId = `sig-d-t${trackId}-rev-b${b + 2}`;

          this.blocks.push({
            id: b,
            trackId,
            direction: 1,
            startDistance: startD,
            endDistance: endD,
            isOccupied: false,
            primarySignalId: fwdPrimId,
            secondarySignalId: fwdSecId
          });

          this.blocks.push({
            id: b + 50,
            trackId,
            direction: -1,
            startDistance: startD,
            endDistance: endD,
            isOccupied: false,
            primarySignalId: revPrimId,
            secondarySignalId: revSecId
          });
        }
      }
    }
  }

  private createSignal(
    trackNet: TrackNetwork,
    id: string,
    name: string,
    trackId: number,
    type: 'primary' | 'secondary',
    distance: number,
    direction: 1 | -1,
    side: 1 | -1,
    blockId: number,
    linkedPrimaryId?: string
  ): Signal {
    const pt = trackNet.getStaticPointAtDistance(trackId, distance);
    const perp = pt.angle + (Math.PI / 2) * side;
    const worldX = pt.x + Math.cos(perp) * 22;
    const worldY = pt.y + Math.sin(perp) * 22;

    return {
      id,
      name,
      trackId,
      type,
      distance,
      aspect: 'green',
      side,
      direction,
      manualOverride: false,
      manualAspect: null,
      blockId,
      linkedPrimaryId,
      worldX,
      worldY
    };
  }

  private isSpanOverlappingBlock(
    trainStart: number,
    trainEnd: number,
    blockStart: number,
    blockEnd: number,
    trackLength: number
  ): boolean {
    const bs = wrap(blockStart, trackLength);
    let be = wrap(blockEnd, trackLength);

    if (be <= bs) be += trackLength;

    const s = wrap(trainStart, trackLength);
    const e = wrap(trainEnd, trackLength);

    const spans: [number, number][] = [];

    if (s <= e) {
      spans.push([s, e]);
      spans.push([s + trackLength, e + trackLength]);
    } else {
      spans.push([s, trackLength]);
      spans.push([0, e]);
      spans.push([s + trackLength, 2 * trackLength]);
      spans.push([trackLength, e + trackLength]);
    }

    for (const [ts, te] of spans) {
      if (Math.max(ts, bs) < Math.min(te, be)) {
        return true;
      }
    }

    return false;
  }

  public update(
    trainTrackId: number,
    trainHeadDist: number,
    trainTailDist: number,
    trackNet: TrackNetwork,
    _dt: number,
    trainFacing: 1 | -1 = 1
  ): { spad: boolean; signalName?: string } {
    if (!this.hasInitialized) {
      this.prevTrainHeadDist = trainHeadDist;
      this.prevTrainTrackId = trainTrackId;
      this.initialTrainHeadDist = trainHeadDist;
      this.hasInitialized = true;
    }

    if (this.prevTrainTrackId !== trainTrackId) {
      this.prevTrainTrackId = trainTrackId;
      this.prevTrainHeadDist = trainHeadDist;
      this.initialTrainHeadDist = trainHeadDist;
      this.trainHasMoved = false;
    }

    if (!this.trainHasMoved && Math.abs(trainHeadDist - this.initialTrainHeadDist) > 2) {
      this.trainHasMoved = true;
    }

    const currentTrack = trackNet.tracks[trainTrackId];

    if (!currentTrack) return { spad: false };

    const trackLen = currentTrack.totalLength;
    const activeDir = trainFacing;

    let spadOccurred = false;
    let spadSigName = '';

    if (this.prevTrainTrackId === trainTrackId && this.trainHasMoved) {
      const delta = shortestLoopDelta(this.prevTrainHeadDist, trainHeadDist, trackLen);

      if (delta > 0.001 && activeDir === 1) {
        for (const sig of this.signals) {
          if (sig.trackId === trainTrackId && sig.type === 'primary' && sig.direction === 1) {
            const distToSig = wrap(sig.distance - this.prevTrainHeadDist, trackLen);

            if (distToSig <= delta && sig.aspect === 'red') {
              spadOccurred = true;
              spadSigName = sig.name;
              break;
            }
          }
        }
      } else if (delta < -0.001 && activeDir === -1) {
        const absDelta = -delta;

        for (const sig of this.signals) {
          if (sig.trackId === trainTrackId && sig.type === 'primary' && sig.direction === -1) {
            const distToSig = wrap(this.prevTrainHeadDist - sig.distance, trackLen);

            if (distToSig <= absDelta && sig.aspect === 'red') {
              spadOccurred = true;
              spadSigName = sig.name;
              break;
            }
          }
        }
      }
    }

    let trainStart = trainTailDist;
    let trainEnd = trainHeadDist;

    if (currentTrack.isClosed) {
      if (Math.abs(trainEnd - trainStart) > trackLen / 2) {
        if (trainStart < trainEnd) {
          const tmp = trainStart;
          trainStart = trainEnd;
          trainEnd = tmp;
        }
      } else {
        if (trainStart > trainEnd) {
          const tmp = trainStart;
          trainStart = trainEnd;
          trainEnd = tmp;
        }
      }
    } else {
      const minD = Math.min(trainStart, trainEnd);
      const maxD = Math.max(trainStart, trainEnd);
      trainStart = minD;
      trainEnd = maxD;
    }

    for (const block of this.blocks) {
      if (!this.trainHasMoved || block.trackId !== trainTrackId) {
        block.isOccupied = false;
        continue;
      }

      block.isOccupied = this.isSpanOverlappingBlock(
        trainStart,
        trainEnd,
        block.startDistance,
        block.endDistance,
        trackLen
      );
    }

    for (const block of this.blocks) {
      const primSig = this.signals.find(s => s.id === block.primarySignalId);

      if (primSig) {
        if (primSig.manualAspect !== null && primSig.manualAspect !== undefined) {
          primSig.aspect = primSig.manualAspect;
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

        const colocatedPrim = this.signals.find(s =>
          s.type === 'primary' &&
          s.trackId === secSig.trackId &&
          s.direction === secSig.direction &&
          Math.abs(s.distance - secSig.distance) <= 35
        );

        if (colocatedPrim && colocatedPrim.aspect === 'red') {
          secSig.aspect = 'dark';
        }
      }
    }

    this.prevTrainHeadDist = trainHeadDist;
    this.prevTrainTrackId = trainTrackId;

    return { spad: spadOccurred, signalName: spadSigName };
  }

  public toggleSignalAt(worldX: number, worldY: number, radius: number = 22): { signal: Signal; message: string } | null {
    let closest: Signal | null = null;
    let minDist = radius;

    for (const sig of this.signals) {
      if (sig.worldX !== undefined && sig.worldY !== undefined) {
        const d = distance(sig.worldX, sig.worldY, worldX, worldY);

        if (d <= minDist) {
          minDist = d;
          closest = sig;
        }
      }
    }

    if (!closest) return null;

    const sig = closest;

    if (sig.type === 'primary') {
      const nextAspect: SignalAspect = sig.aspect === 'red' ? 'green' : 'red';
      sig.manualAspect = nextAspect;
      sig.manualOverride = true;
      sig.aspect = nextAspect;

      const linkedSec = this.signals.find(s => s.linkedPrimaryId === sig.id);

      if (linkedSec) {
        linkedSec.aspect = nextAspect === 'red' ? 'yellow' : 'green';
        linkedSec.manualAspect = linkedSec.aspect;
        linkedSec.manualOverride = true;
      }

      const aspectLabel = sig.aspect === 'red' ? 'Stop' : 'Clear';
      const msg = `${sig.name} Aspect: ${aspectLabel}`;

      return { signal: sig, message: msg };
    } else {
      const linkedPrim = this.signals.find(s => s.id === sig.linkedPrimaryId);

      if (linkedPrim) {
        const nextPrimAspect: SignalAspect = linkedPrim.aspect === 'red' ? 'green' : 'red';
        linkedPrim.manualAspect = nextPrimAspect;
        linkedPrim.manualOverride = true;
        linkedPrim.aspect = nextPrimAspect;

        sig.aspect = nextPrimAspect === 'red' ? 'yellow' : 'green';
        sig.manualAspect = sig.aspect;
        sig.manualOverride = true;

        const aspectLabel = sig.aspect === 'yellow' ? 'Expect Stop' : 'Expect Clear';
        const msg = `${sig.name} Aspect: ${aspectLabel}`;

        return { signal: sig, message: msg };
      }
    }

    return null;
  }

  public getNextSignalAhead(
    trackId: number,
    trainDist: number,
    trackLength: number,
    direction: 1 | -1 = 1
  ): { signal: Signal; distanceAhead: number } | null {
    let closest: Signal | null = null;
    let minDistance = Infinity;

    for (const sig of this.signals) {
      if (sig.trackId !== trackId) continue;
      if (sig.direction !== direction) continue;

      const delta = direction === 1
        ? wrap(sig.distance - trainDist, trackLength)
        : wrap(trainDist - sig.distance, trackLength);

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
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = sig.aspect === 'red' ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '700 7px "Geist Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = sig.direction === 1 ? 'P ▸' : '◂ P';
        ctx.fillText(label, 0, 16);
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

        if (sig.aspect === 'dark') {
          ctx.fillStyle = '#27272a';
        } else {
          ctx.fillStyle = sig.aspect === 'yellow' ? '#f59e0b' : '#10b981';
        }
        ctx.beginPath();
        ctx.moveTo(0, -size + 3);
        ctx.lineTo(size - 3, 0);
        ctx.lineTo(0, size - 3);
        ctx.lineTo(-size + 3, 0);
        ctx.closePath();
        ctx.fill();

        ctx.font = '700 7px "Geist Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = sig.direction === 1 ? 'D ▸' : '◂ D';
        ctx.fillText(label, 0, 16);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  public reset(): void {
    this.hasInitialized = false;
    this.trainHasMoved = false;

    for (const sig of this.signals) {
      sig.manualAspect = null;
      sig.manualOverride = false;
      sig.aspect = 'green';
    }

    for (const block of this.blocks) {
      block.isOccupied = false;
    }
  }
}
