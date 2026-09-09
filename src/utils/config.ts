import type { WorldShape, WorldSize } from '../types.ts';

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

  if (urlSize && ['S', 'M', 'L'].includes(urlSize)) {
    size = urlSize;
  } else if (storedSize && ['S', 'M', 'L'].includes(storedSize)) {
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
