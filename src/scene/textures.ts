import * as THREE from 'three';

export interface MaterialTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

const textureCache = new Map<string, MaterialTextureSet>();

function createCanvasPair(size = 256): {
  diffCanvas: HTMLCanvasElement;
  diffCtx: CanvasRenderingContext2D;
  bumpCanvas: HTMLCanvasElement;
  bumpCtx: CanvasRenderingContext2D;
} | null {
  if (typeof document === 'undefined') return null;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = size;
  diffCanvas.height = size;
  const diffCtx = diffCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');

  if (!diffCtx || !bumpCtx) return null;
  return { diffCanvas, diffCtx, bumpCanvas, bumpCtx };
}

function finalizeTextureSet(
  diffCanvas: HTMLCanvasElement,
  bumpCanvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
): MaterialTextureSet {
  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = 4;

  return { map, bumpMap };
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeWoodTexture(
  key: string,
  baseHex: string,
  grainHex: string,
  seamHex: string,
  repeatX: number,
  repeatY: number,
  seed: number,
): MaterialTextureSet | null {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const pair = createCanvasPair(256);
  if (!pair) return null;
  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = seededRand(seed);

  diffCtx.fillStyle = baseHex;
  diffCtx.fillRect(0, 0, 256, 256);
  bumpCtx.fillStyle = '#c8c8c8';
  bumpCtx.fillRect(0, 0, 256, 256);

  const plankRows = 8;
  const rowH = 256 / plankRows;

  for (let row = 0; row < plankRows; row++) {
    const y = row * rowH;
    const offset = (row % 2) * 84 + Math.floor(rand() * 24);
    const toneShift = (rand() - 0.5) * 14;

    // Subtle plank shade variation
    diffCtx.fillStyle =
      toneShift > 0
        ? `rgba(255, 245, 230, ${Math.abs(toneShift) / 90})`
        : `rgba(70, 42, 18, ${Math.abs(toneShift) / 110})`;
    diffCtx.fillRect(0, y, 256, rowH);

    // Organic wood grain lines
    diffCtx.strokeStyle = grainHex;
    diffCtx.globalAlpha = 0.24;
    bumpCtx.strokeStyle = '#a8a8a8';
    bumpCtx.globalAlpha = 0.25;
    for (let g = 0; g < 6; g++) {
      const gy = y + 3 + rand() * (rowH - 6);
      diffCtx.lineWidth = 1 + rand() * 1.4;
      diffCtx.beginPath();
      diffCtx.moveTo(0, gy);
      diffCtx.bezierCurveTo(85, gy + (rand() - 0.5) * 3, 170, gy + (rand() - 0.5) * 3, 256, gy);
      diffCtx.stroke();

      bumpCtx.lineWidth = 1;
      bumpCtx.beginPath();
      bumpCtx.moveTo(0, gy);
      bumpCtx.lineTo(256, gy);
      bumpCtx.stroke();
    }
    diffCtx.globalAlpha = 1;
    bumpCtx.globalAlpha = 1;

    // Horizontal plank bevel seam
    diffCtx.fillStyle = seamHex;
    diffCtx.fillRect(0, y, 256, 1.5);
    bumpCtx.fillStyle = '#555555';
    bumpCtx.fillRect(0, y, 256, 2);

    // Vertical staggered joint
    const jointX = offset % 256;
    diffCtx.fillRect(jointX, y, 1.5, rowH);
    bumpCtx.fillRect(jointX, y, 2, rowH);
  }

  const set = finalizeTextureSet(diffCanvas, bumpCanvas, repeatX, repeatY);
  textureCache.set(key, set);
  return set;
}

function makeTileTexture(
  key: string,
  colorA: string,
  colorB: string,
  groutHex: string,
  cells: number,
  repeatX: number,
  repeatY: number,
): MaterialTextureSet | null {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const pair = createCanvasPair(256);
  if (!pair) return null;
  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const cellSize = 256 / cells;

  diffCtx.fillStyle = groutHex;
  diffCtx.fillRect(0, 0, 256, 256);
  bumpCtx.fillStyle = '#4a4a4a';
  bumpCtx.fillRect(0, 0, 256, 256);

  const gap = 3;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const x = c * cellSize + gap;
      const y = r * cellSize + gap;
      const s = cellSize - gap * 2;
      const fill = (r + c) % 2 === 0 ? colorA : colorB;

      diffCtx.fillStyle = fill;
      diffCtx.fillRect(x, y, s, s);

      // Subtle glossy top-left bevel highlight
      diffCtx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      diffCtx.fillRect(x, y, s, 2);
      diffCtx.fillRect(x, y, 2, s);

      bumpCtx.fillStyle = '#dcdcdc';
      bumpCtx.fillRect(x, y, s, s);
    }
  }

  const set = finalizeTextureSet(diffCanvas, bumpCanvas, repeatX, repeatY);
  textureCache.set(key, set);
  return set;
}

function makeStonePatioTexture(key: string, repeatX: number, repeatY: number): MaterialTextureSet | null {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const pair = createCanvasPair(256);
  if (!pair) return null;
  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = seededRand(404);

  diffCtx.fillStyle = '#9e9a8f';
  diffCtx.fillRect(0, 0, 256, 256);
  bumpCtx.fillStyle = '#404040';
  bumpCtx.fillRect(0, 0, 256, 256);

  const tones = ['#d2cdc1', '#c9c4b8', '#dcd7cb', '#c4bfb2'];
  const rows = 4;
  const rowH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const cols = r % 2 === 0 ? 3 : 4;
    const colW = 256 / cols;
    for (let c = 0; c < cols; c++) {
      const x = c * colW;
      diffCtx.fillStyle = tones[Math.floor(rand() * tones.length)];
      diffCtx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
      bumpCtx.fillStyle = '#d4d4d4';
      bumpCtx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
    }
  }

  // Soft mineral speckle
  for (let i = 0; i < 650; i++) {
    diffCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(60,55,48,0.12)';
    diffCtx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }

  const set = finalizeTextureSet(diffCanvas, bumpCanvas, repeatX, repeatY);
  textureCache.set(key, set);
  return set;
}

function makeGrassTexture(key: string, repeatX: number, repeatY: number): MaterialTextureSet | null {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const pair = createCanvasPair(256);
  if (!pair) return null;
  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = seededRand(909);

  diffCtx.fillStyle = '#85be6f';
  diffCtx.fillRect(0, 0, 256, 256);
  bumpCtx.fillStyle = '#909090';
  bumpCtx.fillRect(0, 0, 256, 256);

  // Soft sunlit meadow patches
  for (let p = 0; p < 28; p++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const rad = 18 + rand() * 34;
    const grad = diffCtx.createRadialGradient(px, py, 2, px, py, rad);
    grad.addColorStop(0, rand() > 0.45 ? 'rgba(164, 214, 118, 0.35)' : 'rgba(90, 148, 72, 0.25)');
    grad.addColorStop(1, 'rgba(133, 190, 111, 0)');
    diffCtx.fillStyle = grad;
    diffCtx.fillRect(0, 0, 256, 256);
  }

  // Fine blades
  for (let b = 0; b < 1400; b++) {
    const bx = rand() * 256;
    const by = rand() * 256;
    const len = 3 + rand() * 5;
    diffCtx.strokeStyle = rand() > 0.5 ? 'rgba(182, 224, 134, 0.42)' : 'rgba(78, 136, 65, 0.38)';
    diffCtx.lineWidth = 1;
    diffCtx.beginPath();
    diffCtx.moveTo(bx, by);
    diffCtx.lineTo(bx + (rand() - 0.5) * 3, by - len);
    diffCtx.stroke();

    bumpCtx.fillStyle = rand() > 0.5 ? '#c6c6c6' : '#707070';
    bumpCtx.fillRect(bx, by, 1.5, 2.5);
  }

  const set = finalizeTextureSet(diffCanvas, bumpCanvas, repeatX, repeatY);
  textureCache.set(key, set);
  return set;
}

function makeWallTexture(key: string, isExterior: boolean): MaterialTextureSet | null {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const pair = createCanvasPair(256);
  if (!pair) return null;
  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = seededRand(isExterior ? 512 : 612);

  diffCtx.fillStyle = isExterior ? '#f3ede2' : '#f7f2e9';
  diffCtx.fillRect(0, 0, 256, 256);
  bumpCtx.fillStyle = '#c0c0c0';
  bumpCtx.fillRect(0, 0, 256, 256);

  if (isExterior) {
    // Coastal horizontal lap siding
    const slats = 10;
    const h = 256 / slats;
    for (let i = 0; i < slats; i++) {
      const y = i * h;
      const grad = diffCtx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(0.85, 'rgba(220,210,196,0.08)');
      grad.addColorStop(1, 'rgba(145,134,118,0.34)');
      diffCtx.fillStyle = grad;
      diffCtx.fillRect(0, y, 256, h);

      bumpCtx.fillStyle = '#5c5c5c';
      bumpCtx.fillRect(0, y + h - 2.5, 256, 2.5);
    }
  } else {
    // Subtle matte warm plaster grain
    for (let i = 0; i < 900; i++) {
      diffCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(180,166,148,0.1)';
      diffCtx.fillRect(rand() * 256, rand() * 256, 3, 3);
      bumpCtx.fillStyle = rand() > 0.5 ? '#cccccc' : '#b2b2b2';
      bumpCtx.fillRect(rand() * 256, rand() * 256, 2, 2);
    }
  }

  const set = finalizeTextureSet(diffCanvas, bumpCanvas, 1, 1);
  textureCache.set(key, set);
  return set;
}

export function getFloorTextureSet(
  floorType: 'wood_warm' | 'wood_light' | 'tile_kitchen' | 'tile_bath' | 'stone_patio',
  widthTiles: number,
  depthTiles: number,
): MaterialTextureSet | null {
  const rx = Math.max(1, widthTiles / 2);
  const ry = Math.max(1, depthTiles / 2);
  const key = `${floorType}_${rx}_${ry}`;

  switch (floorType) {
    case 'wood_warm':
      return makeWoodTexture(key, '#cca072', '#9c6e44', '#865b36', rx, ry, 101);
    case 'wood_light':
      return makeWoodTexture(key, '#e0c49d', '#b89468', '#a38056', rx, ry, 202);
    case 'tile_kitchen':
      return makeTileTexture(key, '#efe8da', '#e6decb', '#c6bcab', 4, rx, ry);
    case 'tile_bath':
      return makeTileTexture(key, '#d7ece9', '#f3f7f6', '#b1c9c6', 4, rx, ry);
    case 'stone_patio':
      return makeStonePatioTexture(key, rx, ry);
  }
}

export function getGrassTextureSet(repeatX: number, repeatY: number): MaterialTextureSet | null {
  return makeGrassTexture(`grass_${repeatX}_${repeatY}`, repeatX, repeatY);
}

export function getWallTextureSet(isExterior: boolean): MaterialTextureSet | null {
  return makeWallTexture(isExterior ? 'wall_ext' : 'wall_int', isExterior);
}
