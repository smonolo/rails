import type { Signal, Block, SignalAspect } from './types.ts';
import { TrackNetwork } from './track.ts';

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

  private setupBlocksAndSignals(trackNet: TrackNetwork): void {
    this.signals = [];
    this.blocks = [];

    for (let trackId = 0; trackId < 2; trackId++) {
      const totalLen = trackNet.tracks[trackId].totalLength;
      const numBlocks = 4;
      const blockLen = totalLen / numBlocks;
      const trackNum = trackId + 1;
      const side = trackId === 1 ? -1 : 1;

      for (let b = 0; b < numBlocks; b++) {
        const blockStart = (b * blockLen) % totalLen;
        const fwdPrimDist = (blockStart + 12) % totalLen;
        const nextFwdPrimDist = (((b + 1) * blockLen) + 12) % totalLen;
        let fwdSecDist = (fwdPrimDist - 800 + totalLen) % totalLen;

        const revPrimDist = ((b + 1) * blockLen - 12 + totalLen) % totalLen;
        const prevRevPrimDist = (b * blockLen - 12 + totalLen) % totalLen;
        const revSecDist = (revPrimDist + 800) % totalLen;

        const fwdPrimId = `sig-hp-t${trackId}-fwd-b${b + 1}`;
        const fwdSecId = `sig-vr-t${trackId}-fwd-b${b + 1}`;
        const revPrimId = `sig-hp-t${trackId}-rev-b${b + 1}`;
        const revSecId = `sig-vr-t${trackId}-rev-b${b + 1}`;

        const pFwdPt = trackNet.getStaticPointAtDistance(trackId, fwdPrimDist);
        const pFwdPerp = pFwdPt.angle + (Math.PI / 2) * side;
        const pFwdWorldX = pFwdPt.x + Math.cos(pFwdPerp) * 22;
        const pFwdWorldY = pFwdPt.y + Math.sin(pFwdPerp) * 22;

        const sFwdPt = trackNet.getStaticPointAtDistance(trackId, fwdSecDist);
        const sFwdPerp = sFwdPt.angle + (Math.PI / 2) * side;
        const sFwdWorldX = sFwdPt.x + Math.cos(sFwdPerp) * 22;
        const sFwdWorldY = sFwdPt.y + Math.sin(sFwdPerp) * 22;

        const pRevPt = trackNet.getStaticPointAtDistance(trackId, revPrimDist);
        const pRevPerp = pRevPt.angle + (Math.PI / 2) * side;
        const pRevWorldX = pRevPt.x + Math.cos(pRevPerp) * 22;
        const pRevWorldY = pRevPt.y + Math.sin(pRevPerp) * 22;

        const sRevPt = trackNet.getStaticPointAtDistance(trackId, revSecDist);
        const sRevPerp = sRevPt.angle + (Math.PI / 2) * side;
        const sRevWorldX = sRevPt.x + Math.cos(sRevPerp) * 22;
        const sRevWorldY = sRevPt.y + Math.sin(sRevPerp) * 22;

        const primFwd: Signal = {
          id: fwdPrimId,
          name: `Hauptsignal Hp ${trackNum}.${b + 1} ▸`,
          trackId,
          type: 'primary',
          distance: fwdPrimDist,
          aspect: 'green',
          side,
          direction: 1,
          manualOverride: false,
          manualAspect: null,
          blockId: b,
          worldX: pFwdWorldX,
          worldY: pFwdWorldY
        };

        const secFwd: Signal = {
          id: fwdSecId,
          name: `Vorsignal Vr ${trackNum}.${b + 1} ▸`,
          trackId,
          type: 'secondary',
          distance: fwdSecDist,
          aspect: 'green',
          side,
          direction: 1,
          manualOverride: false,
          manualAspect: null,
          blockId: b,
          linkedPrimaryId: fwdPrimId,
          worldX: sFwdWorldX,
          worldY: sFwdWorldY
        };

        const primRev: Signal = {
          id: revPrimId,
          name: `Hauptsignal Hp ${trackNum}.${b + 1}G ◂`,
          trackId,
          type: 'primary',
          distance: revPrimDist,
          aspect: 'green',
          side,
          direction: -1,
          manualOverride: false,
          manualAspect: null,
          blockId: b + 10,
          worldX: pRevWorldX,
          worldY: pRevWorldY
        };

        const secRev: Signal = {
          id: revSecId,
          name: `Vorsignal Vr ${trackNum}.${b + 1}G ◂`,
          trackId,
          type: 'secondary',
          distance: revSecDist,
          aspect: 'green',
          side,
          direction: -1,
          manualOverride: false,
          manualAspect: null,
          blockId: b + 10,
          linkedPrimaryId: revPrimId,
          worldX: sRevWorldX,
          worldY: sRevWorldY
        };

        this.signals.push(primFwd, secFwd, primRev, secRev);

        this.blocks.push({
          id: b,
          trackId,
          direction: 1,
          startDistance: fwdPrimDist,
          endDistance: nextFwdPrimDist,
          isOccupied: false,
          primarySignalId: fwdPrimId,
          secondarySignalId: fwdSecId
        });

        this.blocks.push({
          id: b + 10,
          trackId,
          direction: -1,
          startDistance: prevRevPrimDist,
          endDistance: revPrimDist,
          isOccupied: false,
          primarySignalId: revPrimId,
          secondarySignalId: revSecId
        });
      }
    }

    if (trackNet.tracks[2]) {
      const sidingLen = trackNet.tracks[2].totalLength;
      const sPt = trackNet.getStaticPointAtDistance(2, 40);
      const sPerp = sPt.angle - Math.PI / 2;
      const sWorldX = sPt.x + Math.cos(sPerp) * 20;
      const sWorldY = sPt.y + Math.sin(sPerp) * 20;

      const vrPt = trackNet.getStaticPointAtDistance(2, 15);
      const vrPerp = vrPt.angle - Math.PI / 2;
      const vrWorldX = vrPt.x + Math.cos(vrPerp) * 20;
      const vrWorldY = vrPt.y + Math.sin(vrPerp) * 20;

      this.signals.push({
        id: 'sig-siding-1',
        name: 'Sperrsignal Sh 1 ▸',
        trackId: 2,
        type: 'primary',
        distance: 40,
        aspect: 'green',
        side: -1,
        direction: 1,
        manualOverride: false,
        manualAspect: null,
        blockId: 99,
        worldX: sWorldX,
        worldY: sWorldY
      });

      this.signals.push({
        id: 'sig-siding-1-vr',
        name: 'Vorsignal Sh 1 ▸',
        trackId: 2,
        type: 'secondary',
        distance: 15,
        aspect: 'green',
        side: -1,
        direction: 1,
        manualOverride: false,
        manualAspect: null,
        blockId: 99,
        linkedPrimaryId: 'sig-siding-1',
        worldX: vrWorldX,
        worldY: vrWorldY
      });

      this.blocks.push({
        id: 99,
        trackId: 2,
        direction: 1,
        startDistance: 0,
        endDistance: sidingLen,
        isOccupied: false,
        primarySignalId: 'sig-siding-1',
        secondarySignalId: 'sig-siding-1-vr'
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
    const bs = normalize(blockStart);
    let be = normalize(blockEnd);

    if (be <= bs) be += trackLength;

    const s = normalize(trainStart);
    const e = normalize(trainEnd);

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
      let delta = trainHeadDist - this.prevTrainHeadDist;

      if (delta < -trackLen / 2) delta += trackLen;
      else if (delta > trackLen / 2) delta -= trackLen;

      if (delta > 0.001 && activeDir === 1) {
        for (const sig of this.signals) {
          if (sig.trackId === trainTrackId && sig.type === 'primary' && sig.direction === 1) {
            let distToSig = (sig.distance - this.prevTrainHeadDist) % trackLen;

            if (distToSig < 0) distToSig += trackLen;

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
            let distToSig = (this.prevTrainHeadDist - sig.distance) % trackLen;

            if (distToSig < 0) distToSig += trackLen;

            if (distToSig <= absDelta && sig.aspect === 'red') {
              spadOccurred = true;
              spadSigName = sig.name;
              break;
            }
          }
        }
      }
    }

    for (const block of this.blocks) {
      if (!this.trainHasMoved || block.trackId !== trainTrackId || block.direction !== activeDir) {
        block.isOccupied = false;
        continue;
      }

      const spanStart = Math.min(trainTailDist, trainHeadDist);
      const spanEnd = Math.max(trainTailDist, trainHeadDist);

      block.isOccupied = this.isSpanOverlappingBlock(
        spanStart,
        spanEnd,
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
        const d = Math.hypot(sig.worldX - worldX, sig.worldY - worldY);

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

      const aspectLabel = sig.aspect === 'red' ? 'Hp 0 (Stop)' : 'Hp 1 (Clear)';
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

        const aspectLabel = sig.aspect === 'yellow' ? 'Vr 0 (Expect Stop)' : 'Vr 1 (Expect Clear)';
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

      let delta: number;

      if (direction === 1) {
        delta = (sig.distance - trainDist) % trackLength;
        if (delta < 0) delta += trackLength;
      } else {
        delta = (trainDist - sig.distance) % trackLength;
        if (delta < 0) delta += trackLength;
      }

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
        const label = sig.direction === 1 ? 'Hp ▸' : '◂ Hp';
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

        ctx.fillStyle = sig.aspect === 'yellow' ? '#f59e0b' : '#10b981';
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
        const label = sig.direction === 1 ? 'Vr ▸' : '◂ Vr';
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
