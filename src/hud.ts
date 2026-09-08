import { Train } from './train.ts';
import { StationManager, type StationStatus } from './stations.ts';
import { SignalManager } from './signals.ts';
import { TrackNetwork } from './track.ts';
import { Camera } from './camera.ts';
import type { WarningAlert } from './types.ts';

export class HUD {
  private train: Train;
  private stationMgr: StationManager;
  private signalMgr: SignalManager;
  private trackNet: TrackNetwork;
  private camera: Camera;

  private speedEl!: HTMLElement;
  private stationInfoEl!: HTMLElement;
  private signalInfoEl!: HTMLElement;
  private signalDotEl!: HTMLElement;

  private throttleFillEl!: HTMLElement;
  private throttleHandleEl!: HTMLElement;
  private throttleValEl!: HTMLElement;
  private brakeFillEl!: HTMLElement;
  private brakeHandleEl!: HTMLElement;
  private brakeValEl!: HTMLElement;

  private dropdownMenuEl!: HTMLElement;
  private controlsModalEl!: HTMLElement;

  private warningBannerEl!: HTMLElement;
  private warningBadgeEl!: HTMLElement;
  private warningTitleEl!: HTMLElement;
  private warningDescEl!: HTMLElement;
  private warningResetBtnEl!: HTMLElement;
  private activeAlert: WarningAlert | null = null;

  private carrCountEl!: HTMLElement;
  private consistWeightEl!: HTMLElement;
  private btnCarrMinus!: HTMLElement;
  private btnCarrPlus!: HTMLElement;
  private btnEb!: HTMLElement;

  private draggingThrottle: boolean = false;
  private draggingBrake: boolean = false;

  constructor(
    train: Train,
    stationMgr: StationManager,
    signalMgr: SignalManager,
    trackNet: TrackNetwork,
    camera: Camera
  ) {
    this.train = train;
    this.stationMgr = stationMgr;
    this.signalMgr = signalMgr;
    this.trackNet = trackNet;
    this.camera = camera;

    this.bindDom();
    this.setupEventListeners();
  }

  private bindDom(): void {
    this.speedEl = document.getElementById('hud-speed-num')!;
    this.stationInfoEl = document.getElementById('hud-station-info')!;
    this.signalInfoEl = document.getElementById('hud-signal-info')!;
    this.signalDotEl = document.getElementById('hud-signal-dot')!;

    this.throttleFillEl = document.getElementById('throttle-bar-fill')!;
    this.throttleHandleEl = document.getElementById('throttle-handle')!;
    this.throttleValEl = document.getElementById('throttle-val')!;

    this.brakeFillEl = document.getElementById('brake-bar-fill')!;
    this.brakeHandleEl = document.getElementById('brake-handle')!;
    this.brakeValEl = document.getElementById('brake-val')!;

    this.dropdownMenuEl = document.getElementById('dropdown-menu')!;
    this.controlsModalEl = document.getElementById('controls-modal')!;

    this.warningBannerEl = document.getElementById('warning-banner')!;
    this.warningBadgeEl = document.getElementById('warning-badge')!;
    this.warningTitleEl = document.getElementById('warning-title')!;
    this.warningDescEl = document.getElementById('warning-desc')!;
    this.warningResetBtnEl = document.getElementById('warning-reset-btn')!;

    this.carrCountEl = document.getElementById('carr-count-val')!;
    this.consistWeightEl = document.getElementById('consist-weight-val')!;
    this.btnCarrMinus = document.getElementById('btn-carr-minus')!;
    this.btnCarrPlus = document.getElementById('btn-carr-plus')!;
    this.btnEb = document.getElementById('btn-eb')!;
  }

  private setupEventListeners(): void {
    const toggleBtn = document.getElementById('btn-dropdown-toggle')!;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dropdownMenuEl.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      this.dropdownMenuEl.classList.add('hidden');
    });

    this.dropdownMenuEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.getElementById('btn-menu-center')?.addEventListener('click', () => {
      const pt = this.trackNet.getPointAtDistance(this.train.trackId, this.train.distance);
      this.camera.resetToTrain(pt.x, pt.y);
      this.dropdownMenuEl.classList.add('hidden');
    });

    document.getElementById('btn-menu-respawn')?.addEventListener('click', () => {
      this.respawnTrain();
    });

    document.getElementById('btn-menu-controls')?.addEventListener('click', () => {
      this.openControlsModal();
      this.dropdownMenuEl.classList.add('hidden');
    });

    this.btnCarrMinus?.addEventListener('click', () => {
      if (this.train.carriageCount > 0) {
        this.train.setCarriageCount(this.train.carriageCount - 1);
        this.updateConsistDisplay();
      }
    });

    this.btnCarrPlus?.addEventListener('click', () => {
      if (this.train.carriageCount < 10) {
        this.train.setCarriageCount(this.train.carriageCount + 1);
        this.updateConsistDisplay();
      }
    });

    this.btnEb?.addEventListener('click', () => {
      if (!this.train.isEmergencyBrakeLocked) {
        this.triggerEmergencyBrake('Emergency brake applied by driver');
      } else if (this.train.speedKmH === 0) {
        this.attemptResetAlert();
      }
    });

    document.getElementById('btn-close-modal')?.addEventListener('click', () => {
      this.closeControlsModal();
    });

    this.controlsModalEl.addEventListener('click', (e) => {
      if (e.target === this.controlsModalEl) {
        this.closeControlsModal();
      }
    });

    this.warningResetBtnEl.addEventListener('click', () => {
      this.attemptResetAlert();
    });

    document.getElementById('btn-fwd')?.addEventListener('click', () => this.setReverser(1));
    document.getElementById('btn-neu')?.addEventListener('click', () => this.setReverser(0));
    document.getElementById('btn-rev')?.addEventListener('click', () => this.setReverser(-1));

    const throttleTrack = document.getElementById('throttle-track')!;
    const brakeTrack = document.getElementById('brake-track')!;

    const onLeverMove = (trackEl: HTMLElement, clientY: number, setter: (val: number) => void) => {
      if (this.train.isEmergencyBrakeLocked) return;

      const rect = trackEl.getBoundingClientRect();
      const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));
      const fraction = 1 - (clampedY - rect.top) / rect.height;

      setter(Math.round(fraction * 100) / 100);
      this.updateLeverHandles();
    };

    throttleTrack.addEventListener('pointerdown', (e) => {
      if (this.train.isEmergencyBrakeLocked) return;

      this.draggingThrottle = true;

      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {}

      onLeverMove(throttleTrack, e.clientY, (v) => (this.train.targetThrottle = v));
    });

    brakeTrack.addEventListener('pointerdown', (e) => {
      if (this.train.isEmergencyBrakeLocked) return;

      this.draggingBrake = true;

      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {}

      onLeverMove(brakeTrack, e.clientY, (v) => (this.train.targetBrake = v));
    });

    window.addEventListener('pointermove', (e) => {
      if (this.draggingThrottle) {
        onLeverMove(throttleTrack, e.clientY, (v) => (this.train.targetThrottle = v));
      } else if (this.draggingBrake) {
        onLeverMove(brakeTrack, e.clientY, (v) => (this.train.targetBrake = v));
      }
    });

    const stopAllDrags = (e: PointerEvent) => {
      if (this.draggingThrottle) {
        this.draggingThrottle = false;
        try {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {}
      }

      if (this.draggingBrake) {
        this.draggingBrake = false;
        try {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {}
      }
    };

    window.addEventListener('pointerup', stopAllDrags);
    window.addEventListener('pointercancel', stopAllDrags);

    const keysPressed: Record<string, boolean> = {};

    window.addEventListener('keydown', (e) => {
      const isRepeat = e.repeat;
      keysPressed[e.code] = true;

      if (e.code === 'KeyH') {
        if (this.controlsModalEl.classList.contains('hidden')) {
          this.openControlsModal();
        } else {
          this.closeControlsModal();
        }
        return;
      }

      if (e.code === 'Escape') {
        this.closeControlsModal();
        this.dropdownMenuEl.classList.add('hidden');
        return;
      }

      if (!this.train.isEmergencyBrakeLocked) {
        if (e.code === 'KeyF') this.setReverser(1);
        if (e.code === 'KeyN') this.setReverser(0);
        if (e.code === 'KeyR') this.setReverser(-1);
      }

      if (e.code === 'KeyC') {
        const pt = this.trackNet.getPointAtDistance(this.train.trackId, this.train.distance);
        this.camera.resetToTrain(pt.x, pt.y);
      }

      if (e.code === 'KeyX') {
        if (!this.train.isEmergencyBrakeLocked) {
          this.triggerEmergencyBrake('Emergency brake applied by driver');
        } else if (this.train.speedKmH === 0) {
          this.attemptResetAlert();
        }
      }

      if (!isRepeat) {
        if (this.train.isCrashed) {
          if (e.code === 'KeyR' || e.code === 'Space') {
            this.respawnTrain();
          }
          return;
        }

        if (this.train.isEmergencyBrakeLocked) {
          if (e.code === 'Space' && this.train.speedKmH === 0) {
            this.attemptResetAlert();
          }
          return;
        }

        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          this.train.targetThrottle = Math.min(1, +(this.train.targetThrottle + 0.01).toFixed(2));
        } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.train.targetThrottle = Math.max(0, +(this.train.targetThrottle - 0.01).toFixed(2));
        } else if (e.code === 'Space' || e.code === 'KeyB') {
          this.train.targetBrake = Math.min(1, +(this.train.targetBrake + 0.01).toFixed(2));
        } else if (e.code === 'KeyV') {
          this.train.targetBrake = Math.max(0, +(this.train.targetBrake - 0.01).toFixed(2));
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      keysPressed[e.code] = false;
    });

    setInterval(() => {
      if (this.train.isEmergencyBrakeLocked) return;

      const fineStep = 0.01;

      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) {
        this.train.targetThrottle = Math.min(1, +(this.train.targetThrottle + fineStep).toFixed(2));
      }

      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
        this.train.targetThrottle = Math.max(0, +(this.train.targetThrottle - fineStep).toFixed(2));
      }

      if (keysPressed['Space'] || keysPressed['KeyB']) {
        this.train.targetBrake = Math.min(1, +(this.train.targetBrake + fineStep).toFixed(2));
      }

      if (keysPressed['KeyV']) {
        this.train.targetBrake = Math.max(0, +(this.train.targetBrake - fineStep).toFixed(2));
      }
    }, 40);
  }

  public openControlsModal(): void {
    this.controlsModalEl.classList.remove('hidden');
  }

  public closeControlsModal(): void {
    this.controlsModalEl.classList.add('hidden');
  }

  public triggerEmergencyBrake(reason: string): void {
    this.train.tripEmergencyBrake(reason);

    this.triggerAlert({
      type: 'danger',
      title: 'Emergency brake tripped',
      message: `${reason}. Wait until train comes to a complete stop to reset.`,
      canReset: false
    });
  }

  public triggerAlert(alert: WarningAlert): void {
    this.activeAlert = alert;
    this.warningBannerEl.classList.remove('hidden');

    if (alert.type === 'info') {
      this.warningBannerEl.classList.add('info-alert');
      this.warningBadgeEl.textContent = 'Info';
    } else {
      this.warningBannerEl.classList.remove('info-alert');
      this.warningBadgeEl.textContent = alert.type === 'danger' ? 'SPAD' : 'Warn';
    }

    this.warningTitleEl.textContent = alert.title;
    this.warningDescEl.textContent = alert.message;
  }

  public clearAlert(): void {
    this.activeAlert = null;
    this.warningBannerEl.classList.add('hidden');
    this.warningBannerEl.classList.remove('info-alert');
  }

  public respawnTrain(): void {
    this.train.spawnRandom(this.trackNet);

    const pt = this.trackNet.getStaticPointAtDistance(this.train.trackId, this.train.distance);
    this.camera.resetToTrain(pt.x, pt.y);

    this.clearAlert();
    this.updateLeverHandles();
    this.updateConsistDisplay();
    this.setReverser(1);
    this.dropdownMenuEl.classList.add('hidden');
  }

  private attemptResetAlert(): void {
    if (this.train.isCrashed) {
      this.respawnTrain();
      return;
    }

    if (this.train.resetEmergencyBrake()) {
      this.clearAlert();
    }
  }

  public updateConsistDisplay(): void {
    if (this.carrCountEl) {
      this.carrCountEl.textContent = `${this.train.carriageCount}`;
    }

    if (this.consistWeightEl) {
      this.consistWeightEl.textContent = `${this.train.totalWeightTons} t`;
    }
  }

  public setReverser(pos: 1 | 0 | -1): void {
    if (this.train.isEmergencyBrakeLocked) return;

    this.train.reverser = pos;
    document.querySelectorAll('.rev-btn').forEach(btn => btn.classList.remove('active'));

    if (pos === 1) document.getElementById('btn-fwd')?.classList.add('active');
    else if (pos === 0) document.getElementById('btn-neu')?.classList.add('active');
    else if (pos === -1) document.getElementById('btn-rev')?.classList.add('active');
  }

  public updateLeverHandles(): void {
    const targetThrottlePct = Math.round(this.train.targetThrottle * 100);
    this.throttleHandleEl.style.bottom = `${targetThrottlePct}%`;
    this.throttleValEl.textContent = `${targetThrottlePct}%`;

    const targetBrakePct = Math.round(this.train.targetBrake * 100);
    this.brakeHandleEl.style.bottom = `${targetBrakePct}%`;
    this.brakeValEl.textContent = `${targetBrakePct}%`;
  }

  public update(stationStatus: StationStatus): void {
    const speed = this.train.speedKmH;
    this.speedEl.textContent = `${speed}`;

    this.updateConsistDisplay();

    if (this.activeAlert) {
      if (this.train.isCrashed) {
        this.warningBadgeEl.textContent = 'CRASH';
        this.warningTitleEl.textContent = 'Train crashed';
        this.warningDescEl.textContent = 'Collision with buffer stop at terminal dead track. Respawn required.';
        this.warningResetBtnEl.textContent = 'Respawn';
        this.warningResetBtnEl.classList.remove('hidden');
      } else if (this.train.isEmergencyBrakeLocked) {
        this.warningResetBtnEl.textContent = 'Reset';

        if (speed === 0) {
          this.warningDescEl.textContent = 'Train stopped. Press Space or click Reset to restore controls.';
          this.warningResetBtnEl.classList.remove('hidden');
        } else {
          this.warningDescEl.textContent = `Braking to a standstill (${speed} km/h)... Reset locked.`;
          this.warningResetBtnEl.classList.add('hidden');
        }
      }
    }

    const currentTrackLen = this.trackNet.tracks[this.train.trackId].totalLength;
    const nextStn = this.stationMgr.getNextStationAhead(this.train.trackId, this.train.distance, currentTrackLen);

    if (stationStatus.currentStation) {
      this.stationInfoEl.innerHTML = `<span class="badge-active">Passing ${stationStatus.currentStation.name}</span><br/><span class="sub">Platform waypoint</span>`;
    } else if (nextStn) {
      const distM = Math.round(nextStn.distanceAhead);
      this.stationInfoEl.innerHTML = `<span>Next: ${nextStn.station.name}</span><br/><span class="sub">${distM} m ahead</span>`;
    } else {
      this.stationInfoEl.innerHTML = `<span>Line clear</span><br/><span class="sub">Cruising</span>`;
    }

    const nextSig = this.signalMgr.getNextSignalAhead(this.train.trackId, this.train.distance, currentTrackLen);

    if (nextSig) {
      const distM = Math.round(nextSig.distanceAhead);
      const aspect = nextSig.signal.aspect.charAt(0).toUpperCase() + nextSig.signal.aspect.slice(1);
      const typeTag = nextSig.signal.type === 'primary' ? 'P' : 'S';

      this.signalInfoEl.textContent = `[${typeTag}] ${nextSig.signal.name} (${distM} m) - ${aspect}`;

      let color = '#10b981';

      if (nextSig.signal.aspect === 'yellow') {
        color = '#f59e0b';
      } else if (nextSig.signal.aspect === 'red') {
        color = '#ef4444';
      }

      this.signalDotEl.style.backgroundColor = color;
    }

    const targetThrottlePct = Math.round(this.train.targetThrottle * 100);
    this.throttleHandleEl.style.bottom = `${targetThrottlePct}%`;
    this.throttleValEl.textContent = `${targetThrottlePct}%`;

    const actualThrottlePct = Math.round(this.train.throttle * 100);
    this.throttleFillEl.style.height = `${actualThrottlePct}%`;

    const targetBrakePct = Math.round(this.train.targetBrake * 100);
    this.brakeHandleEl.style.bottom = `${targetBrakePct}%`;
    this.brakeValEl.textContent = `${targetBrakePct}%`;

    const actualBrakePct = Math.round(this.train.brake * 100);
    this.brakeFillEl.style.height = `${actualBrakePct}%`;
  }
}
