export interface Point2D {
  x: number;
  y: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  angle: number;
  distance: number;
  normalX: number;
  normalY: number;
}

export interface TrackData {
  points: TrackPoint[];
  totalLength: number;
  isClosed: boolean;
}

export type WorldShape = 'I' | 'S' | 'O';

export type WorldSize = 'S' | 'M' | 'L';

export type SignalType = 'primary' | 'secondary';

export type SignalAspect = 'red' | 'yellow' | 'green' | 'dark';

export interface Signal {
  id: string;
  name: string;
  trackId: number;
  type: SignalType;
  distance: number;
  aspect: SignalAspect;
  side: 1 | -1;
  direction: 1 | -1;
  manualOverride: boolean;
  manualAspect?: SignalAspect | null;
  blockId: number;
  linkedPrimaryId?: string;
  worldX?: number;
  worldY?: number;
}

export interface Block {
  id: number;
  trackId: number;
  direction: 1 | -1;
  startDistance: number;
  endDistance: number;
  isOccupied: boolean;
  primarySignalId: string;
  secondarySignalId: string;
}

export type SwitchState = 'straight' | 'diverging';

export interface JunctionSwitch {
  id: string;
  name: string;
  fromTrackId: number;
  toTrackId: number;
  fromDistance: number;
  toDistance: number;
  state: SwitchState;
  length: number;
  path: Point2D[];
  worldX: number;
  worldY: number;
}

export interface Station {
  id: string;
  name: string;
  code: string;
  trackId: number;
  distance: number;
  platformLength: number;
  isTerminal?: boolean;
}

export type ReverserPosition = 1 | 0 | -1;

export type TrainType = 'regional' | 'cargo' | 'high_speed';

export interface WarningAlert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  canReset: boolean;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type DeadmanWarningStage = 'none' | 'visual' | 'urgent' | 'enforced';

export interface DeadmanStatus {
  enabled: boolean;
  active: boolean;
  stage: DeadmanWarningStage;
  timer: number;
  maxTimer: number;
  countdown: number;
  warningVisual: boolean;
  warningUrgent: boolean;
  enforced: boolean;
}

export interface AdvancedSystemsConfig {
  advancedControls: boolean;
  deadman: boolean;
}
