import { Train } from '../core/train.ts';
import { StationManager, type StationStatus } from '../core/stations.ts';
import { SignalManager } from '../core/signals.ts';
import { TrackNetwork } from '../core/track.ts';
import { Camera } from './camera.ts';
import { clamp } from '../utils/math.ts';
import { AdvancedSystemsManager } from '../core/advanced.ts';
import type { WarningAlert, TrainType, WorldShape, WorldSize, ActiveSpeedSign, SpeedSign } from '../types.ts';

export class HUD {
  private train: Train;
  private stationMgr: StationManager;
  private signalMgr: SignalManager;
  private trackNet: TrackNetwork;
  private camera: Camera;
  public advancedSystemsMgr: AdvancedSystemsManager;
  public selectedShape: WorldShape = 'O';
  public selectedSize: WorldSize = 'M';
  public onRegenerateShape?: (shape: WorldShape, size: WorldSize) => void;

  private speedEl!: HTMLElement;
  private activeSignEl!: HTMLElement;
  private lastActiveSignKey: string = '';
  private speedMiniSignEl!: HTMLElement;
  private speedInfoTextEl!: HTMLElement;
  private lastUpcomingSignKey: string = '';
  private stationInfoEl!: HTMLElement;
  private signalInfoEl!: HTMLElement;
  private signalDotEl!: HTMLElement;

  private throttleFillEl!: HTMLElement;
  private throttleHandleEl!: HTMLElement;
  private throttleValEl: HTMLElement | null = null;
  private brakeFillEl!: HTMLElement;
  private brakeHandleEl!: HTMLElement;
  private brakeValEl: HTMLElement | null = null;

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

  private btnDeadmanEl!: HTMLElement;
  private deadmanLampTextEl!: HTMLElement;

  private trainConfigCardEl!: HTMLElement;
  private btnToggleTrainConfigEl!: HTMLElement;
  private btnCloseTrainConfigEl!: HTMLElement;

  private worldConfigCardEl!: HTMLElement;
  private btnToggleWorldConfigEl!: HTMLElement;
  private btnCloseWorldConfigEl!: HTMLElement;
  private btnWorldRegenerateEl!: HTMLElement;

  private advancedConfigCardEl!: HTMLElement;
  private btnToggleAdvancedConfigEl!: HTMLElement;
  private btnCloseAdvancedConfigEl!: HTMLElement;
  private btnToggleAdvancedEl!: HTMLElement;
  private btnToggleDeadmanEl!: HTMLElement;

  private reverserTrackEl!: HTMLElement;
  private reverserHandleEl!: HTMLElement;
  private reverserValEl: HTMLElement | null = null;
  private reverserFillEl!: HTMLElement;

  private draggingThrottle: boolean = false;
  private draggingBrake: boolean = false;
  private draggingReverser: boolean = false;

  constructor(
    train: Train,
    stationMgr: StationManager,
    signalMgr: SignalManager,
    trackNet: TrackNetwork,
    camera: Camera,
    advancedSystemsMgr: AdvancedSystemsManager
  ) {
    this.train = train;
    this.stationMgr = stationMgr;
    this.signalMgr = signalMgr;
    this.trackNet = trackNet;
    this.camera = camera;
    this.advancedSystemsMgr = advancedSystemsMgr;
    this.selectedShape = trackNet.shape;
    this.selectedSize = trackNet.size;

    this.bindDom();
    this.setupEventListeners();
    this.updateLeverHandles();
    this.syncWorldConfigUI();
  }

  private bindDom(): void {
    this.speedEl = document.getElementById('hud-speed-num')!;
    this.activeSignEl = document.getElementById('hud-active-sign')!;
    this.speedMiniSignEl = document.getElementById('hud-speed-mini-sign')!;
    this.speedInfoTextEl = document.getElementById('hud-speed-info-text')!;
    this.stationInfoEl = document.getElementById('hud-station-info')!;
    this.signalInfoEl = document.getElementById('hud-signal-info')!;
    this.signalDotEl = document.getElementById('hud-signal-dot')!;

    this.reverserTrackEl = document.getElementById('reverser-track')!;
    this.reverserHandleEl = document.getElementById('reverser-handle')!;
    this.reverserValEl = document.getElementById('reverser-val');
    this.reverserFillEl = document.getElementById('reverser-bar-fill')!;

    this.throttleFillEl = document.getElementById('throttle-bar-fill')!;
    this.throttleHandleEl = document.getElementById('throttle-handle')!;
    this.throttleValEl = document.getElementById('throttle-val');
    this.brakeFillEl = document.getElementById('brake-bar-fill')!;
    this.brakeHandleEl = document.getElementById('brake-handle')!;
    this.brakeValEl = document.getElementById('brake-val');
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

    this.btnDeadmanEl = document.getElementById('btn-deadman')!;
    this.deadmanLampTextEl = document.getElementById('deadman-lamp-text')!;

    this.trainConfigCardEl = document.getElementById('train-config-card')!;
    this.btnToggleTrainConfigEl = document.getElementById('btn-toggle-train-config')!;
    this.btnCloseTrainConfigEl = document.getElementById('btn-close-train-config')!;

    this.worldConfigCardEl = document.getElementById('world-config-card')!;
    this.btnToggleWorldConfigEl = document.getElementById('btn-toggle-world-config')!;
    this.btnCloseWorldConfigEl = document.getElementById('btn-close-world-config')!;
    this.btnWorldRegenerateEl = document.getElementById('btn-world-regenerate')!;

    this.advancedConfigCardEl = document.getElementById('advanced-config-card')!;
    this.btnToggleAdvancedConfigEl = document.getElementById('btn-toggle-advanced-config')!;
    this.btnCloseAdvancedConfigEl = document.getElementById('btn-close-advanced-config')!;
    this.btnToggleAdvancedEl = document.getElementById('btn-toggle-advanced')!;
    this.btnToggleDeadmanEl = document.getElementById('btn-toggle-deadman')!;

    this.syncAdvancedConfigUI();
  }

  private setupEventListeners(): void {
    document.getElementById('btn-top-center')?.addEventListener('click', () => {
      const pt = this.train.getVehiclePosition(0, this.trackNet);
      this.camera.resetToTrain(pt.x, pt.y);
    });

    document.getElementById('btn-top-controls')?.addEventListener('click', () => {
      this.openControlsModal();
    });

    document.getElementById('btn-respawn-train')?.addEventListener('click', () => {
      this.respawnTrain();
    });

    this.btnToggleTrainConfigEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.worldConfigCardEl.classList.add('hidden');
      this.advancedConfigCardEl.classList.add('hidden');
      this.trainConfigCardEl.classList.toggle('hidden');
    });

    this.btnCloseTrainConfigEl?.addEventListener('click', () => {
      this.trainConfigCardEl.classList.add('hidden');
    });

    this.btnToggleWorldConfigEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.trainConfigCardEl.classList.add('hidden');
      this.advancedConfigCardEl.classList.add('hidden');
      this.syncWorldConfigUI();
      this.worldConfigCardEl.classList.toggle('hidden');
    });

    this.btnCloseWorldConfigEl?.addEventListener('click', () => {
      this.worldConfigCardEl.classList.add('hidden');
    });

    this.btnToggleAdvancedConfigEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.trainConfigCardEl.classList.add('hidden');
      this.worldConfigCardEl.classList.add('hidden');
      this.advancedConfigCardEl.classList.toggle('hidden');
    });

    this.btnCloseAdvancedConfigEl?.addEventListener('click', () => {
      this.advancedConfigCardEl.classList.add('hidden');
    });

    this.btnToggleAdvancedEl?.addEventListener('click', () => {
      const next = !this.advancedSystemsMgr.config.advancedControls;
      this.advancedSystemsMgr.setAdvancedControls(next);
      this.syncAdvancedConfigUI();

      if (next) {
        this.triggerAlert({
          type: 'info',
          title: 'Advanced systems active',
          message: 'Deadman control system enabled. Acknowledge with Q or cab pedal.',
          canReset: true
        });

        setTimeout(() => {
          if (this.activeAlert?.title === 'Advanced systems active') {
            this.clearAlert();
          }
        }, 3500);
      } else {
        this.triggerAlert({
          type: 'info',
          title: 'Advanced systems disabled',
          message: 'Standard driving controls active.',
          canReset: true
        });

        setTimeout(() => {
          if (this.activeAlert?.title === 'Advanced systems disabled') {
            this.clearAlert();
          }
        }, 2500);
      }
    });

    this.btnToggleDeadmanEl?.addEventListener('click', () => {
      const next = !this.advancedSystemsMgr.config.deadman;
      this.advancedSystemsMgr.setDeadman(next);
      this.syncAdvancedConfigUI();
    });

    this.btnDeadmanEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.acknowledgeDeadman();
    });

    const setShape = (shape: WorldShape) => {
      this.selectedShape = shape;
      document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));

      if (shape === 'I') document.getElementById('btn-shape-i')?.classList.add('active');
      if (shape === 'S') document.getElementById('btn-shape-s')?.classList.add('active');
      if (shape === 'O') document.getElementById('btn-shape-o')?.classList.add('active');
    };

    document.getElementById('btn-shape-i')?.addEventListener('click', () => setShape('I'));
    document.getElementById('btn-shape-s')?.addEventListener('click', () => setShape('S'));
    document.getElementById('btn-shape-o')?.addEventListener('click', () => setShape('O'));

    const setSize = (size: WorldSize) => {
      this.selectedSize = size;
      document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));

      if (size === 'S') document.getElementById('btn-size-s')?.classList.add('active');
      if (size === 'M') document.getElementById('btn-size-m')?.classList.add('active');
      if (size === 'L') document.getElementById('btn-size-l')?.classList.add('active');
      if (size === 'XL') document.getElementById('btn-size-xl')?.classList.add('active');
    };

    document.getElementById('btn-size-s')?.addEventListener('click', () => setSize('S'));
    document.getElementById('btn-size-m')?.addEventListener('click', () => setSize('M'));
    document.getElementById('btn-size-l')?.addEventListener('click', () => setSize('L'));
    document.getElementById('btn-size-xl')?.addEventListener('click', () => setSize('XL'));

    this.btnWorldRegenerateEl?.addEventListener('click', () => {
      this.worldConfigCardEl.classList.add('hidden');
      this.onRegenerateShape?.(this.selectedShape, this.selectedSize);
    });

    const setType = (type: TrainType) => {
      this.train.setTrainType(type);
      document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));

      if (type === 'regional') document.getElementById('btn-type-regional')?.classList.add('active');
      if (type === 'cargo') document.getElementById('btn-type-cargo')?.classList.add('active');
      if (type === 'high_speed') document.getElementById('btn-type-highspeed')?.classList.add('active');

      this.updateConsistDisplay();
    };

    document.getElementById('btn-type-regional')?.addEventListener('click', () => setType('regional'));
    document.getElementById('btn-type-cargo')?.addEventListener('click', () => setType('cargo'));
    document.getElementById('btn-type-highspeed')?.addEventListener('click', () => setType('high_speed'));

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

    document.getElementById('btn-invert-train')?.addEventListener('click', () => {
      this.train.invert(this.trackNet);
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

    document.getElementById('btn-fwd')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setReverser(1);
    });
    document.getElementById('btn-neu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setReverser(0);
    });
    document.getElementById('btn-rev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setReverser(-1);
    });

    const throttleTrack = document.getElementById('throttle-track')!;
    const brakeTrack = document.getElementById('brake-track')!;

    const onLeverMove = (trackEl: HTMLElement, clientY: number, setter: (val: number) => void) => {
      if (this.train.isEmergencyBrakeLocked) return;

      const rect = trackEl.getBoundingClientRect();
      const clampedY = clamp(clientY, rect.top, rect.bottom);
      const fraction = 1 - (clampedY - rect.top) / rect.height;

      setter(Math.round(fraction * 100) / 100);
      this.updateLeverHandles();
    };

    const onReverserMove = (trackEl: HTMLElement, clientY: number) => {
      if (this.train.isEmergencyBrakeLocked) return;

      const rect = trackEl.getBoundingClientRect();
      const clampedY = clamp(clientY, rect.top, rect.bottom);
      const fraction = 1 - (clampedY - rect.top) / rect.height;

      let targetPos: 1 | 0 | -1 = 0;
      if (fraction >= 0.66) targetPos = 1;
      else if (fraction <= 0.33) targetPos = -1;
      else targetPos = 0;

      this.setReverser(targetPos);
    };

    this.reverserTrackEl?.addEventListener('pointerdown', (e) => {
      if (this.train.isEmergencyBrakeLocked) return;

      this.draggingReverser = true;

      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {}

      onReverserMove(this.reverserTrackEl, e.clientY);
    });

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
      } else if (this.draggingReverser) {
        onReverserMove(this.reverserTrackEl, e.clientY);
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

      if (this.draggingReverser) {
        this.draggingReverser = false;
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

      if (e.code === 'KeyT') {
        this.worldConfigCardEl.classList.add('hidden');
        this.advancedConfigCardEl.classList.add('hidden');
        this.trainConfigCardEl.classList.toggle('hidden');
        return;
      }

      if (e.code === 'KeyU') {
        this.trainConfigCardEl.classList.add('hidden');
        this.worldConfigCardEl.classList.add('hidden');
        this.advancedConfigCardEl.classList.toggle('hidden');
        return;
      }

      if (e.code === 'KeyQ') {
        this.acknowledgeDeadman();
        return;
      }

      if (e.code === 'Escape') {
        this.closeControlsModal();
        this.trainConfigCardEl.classList.add('hidden');
        this.worldConfigCardEl.classList.add('hidden');
        this.advancedConfigCardEl.classList.add('hidden');
        return;
      }

      if (!this.train.isEmergencyBrakeLocked) {
        if (e.code === 'KeyF') this.setReverser(1);
        if (e.code === 'KeyN') this.setReverser(0);
        if (e.code === 'KeyR') this.setReverser(-1);
      }

      if (e.code === 'KeyC') {
        const pt = this.train.getVehiclePosition(0, this.trackNet);
        this.camera.resetToTrain(pt.x, pt.y);
      }

      if (e.code === 'KeyG') {
        this.worldConfigCardEl.classList.add('hidden');
        this.onRegenerateShape?.(this.selectedShape, this.selectedSize);
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
          this.train.targetThrottle = clamp(+(this.train.targetThrottle + 0.01).toFixed(2), 0, 1);
        } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.train.targetThrottle = clamp(+(this.train.targetThrottle - 0.01).toFixed(2), 0, 1);
        } else if (e.code === 'Space' || e.code === 'KeyB') {
          this.train.targetBrake = clamp(+(this.train.targetBrake + 0.01).toFixed(2), 0, 1);
        } else if (e.code === 'KeyV') {
          this.train.targetBrake = clamp(+(this.train.targetBrake - 0.01).toFixed(2), 0, 1);
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
        this.train.targetThrottle = clamp(+(this.train.targetThrottle + fineStep).toFixed(2), 0, 1);
      }

      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
        this.train.targetThrottle = clamp(+(this.train.targetThrottle - fineStep).toFixed(2), 0, 1);
      }

      if (keysPressed['Space'] || keysPressed['KeyB']) {
        this.train.targetBrake = clamp(+(this.train.targetBrake + fineStep).toFixed(2), 0, 1);
      }

      if (keysPressed['KeyV']) {
        this.train.targetBrake = clamp(+(this.train.targetBrake - fineStep).toFixed(2), 0, 1);
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
      title: 'Emergency brake enforcement active',
      message: `${reason}. Train must come to a complete standstill to reset.`,
      canReset: false
    });
  }

  public triggerAlert(alert: WarningAlert): void {
    this.activeAlert = alert;
    this.warningBannerEl.classList.remove('hidden');

    const infoIconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    const warnIconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

    if (alert.type === 'info') {
      this.warningBannerEl.classList.add('info-alert');
      this.warningBadgeEl.innerHTML = infoIconSvg;
    } else {
      this.warningBannerEl.classList.remove('info-alert');
      this.warningBadgeEl.innerHTML = warnIconSvg;
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

    const pt = this.train.getVehiclePosition(0, this.trackNet);
    this.camera.resetToTrain(pt.x, pt.y);

    this.clearAlert();
    this.updateLeverHandles();
    this.updateConsistDisplay();
    this.setReverser(1);
  }

  public resetForWorld(
    train: Train,
    stationMgr: StationManager,
    signalMgr: SignalManager,
    trackNet: TrackNetwork,
    advancedSystemsMgr?: AdvancedSystemsManager
  ): void {
    this.train = train;
    this.stationMgr = stationMgr;
    this.signalMgr = signalMgr;
    this.trackNet = trackNet;

    if (advancedSystemsMgr) {
      this.advancedSystemsMgr = advancedSystemsMgr;
    }

    this.syncWorldConfigUI();

    const pt = this.train.getVehiclePosition(0, this.trackNet);
    this.camera.resetToTrain(pt.x, pt.y);

    this.clearAlert();
    this.updateLeverHandles();
    this.updateConsistDisplay();
    this.setReverser(1);
    this.advancedSystemsMgr.reset();
    this.syncAdvancedConfigUI();
    this.worldConfigCardEl?.classList.add('hidden');
    this.advancedConfigCardEl?.classList.add('hidden');
    this.trainConfigCardEl?.classList.add('hidden');
  }

  public acknowledgeDeadman(): void {
    const acked = this.advancedSystemsMgr.acknowledgeDeadman();

    if (acked) {
      if (this.activeAlert && (this.activeAlert.title.toLowerCase().includes('deadman') || this.activeAlert.message.toLowerCase().includes('deadman'))) {
        if (!this.train.isEmergencyBrakeLocked) {
          this.clearAlert();
        }
      }
    }
  }

  public syncAdvancedConfigUI(): void {
    const cfg = this.advancedSystemsMgr.config;

    if (this.btnToggleAdvancedEl) {
      this.btnToggleAdvancedEl.textContent = cfg.advancedControls ? 'ON' : 'OFF';
      this.btnToggleAdvancedEl.classList.toggle('active', cfg.advancedControls);
    }

    if (this.btnToggleDeadmanEl) {
      this.btnToggleDeadmanEl.textContent = cfg.deadman ? 'ON' : 'OFF';
      this.btnToggleDeadmanEl.classList.toggle('active', cfg.deadman);
      (this.btnToggleDeadmanEl as HTMLButtonElement).disabled = !cfg.advancedControls;
    }

    if (this.btnDeadmanEl) {
      if (cfg.advancedControls && cfg.deadman) {
        this.btnDeadmanEl.classList.remove('hidden');
      } else {
        this.btnDeadmanEl.classList.add('hidden');
      }
    }
  }

  public syncWorldConfigUI(): void {
    this.selectedShape = this.trackNet.shape;
    this.selectedSize = this.trackNet.size;

    document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
    if (this.selectedShape === 'I') document.getElementById('btn-shape-i')?.classList.add('active');
    if (this.selectedShape === 'S') document.getElementById('btn-shape-s')?.classList.add('active');
    if (this.selectedShape === 'O') document.getElementById('btn-shape-o')?.classList.add('active');

    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    if (this.selectedSize === 'S') document.getElementById('btn-size-s')?.classList.add('active');
    if (this.selectedSize === 'M') document.getElementById('btn-size-m')?.classList.add('active');
    if (this.selectedSize === 'L') document.getElementById('btn-size-l')?.classList.add('active');
    if (this.selectedSize === 'XL') document.getElementById('btn-size-xl')?.classList.add('active');
  }

  private attemptResetAlert(): void {
    if (this.train.isCrashed) {
      this.respawnTrain();
      return;
    }

    if (this.train.resetEmergencyBrake()) {
      this.advancedSystemsMgr.acknowledgeDeadman();
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

    if (this.train.reverser !== pos && (this.train.speedKmH !== 0 || Math.abs(this.train.speed) > 0.05)) {
      this.triggerAlert({
        type: 'info',
        title: 'Reverser interlock active',
        message: `Cannot change direction while in motion (${this.train.speedKmH} km/h). Train must be at a complete standstill.`,
        canReset: true
      });

      setTimeout(() => this.clearAlert(), 3000);
      return;
    }

    this.train.reverser = pos;
    this.updateLeverHandles();
  }

  public updateLeverHandles(): void {
    const targetThrottlePct = Math.round(this.train.targetThrottle * 100);
    this.throttleHandleEl.style.bottom = `${targetThrottlePct}%`;
    if (this.throttleValEl) this.throttleValEl.textContent = `${targetThrottlePct}%`;

    const targetBrakePct = Math.round(this.train.targetBrake * 100);
    this.brakeHandleEl.style.bottom = `${targetBrakePct}%`;
    if (this.brakeValEl) this.brakeValEl.textContent = `${targetBrakePct}%`;

    const rev = this.train.reverser;
    const revBottom = rev === 1 ? '100%' : rev === -1 ? '0%' : '50%';
    this.reverserHandleEl.style.bottom = revBottom;
    if (this.reverserValEl) this.reverserValEl.textContent = rev === 1 ? 'FWD' : rev === -1 ? 'REV' : 'NEU';

    if (this.reverserFillEl) {
      if (rev === 1) {
        this.reverserFillEl.style.bottom = '50%';
        this.reverserFillEl.style.height = '50%';
        this.reverserFillEl.style.borderRadius = '7px 7px 0 0';
      } else if (rev === -1) {
        this.reverserFillEl.style.bottom = '0%';
        this.reverserFillEl.style.height = '50%';
        this.reverserFillEl.style.borderRadius = '0 0 7px 7px';
      } else {
        this.reverserFillEl.style.bottom = '50%';
        this.reverserFillEl.style.height = '0%';
        this.reverserFillEl.style.borderRadius = '0';
      }
    }

    document.querySelectorAll('.rev-notch').forEach(btn => btn.classList.remove('active'));
    if (rev === 1) document.getElementById('btn-fwd')?.classList.add('active');
    else if (rev === 0) document.getElementById('btn-neu')?.classList.add('active');
    else if (rev === -1) document.getElementById('btn-rev')?.classList.add('active');
  }

  public update(stationStatus: StationStatus): void {
    const speed = this.train.speedKmH;
    this.speedEl.textContent = `${speed}`;

    const speedLimit = this.trackNet.getSpeedLimitAt(
      this.train.trackId,
      this.train.distance,
      this.train.activeCrossovers.length > 0
    );

    const activeSign = this.trackNet.getActiveSpeedSign(
      this.train.trackId,
      this.train.distance,
      this.train.facing,
      this.train.activeCrossovers.length > 0
    );

    const nextSpeedSign = this.trackNet.getNextSpeedSignAhead(
      this.train.trackId,
      this.train.distance,
      this.train.facing
    );

    const isOverspeed = speed > speedLimit;
    this.speedEl.classList.toggle('overspeed', isOverspeed);
    this.updateActiveSign(activeSign, isOverspeed);
    this.updateUpcomingSpeedSign(nextSpeedSign, speedLimit);

    this.updateConsistDisplay();

    if (this.activeAlert) {
      if (this.train.isCrashed) {
        this.warningBannerEl.classList.remove('info-alert');
        this.warningBadgeEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        if (this.train.isDerailed) {
          this.warningTitleEl.textContent = 'Train derailed';
          this.warningDescEl.textContent = this.train.crashReason || 'Excessive lateral speed through curve. Respawn required.';
        } else {
          this.warningTitleEl.textContent = 'Train crashed';
          this.warningDescEl.textContent = this.train.crashReason || 'Collision with buffer stop at terminal dead track. Respawn required.';
        }

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

    const nextSig = this.signalMgr.getNextSignalAhead(
      this.train.trackId,
      this.train.distance,
      currentTrackLen,
      this.train.facing
    );

    if (nextSig) {
      const distM = Math.round(nextSig.distanceAhead);
      let aspectLabel = 'Clear';

      if (nextSig.signal.type === 'primary') {
        if (nextSig.signal.aspect === 'red') {
          aspectLabel = 'Stop';
        } else if (nextSig.signal.aspect === 'slow') {
          aspectLabel = 'Diverging (40 km/h)';
        } else {
          aspectLabel = 'Clear';
        }
      } else {
        if (nextSig.signal.aspect === 'yellow') {
          aspectLabel = 'Expect Stop';
        } else if (nextSig.signal.aspect === 'slow') {
          aspectLabel = 'Expect Diverging (40 km/h)';
        } else if (nextSig.signal.aspect === 'dark') {
          aspectLabel = 'Inactive';
        } else {
          aspectLabel = 'Expect Clear';
        }
      }

      const typeTag = nextSig.signal.type === 'primary' ? 'P' : 'D';

      this.signalInfoEl.textContent = `[${typeTag}] ${nextSig.signal.name} (${distM} m) - ${aspectLabel}`;

      if (nextSig.signal.aspect === 'slow') {
        this.signalDotEl.style.background = 'linear-gradient(180deg, #10b981 50%, #f59e0b 50%)';
      } else if (nextSig.signal.aspect === 'yellow') {
        this.signalDotEl.style.background = '#f59e0b';
      } else if (nextSig.signal.aspect === 'red') {
        this.signalDotEl.style.background = '#ef4444';
      } else if (nextSig.signal.aspect === 'dark') {
        this.signalDotEl.style.background = '#71717a';
      } else {
        this.signalDotEl.style.background = '#10b981';
      }
    }

    const targetThrottlePct = Math.round(this.train.targetThrottle * 100);
    this.throttleHandleEl.style.bottom = `${targetThrottlePct}%`;
    if (this.throttleValEl) this.throttleValEl.textContent = `${targetThrottlePct}%`;

    const actualThrottlePct = Math.round(this.train.throttle * 100);
    this.throttleFillEl.style.height = `${actualThrottlePct}%`;

    const targetBrakePct = Math.round(this.train.targetBrake * 100);
    this.brakeHandleEl.style.bottom = `${targetBrakePct}%`;
    if (this.brakeValEl) this.brakeValEl.textContent = `${targetBrakePct}%`;

    const actualBrakePct = Math.round(this.train.brake * 100);
    this.brakeFillEl.style.height = `${actualBrakePct}%`;

    const deadmanStatus = this.advancedSystemsMgr.getDeadmanStatus(this.train.speedKmH);

    if (deadmanStatus.enabled) {
      this.btnDeadmanEl.classList.remove('hidden');
      this.btnDeadmanEl.classList.toggle('warning-visual', deadmanStatus.stage === 'visual');
      this.btnDeadmanEl.classList.toggle('warning-urgent', deadmanStatus.stage === 'urgent');
      this.btnDeadmanEl.classList.toggle('enforced', deadmanStatus.stage === 'enforced');

      if (deadmanStatus.stage === 'enforced') {
        this.deadmanLampTextEl.textContent = 'BRAKE';
      } else if (deadmanStatus.stage === 'urgent') {
        this.deadmanLampTextEl.textContent = 'ALARM!';
      } else if (deadmanStatus.stage === 'visual') {
        this.deadmanLampTextEl.textContent = 'ALERT';
      } else {
        this.deadmanLampTextEl.textContent = 'DEADMAN';
      }
    } else {
      this.btnDeadmanEl.classList.add('hidden');
    }
  }

  private updateActiveSign(sign: ActiveSpeedSign, isOverspeed: boolean): void {
    if (!this.activeSignEl) return;

    this.activeSignEl.classList.toggle('overspeed', isOverspeed);

    const key = `${sign.isAdvanceWarning ? 'adv' : 'reg'}-${sign.displayVal}`;

    if (key === this.lastActiveSignKey) return;

    this.lastActiveSignKey = key;

    if (sign.isAdvanceWarning) {
      this.activeSignEl.innerHTML = `
        <svg class="hud-sign-svg" width="38" height="34" viewBox="0 0 38 34">
          <polygon points="1.5,1.5 36.5,1.5 19,32.5" fill="#18181b" />
          <polygon points="3.5,3.5 34.5,3.5 19,30" fill="#ffffff" />
          <polygon points="6,5.5 32,5.5 19,27" fill="#f59e0b" />
          <text x="19" y="15" font-family="'Geist Mono', monospace" font-size="14.5" font-weight="900" fill="#18181b" text-anchor="middle">${sign.displayVal}</text>
        </svg>
      `;
    } else {
      this.activeSignEl.innerHTML = `
        <svg class="hud-sign-svg" width="38" height="34" viewBox="0 0 38 34">
          <rect x="2" y="2" width="34" height="30" rx="4" fill="#ffffff" stroke="#18181b" stroke-width="2" />
          <text x="19" y="23" font-family="'Geist Mono', monospace" font-size="18" font-weight="900" fill="#18181b" text-anchor="middle">${sign.displayVal}</text>
        </svg>
      `;
    }
  }

  private updateUpcomingSpeedSign(
    nextSign: { sign: SpeedSign; distanceAhead: number } | null,
    currentSpeedLimit: number
  ): void {
    if (!this.speedInfoTextEl || !this.speedMiniSignEl) return;

    if (nextSign) {
      const distM = Math.round(nextSign.distanceAhead);
      const val = Math.round(nextSign.sign.speedKmH / 10);
      const isAdv = !!nextSign.sign.isAdvanceWarning;

      const key = `${isAdv ? 'adv' : 'reg'}-${val}-${distM}`;

      if (key !== this.lastUpcomingSignKey) {
        this.lastUpcomingSignKey = key;

        if (isAdv) {
          this.speedMiniSignEl.innerHTML = `
            <svg width="20" height="17" viewBox="0 0 20 17">
              <polygon points="1,1 19,1 10,16" fill="#18181b" />
              <polygon points="2,2 18,2 10,14.5" fill="#ffffff" />
              <polygon points="3.5,3.2 16.5,3.2 10,13" fill="#f59e0b" />
              <text x="10" y="8" font-family="'Geist Mono', monospace" font-size="8" font-weight="900" fill="#18181b" text-anchor="middle">${val}</text>
            </svg>
          `;
          this.speedInfoTextEl.innerHTML = `<span>Expect ${nextSign.sign.speedKmH} km/h</span><span class="sub">in ${distM} m</span>`;
        } else {
          this.speedMiniSignEl.innerHTML = `
            <svg width="20" height="17" viewBox="0 0 20 17">
              <rect x="1.5" y="1.5" width="17" height="14" rx="2.5" fill="#ffffff" stroke="#18181b" stroke-width="1.5" />
              <text x="10" y="12" font-family="'Geist Mono', monospace" font-size="9.5" font-weight="900" fill="#18181b" text-anchor="middle">${val}</text>
            </svg>
          `;
          this.speedInfoTextEl.innerHTML = `<span>Limit ${nextSign.sign.speedKmH} km/h</span><span class="sub">in ${distM} m</span>`;
        }
      }
    } else {
      const val = Math.round(currentSpeedLimit / 10);
      const key = `none-${val}`;

      if (key !== this.lastUpcomingSignKey) {
        this.lastUpcomingSignKey = key;

        this.speedMiniSignEl.innerHTML = `
          <svg width="20" height="17" viewBox="0 0 20 17">
            <rect x="1.5" y="1.5" width="17" height="14" rx="2.5" fill="#ffffff" stroke="#18181b" stroke-width="1.5" />
            <text x="10" y="12" font-family="'Geist Mono', monospace" font-size="9.5" font-weight="900" fill="#18181b" text-anchor="middle">${val}</text>
          </svg>
        `;
        this.speedInfoTextEl.innerHTML = `<span>Limit ${currentSpeedLimit} km/h</span><span class="sub">Cruising</span>`;
      }
    }
  }
}
