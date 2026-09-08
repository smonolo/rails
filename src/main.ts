import './style.css';
import { TrackNetwork } from './track.ts';
import { Train } from './train.ts';
import { SignalManager } from './signals.ts';
import { StationManager } from './stations.ts';
import { Camera } from './camera.ts';
import { HUD } from './hud.ts';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trackNet: TrackNetwork;
  private train: Train;
  private signalMgr: SignalManager;
  private stationMgr: StationManager;
  private camera: Camera;
  private hud: HUD;

  private lastTime: number = 0;
  private dpr: number = 1;
  private mouseDownPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.trackNet = new TrackNetwork();
    this.train = new Train(this.trackNet);
    this.signalMgr = new SignalManager(this.trackNet);
    this.stationMgr = new StationManager(this.trackNet);

    const spawnPt = this.trackNet.getPointAtDistance(this.train.trackId, this.train.distance);
    this.camera = new Camera(spawnPt.x, spawnPt.y);

    this.hud = new HUD(this.train, this.stationMgr, this.signalMgr, this.trackNet, this.camera);

    this.setupResize();
    this.setupInput();

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupResize(): void {
    const resize = () => {
      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = window.innerWidth * this.dpr;
      this.canvas.height = window.innerHeight * this.dpr;
      this.canvas.style.width = `${window.innerWidth}px`;
      this.canvas.style.height = `${window.innerHeight}px`;
    };

    window.addEventListener('resize', resize);
    resize();
  }

  private setupInput(): void {
    const container = document.getElementById('canvas-container')!;

    container.addEventListener('mousedown', (e) => {
      this.mouseDownPos = { x: e.clientX, y: e.clientY };
      this.camera.onMouseDown(e);
    });

    window.addEventListener('mousemove', (e) => {
      this.camera.onMouseMove(e);

      const width = this.canvas.width / this.dpr;
      const height = this.canvas.height / this.dpr;
      const world = this.camera.screenToWorld(e.clientX, e.clientY, width, height);

      const isOverSwitch = !!this.trackNet.findSwitchAt(world.x, world.y, 20);
      let isOverSignal = false;

      for (const sig of this.signalMgr.signals) {
        if (sig.worldX !== undefined && sig.worldY !== undefined) {
          if (Math.hypot(sig.worldX - world.x, sig.worldY - world.y) <= 18) {
            isOverSignal = true;
            break;
          }
        }
      }

      if (isOverSwitch || isOverSignal) {
        container.style.cursor = 'pointer';
      } else {
        container.style.cursor = this.camera.isDragging ? 'grabbing' : 'grab';
      }
    });

    window.addEventListener('mouseup', (e) => {
      const dragDist = Math.hypot(e.clientX - this.mouseDownPos.x, e.clientY - this.mouseDownPos.y);

      if (dragDist < 6) {
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;
        const world = this.camera.screenToWorld(e.clientX, e.clientY, width, height);

        const clickedSwitch = this.trackNet.findSwitchAt(world.x, world.y, 22);

        if (clickedSwitch) {
          if (this.trackNet.isSwitchOccupied(clickedSwitch.id, this.train.trackId, this.train.headDistance, this.train.tailDistance, this.train.activeTransition?.zone.switchId)) {
            this.hud.triggerAlert({
              type: 'info',
              title: clickedSwitch.name,
              message: 'Switch locked: track segment is occupied by a train.',
              canReset: true
            });

            setTimeout(() => this.hud.clearAlert(), 3500);
          } else {
            const newState = this.trackNet.toggleSwitch(clickedSwitch.id);
            const stateStr = newState === 'diverging' ? 'diverging route' : 'straight route';

            this.hud.triggerAlert({
              type: 'info',
              title: `${clickedSwitch.name}`,
              message: `Route switched to ${stateStr}.`,
              canReset: true
            });

            setTimeout(() => this.hud.clearAlert(), 3500);
          }
        } else {
          const result = this.signalMgr.toggleSignalAt(world.x, world.y, 22);

          if (result) {
            this.hud.triggerAlert({
              type: 'info',
              title: `${result.signal.name}`,
              message: result.message,
              canReset: true
            });

            setTimeout(() => this.hud.clearAlert(), 3500);
          }
        }
      }

      this.camera.onMouseUp();
      container.style.cursor = 'grab';
    });

    container.addEventListener('wheel', (e) => this.camera.onWheel(e), { passive: false });
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    this.train.update(dt, this.trackNet);

    if (this.train.isCrashed) {
      this.hud.triggerAlert({
        type: 'danger',
        title: 'Train crashed',
        message: 'Catastrophic collision with buffer stop at terminal dead track. Respawn required.',
        canReset: false
      });
    }

    const signalEvent = this.signalMgr.update(
      this.train.trackId,
      this.train.headDistance,
      this.train.tailDistance,
      this.trackNet,
      dt
    );

    if (signalEvent.spad && !this.train.isEmergencyBrakeLocked) {
      this.train.tripEmergencyBrake(`SPAD at ${signalEvent.signalName}`);

      this.hud.triggerAlert({
        type: 'danger',
        title: 'Signal passed at danger',
        message: `Passed ${signalEvent.signalName} at Danger (Red). Emergency brake applied.`,
        canReset: false
      });
    }

    const stationStatus = this.stationMgr.update(
      this.train.trackId,
      this.train.distance,
      this.train.speed,
      dt,
      this.trackNet
    );

    const trainPt = this.trackNet.getPointAtDistance(this.train.trackId, this.train.distance);

    this.camera.follow(trainPt.x, trainPt.y);
    this.camera.update(dt);

    this.hud.update(stationStatus);
  }

  private render(): void {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);

    this.ctx.fillStyle = '#121215';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.save();
    this.camera.applyTransform(this.ctx, width, height);

    const bounds = this.camera.worldBounds;
    const bW = bounds.maxX - bounds.minX;
    const bH = bounds.maxY - bounds.minY;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([8, 8]);
    this.ctx.strokeRect(bounds.minX, bounds.minY, bW, bH);
    this.ctx.setLineDash([]);

    const cLen = 22;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();

    this.ctx.moveTo(bounds.minX, bounds.minY + cLen);
    this.ctx.lineTo(bounds.minX, bounds.minY);
    this.ctx.lineTo(bounds.minX + cLen, bounds.minY);

    this.ctx.moveTo(bounds.maxX - cLen, bounds.minY);
    this.ctx.lineTo(bounds.maxX, bounds.minY);
    this.ctx.lineTo(bounds.maxX, bounds.minY + cLen);

    this.ctx.moveTo(bounds.maxX, bounds.maxY - cLen);
    this.ctx.lineTo(bounds.maxX, bounds.maxY);
    this.ctx.lineTo(bounds.maxX - cLen, bounds.maxY);

    this.ctx.moveTo(bounds.minX + cLen, bounds.maxY);
    this.ctx.lineTo(bounds.minX, bounds.maxY);
    this.ctx.lineTo(bounds.minX, bounds.maxY - cLen);
    this.ctx.stroke();

    this.trackNet.render(this.ctx);
    this.stationMgr.render(this.ctx, this.trackNet);
    this.signalMgr.render(this.ctx, this.trackNet);
    this.train.render(this.ctx, this.trackNet);

    this.ctx.restore();
    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
