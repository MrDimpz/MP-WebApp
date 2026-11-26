import * as THREE from 'three';

export interface BrushedMetalTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export interface LetterFaceTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

/** Deterministic PRNG for repeatable procedural metal grain */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates high-resolution procedural anisotropic brushed metal PBR textures
 * (albedo, roughness, bump) via HTML5 Canvas.
 */
export function createBrushedMetalTextures(
  variant: 'gunmetal' | 'steel' | 'brass',
  maxAnisotropy: number
): BrushedMetalTextureSet {
  const size = 512;
  const rand = mulberry32(variant === 'gunmetal' ? 101 : variant === 'steel' ? 202 : 303);

  const albedoCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  albedoCanvas.width = roughCanvas.width = bumpCanvas.width = size;
  albedoCanvas.height = roughCanvas.height = bumpCanvas.height = size;

  const aCtx = albedoCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;

  const palette =
    variant === 'gunmetal'
      ? {
          base: '#2b313b',
          streakLight: 'rgba(130, 146, 168, 0.08)',
          streakDark: 'rgba(8, 10, 14, 0.14)',
          roughBase: 88,
        }
      : variant === 'steel'
        ? {
            base: '#8c96a4',
            streakLight: 'rgba(235, 242, 250, 0.12)',
            streakDark: 'rgba(38, 44, 54, 0.12)',
            roughBase: 68,
          }
        : {
            base: '#c0964c',
            streakLight: 'rgba(255, 232, 175, 0.14)',
            streakDark: 'rgba(78, 52, 16, 0.14)',
            roughBase: 60,
          };

  aCtx.fillStyle = palette.base;
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = `rgb(${palette.roughBase},${palette.roughBase},${palette.roughBase})`;
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1600; i++) {
    const y = rand() * size;
    const h = 0.7 + rand() * 1.8;
    const isLight = rand() > 0.48;
    const x = rand() * size * 0.4;
    const w = size * (0.45 + rand() * 0.65);

    aCtx.fillStyle = isLight ? palette.streakLight : palette.streakDark;
    aCtx.fillRect(x, y, w, h);
    if (x + w > size) {
      aCtx.fillRect(0, y, x + w - size, h);
    }

    const rDelta = isLight ? -16 : 18;
    const rVal = Math.max(20, Math.min(220, palette.roughBase + rDelta + (rand() - 0.5) * 14));
    rCtx.fillStyle = `rgba(${rVal},${rVal},${rVal},0.35)`;
    rCtx.fillRect(0, y, size, h);

    const bVal = isLight ? 156 : 102;
    bCtx.fillStyle = `rgba(${bVal},${bVal},${bVal},0.32)`;
    bCtx.fillRect(0, y, size, h);
  }

  if (variant === 'gunmetal') {
    const grad = aCtx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.04)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.12)');
    aCtx.fillStyle = grad;
    aCtx.fillRect(0, 0, size, size);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap };
}

interface SlatTemplateCanvases {
  width: number;
  height: number;
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
  rough: HTMLCanvasElement;
}

/**
 * Pre-bakes the shared machined steel + knurled brass + recessed nameplate baseplate ONCE
 * so stamping any A–Z letter takes < 0.3ms instead of redrawing 480 brushed streaks & knurls.
 */
function createSlatBaseTemplate(): SlatTemplateCanvases {
  const w = 512;
  const h = 384;
  const rand = mulberry32(42073);

  const albedo = document.createElement('canvas');
  const bump = document.createElement('canvas');
  const rough = document.createElement('canvas');
  albedo.width = bump.width = rough.width = w;
  albedo.height = bump.height = rough.height = h;

  const aCtx = albedo.getContext('2d')!;
  const bCtx = bump.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  // 1. Machined steel slat body
  const baseGrad = aCtx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0, '#3b414c');
  baseGrad.addColorStop(0.14, '#505866');
  baseGrad.addColorStop(0.5, '#3b414c');
  baseGrad.addColorStop(0.86, '#4c5462');
  baseGrad.addColorStop(1, '#262b33');
  aCtx.fillStyle = baseGrad;
  aCtx.fillRect(0, 0, w, h);

  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#686868';
  rCtx.fillRect(0, 0, w, h);

  // Fine brushed metal lines across slat
  for (let i = 0; i < 420; i++) {
    const y = rand() * h;
    const isBright = rand() > 0.5;
    aCtx.fillStyle = isBright ? 'rgba(220,230,245,0.05)' : 'rgba(10,12,16,0.08)';
    aCtx.fillRect(0, y, w, 1.2);
    bCtx.fillStyle = isBright ? 'rgba(180,180,180,0.18)' : 'rgba(100,100,100,0.18)';
    bCtx.fillRect(0, y, w, 1.2);
  }

  // 2. Knurled brass grip ridges along left & right edges
  const knurlW = 64;
  const drawKnurlBand = (startX: number) => {
    const bandGrad = aCtx.createLinearGradient(startX, 0, startX + knurlW, 0);
    bandGrad.addColorStop(0, '#785e2f');
    bandGrad.addColorStop(0.5, '#b8944f');
    bandGrad.addColorStop(1, '#6a5228');
    aCtx.fillStyle = bandGrad;
    aCtx.fillRect(startX, 0, knurlW, h);

    rCtx.fillStyle = '#4c4c4c';
    rCtx.fillRect(startX, 0, knurlW, h);

    const step = 16;
    aCtx.save();
    aCtx.beginPath();
    aCtx.rect(startX, 0, knurlW, h);
    aCtx.clip();

    bCtx.save();
    bCtx.beginPath();
    bCtx.rect(startX, 0, knurlW, h);
    bCtx.clip();

    for (let y = -knurlW; y < h + knurlW; y += step) {
      aCtx.strokeStyle = 'rgba(255, 234, 180, 0.34)';
      aCtx.lineWidth = 2.4;
      aCtx.beginPath();
      aCtx.moveTo(startX, y);
      aCtx.lineTo(startX + knurlW, y + knurlW);
      aCtx.stroke();

      aCtx.strokeStyle = 'rgba(30, 20, 8, 0.48)';
      aCtx.lineWidth = 2;
      aCtx.beginPath();
      aCtx.moveTo(startX, y + 4);
      aCtx.lineTo(startX + knurlW, y + knurlW + 4);
      aCtx.stroke();

      aCtx.strokeStyle = 'rgba(255, 234, 180, 0.24)';
      aCtx.lineWidth = 2;
      aCtx.beginPath();
      aCtx.moveTo(startX + knurlW, y);
      aCtx.lineTo(startX, y + knurlW);
      aCtx.stroke();

      bCtx.strokeStyle = '#ececec';
      bCtx.lineWidth = 3;
      bCtx.beginPath();
      bCtx.moveTo(startX, y);
      bCtx.lineTo(startX + knurlW, y + knurlW);
      bCtx.stroke();

      bCtx.strokeStyle = '#282828';
      bCtx.lineWidth = 2.5;
      bCtx.beginPath();
      bCtx.moveTo(startX, y + 5);
      bCtx.lineTo(startX + knurlW, y + knurlW + 5);
      bCtx.stroke();

      bCtx.strokeStyle = '#d4d4d4';
      bCtx.lineWidth = 2.5;
      bCtx.beginPath();
      bCtx.moveTo(startX + knurlW, y);
      bCtx.lineTo(startX, y + knurlW);
      bCtx.stroke();
    }

    aCtx.restore();
    bCtx.restore();

    const grooveX = startX === 0 ? knurlW : startX - 5;
    aCtx.fillStyle = '#14171d';
    aCtx.fillRect(grooveX, 0, 5, h);
    bCtx.fillStyle = '#181818';
    bCtx.fillRect(grooveX, 0, 5, h);
  };

  drawKnurlBand(0);
  drawKnurlBand(w - knurlW);

  // 3. Recessed dark charcoal central nameplate with fine brass pinstripe
  const padX = knurlW + 18;
  const padY = 22;
  const frameW = w - padX * 2;
  const frameH = h - padY * 2;

  aCtx.fillStyle = '#141820';
  aCtx.fillRect(padX, padY, frameW, frameH);

  aCtx.strokeStyle = 'rgba(212, 175, 106, 0.52)';
  aCtx.lineWidth = 4;
  aCtx.strokeRect(padX + 2, padY + 2, frameW - 4, frameH - 4);

  bCtx.fillStyle = '#686868';
  bCtx.fillRect(padX, padY, frameW, frameH);
  bCtx.strokeStyle = '#242424';
  bCtx.lineWidth = 8;
  bCtx.strokeRect(padX, padY, frameW, frameH);

  rCtx.fillStyle = '#b4b4b4';
  rCtx.fillRect(padX, padY, frameW, frameH);

  // Corner registration ticks inside recessed plate
  const tickLen = 16;
  aCtx.strokeStyle = 'rgba(205, 168, 96, 0.6)';
  aCtx.lineWidth = 3;
  const corners = [
    [padX + 12, padY + 12, 1, 1],
    [padX + frameW - 12, padY + 12, -1, 1],
    [padX + 12, padY + frameH - 12, 1, -1],
    [padX + frameW - 12, padY + frameH - 12, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    aCtx.beginPath();
    aCtx.moveTo(cx, cy + dy * tickLen);
    aCtx.lineTo(cx, cy);
    aCtx.lineTo(cx + dx * tickLen, cy);
    aCtx.stroke();
  }

  return { width: w, height: h, albedo, bump, rough };
}

/**
 * High-speed A–Z letter slat texture cache backed by a pre-baked metallic baseplate.
 * Eliminates repeated 512x384 canvas redraws & GPU uploads when switching puzzles or 5↔7 rows.
 */
export class LetterTextureCache {
  private readonly maxAnisotropy: number;
  private readonly template: SlatTemplateCanvases;
  private readonly cache = new Map<string, LetterFaceTextureSet>();

  constructor(maxAnisotropy: number) {
    this.maxAnisotropy = maxAnisotropy;
    this.template = createSlatBaseTemplate();
  }

  public get(rawLetter: string): LetterFaceTextureSet {
    const letter = rawLetter.toUpperCase();
    const existing = this.cache.get(letter);
    if (existing) return existing;

    const { width: w, height: h, albedo, bump, rough } = this.template;

    const albedoCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    const emissiveCanvas = document.createElement('canvas');
    albedoCanvas.width = bumpCanvas.width = roughCanvas.width = emissiveCanvas.width = w;
    albedoCanvas.height = bumpCanvas.height = roughCanvas.height = emissiveCanvas.height = h;

    const aCtx = albedoCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;
    const rCtx = roughCanvas.getContext('2d')!;
    const eCtx = emissiveCanvas.getContext('2d')!;

    // Blit pre-baked brushed steel + knurled brass + nameplate base in < 0.1ms
    aCtx.drawImage(albedo, 0, 0);
    bCtx.drawImage(bump, 0, 0);
    rCtx.drawImage(rough, 0, 0);
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, w, h);

    // Stamp deeply engraved uppercase letter filled with ivory-champagne enamel
    const fontSpec = '700 248px "Chakra Petch", "Arial Black", sans-serif';
    const centerX = w / 2;
    const centerY = h / 2 + 10;

    aCtx.font = fontSpec;
    aCtx.textAlign = 'center';
    aCtx.textBaseline = 'middle';
    aCtx.lineWidth = 12;
    aCtx.strokeStyle = '#080a0f';
    aCtx.strokeText(letter, centerX, centerY);

    const textGrad = aCtx.createLinearGradient(0, centerY - 105, 0, centerY + 105);
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.55, '#f7ebd1');
    textGrad.addColorStop(1, '#e0c690');
    aCtx.fillStyle = textGrad;
    aCtx.fillText(letter, centerX, centerY);

    bCtx.font = fontSpec;
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.lineWidth = 10;
    bCtx.strokeStyle = '#0a0a0a';
    bCtx.strokeText(letter, centerX, centerY);
    bCtx.fillStyle = '#202020';
    bCtx.fillText(letter, centerX, centerY);

    rCtx.font = fontSpec;
    rCtx.textAlign = 'center';
    rCtx.textBaseline = 'middle';
    rCtx.fillStyle = '#282828';
    rCtx.fillText(letter, centerX, centerY);

    eCtx.font = fontSpec;
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.fillStyle = '#e8cf9a';
    eCtx.fillText(letter, centerX, centerY);

    const map = new THREE.CanvasTexture(albedoCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = this.maxAnisotropy;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.anisotropy = this.maxAnisotropy;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.anisotropy = this.maxAnisotropy;

    const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.anisotropy = this.maxAnisotropy;

    const set: LetterFaceTextureSet = { map, bumpMap, roughnessMap, emissiveMap };
    this.cache.set(letter, set);
    return set;
  }

  /** Incrementally warms up to `batchSize` uncached A–Z letters during idle frames */
  public warmBatch(batchSize = 3): boolean {
    let generated = 0;
    for (let code = 65; code <= 90; code++) {
      const ch = String.fromCharCode(code);
      if (!this.cache.has(ch)) {
        this.get(ch);
        generated += 1;
        if (generated >= batchSize) return true;
      }
    }
    return false;
  }

  public dispose(): void {
    this.cache.forEach((set) => {
      set.map.dispose();
      set.bumpMap.dispose();
      set.roughnessMap.dispose();
      set.emissiveMap.dispose();
    });
    this.cache.clear();
  }
}

/** Soft radial studio contact shadow for grounding the vault housing */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
