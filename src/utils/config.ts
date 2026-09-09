import type { WorldShape, WorldSize, AdvancedSystemsConfig } from '../types.ts';

export interface WorldConfig {
  seed: number | string;
  shape: WorldShape;
  size: WorldSize;
}

export function loadWorldConfig(): WorldConfig {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSeed = urlParams.get('seed');
  const urlShape = urlParams.get('shape') as WorldShape | null;
  const urlSize = urlParams.get('size') as WorldSize | null;
  const storedSeed = localStorage.getItem('rails_seed');
  const storedShape = localStorage.getItem('rails_shape') as WorldShape | null;
  const storedSize = localStorage.getItem('rails_size') as WorldSize | null;

  let seed: number | string;

  if (urlSeed && urlSeed.trim().length > 0) {
    seed = isNaN(Number(urlSeed)) ? urlSeed.trim() : Number(urlSeed);
  } else if (storedSeed && storedSeed.trim().length > 0) {
    seed = isNaN(Number(storedSeed)) ? storedSeed.trim() : Number(storedSeed);
  } else {
    seed = Math.floor(Math.random() * 900000) + 100000;
  }

  let shape: WorldShape = 'O';

  if (urlShape && ['I', 'S', 'O'].includes(urlShape)) {
    shape = urlShape;
  } else if (storedShape && ['I', 'S', 'O'].includes(storedShape)) {
    shape = storedShape;
  }

  let size: WorldSize = 'M';

  if (urlSize && ['S', 'M', 'L', 'XL'].includes(urlSize)) {
    size = urlSize;
  } else if (storedSize && ['S', 'M', 'L', 'XL'].includes(storedSize)) {
    size = storedSize;
  }

  return { seed, shape, size };
}

export function saveWorldConfig(config: WorldConfig): void {
  localStorage.setItem('rails_seed', String(config.seed));
  localStorage.setItem('rails_shape', config.shape);
  localStorage.setItem('rails_size', config.size);

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('seed', String(config.seed));
  currentUrl.searchParams.set('shape', config.shape);
  currentUrl.searchParams.set('size', config.size);
  window.history.replaceState({}, '', currentUrl.toString());
}

export function loadAdvancedConfig(): AdvancedSystemsConfig {
  const urlParams = new URLSearchParams(window.location.search);
  const urlAdv = urlParams.get('advanced');
  const urlDeadman = urlParams.get('deadman');

  let advancedControls = false;

  if (urlAdv !== null) {
    advancedControls = urlAdv === '1' || urlAdv.toLowerCase() === 'true';
  }

  let deadman = true;

  if (urlDeadman !== null) {
    deadman = urlDeadman === '1' || urlDeadman.toLowerCase() === 'true';
  }

  return { advancedControls, deadman };
}

export function saveAdvancedConfig(config: AdvancedSystemsConfig): void {
  localStorage.setItem('rails_advanced_controls', String(config.advancedControls));
  localStorage.setItem('rails_deadman', String(config.deadman));

  const currentUrl = new URL(window.location.href);

  if (config.advancedControls) {
    currentUrl.searchParams.set('advanced', '1');
  } else {
    currentUrl.searchParams.delete('advanced');
  }

  if (!config.deadman) {
    currentUrl.searchParams.set('deadman', '0');
  } else {
    currentUrl.searchParams.delete('deadman');
  }

  window.history.replaceState({}, '', currentUrl.toString());
}
