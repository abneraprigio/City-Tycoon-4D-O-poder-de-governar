import * as THREE from 'three';

export interface ProceduralTextureSet {
  grass: THREE.CanvasTexture;
  fertile: THREE.CanvasTexture;
  hill: THREE.CanvasTexture;
  waterfront: THREE.CanvasTexture;
  road: THREE.CanvasTexture;
  avenue: THREE.CanvasTexture;
  facadeDay: THREE.CanvasTexture;
  facadeNightEmissive: THREE.CanvasTexture;
  brick: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Grass tile texture
  const [gc, gctx] = makeCanvas(128, 128);
  gctx.fillStyle = '#538a45';
  gctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 240; i++) {
    gctx.fillStyle = i % 2 === 0 ? 'rgba(110,165,82,0.22)' : 'rgba(48,88,40,0.22)';
    gctx.fillRect((i * 29) % 124, (i * 47) % 124, 4, 4);
  }
  gctx.strokeStyle = 'rgba(255,255,255,0.06)';
  gctx.strokeRect(0.5, 0.5, 127, 127);
  const grass = finalizeColorTex(gc, aniso);

  // 2. Fertile plain texture
  const [fc, fctx] = makeCanvas(128, 128);
  fctx.fillStyle = '#609446';
  fctx.fillRect(0, 0, 128, 128);
  fctx.fillStyle = 'rgba(145, 185, 85, 0.18)';
  for (let y = 8; y < 128; y += 16) {
    fctx.fillRect(4, y, 120, 5);
  }
  const fertile = finalizeColorTex(fc, aniso);

  // 3. Hill texture
  const [hc, hctx] = makeCanvas(128, 128);
  hctx.fillStyle = '#5c7c4e';
  hctx.fillRect(0, 0, 128, 128);
  hctx.fillStyle = 'rgba(120, 115, 95, 0.25)';
  for (let i = 0; i < 40; i++) {
    hctx.fillRect((i * 37) % 118, (i * 53) % 118, 8, 6);
  }
  const hill = finalizeColorTex(hc, aniso);

  // 4. Waterfront promenade / sand
  const [wc, wctx] = makeCanvas(128, 128);
  wctx.fillStyle = '#b9ab86';
  wctx.fillRect(0, 0, 128, 128);
  wctx.fillStyle = 'rgba(160, 146, 115, 0.3)';
  for (let i = 0; i < 160; i++) {
    wctx.fillRect((i * 19) % 124, (i * 41) % 124, 3, 3);
  }
  const waterfront = finalizeColorTex(wc, aniso);

  // 5. Paved street (Rua)
  const [rc, rctx] = makeCanvas(128, 128);
  rctx.fillStyle = '#8b95a5'; // Sidewalk border
  rctx.fillRect(0, 0, 128, 128);
  rctx.fillStyle = '#2d333d'; // Asphalt
  rctx.fillRect(14, 0, 100, 128);
  // Subtle asphalt grain
  for (let i = 0; i < 200; i++) {
    rctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    rctx.fillRect(16 + ((i * 23) % 96), (i * 31) % 126, 2, 2);
  }
  // Center dashed line
  rctx.fillStyle = '#eab308';
  for (let y = 8; y < 128; y += 26) {
    rctx.fillRect(62, y, 4, 14);
  }
  // Sidewalk curb lines
  rctx.fillStyle = '#cbd5e1';
  rctx.fillRect(12, 0, 2, 128);
  rctx.fillRect(114, 0, 2, 128);
  const road = finalizeColorTex(rc, aniso);

  // 6. Double Avenue (Avenida)
  const [ac, actx] = makeCanvas(128, 128);
  actx.fillStyle = '#94a3b8';
  actx.fillRect(0, 0, 128, 128);
  actx.fillStyle = '#252b34';
  actx.fillRect(8, 0, 112, 128);
  // Median green/concrete divider
  actx.fillStyle = '#4f7f42';
  actx.fillRect(60, 0, 8, 128);
  actx.fillStyle = '#e2e8f0';
  actx.fillRect(58, 0, 2, 128);
  actx.fillRect(68, 0, 2, 128);
  // Lane dashes
  actx.fillStyle = '#f8fafc';
  for (let y = 6; y < 128; y += 22) {
    actx.fillRect(32, y, 2, 11);
    actx.fillRect(94, y, 2, 11);
  }
  // Crosswalk stripes at edge
  actx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  for (let x = 14; x < 54; x += 9) {
    actx.fillRect(x, 4, 5, 10);
    actx.fillRect(x + 60, 4, 5, 10);
  }
  const avenue = finalizeColorTex(ac, aniso);

  // 7. Architectural Window Facade (Day & Night Emissive)
  const [fdc, fdctx] = makeCanvas(128, 128);
  fdctx.fillStyle = '#d6dce5';
  fdctx.fillRect(0, 0, 128, 128);
  const [fnc, fnctx] = makeCanvas(128, 128);
  fnctx.fillStyle = '#000000';
  fnctx.fillRect(0, 0, 128, 128);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 8 + col * 30;
      const y = 8 + row * 30;
      fdctx.fillStyle = '#334155';
      fdctx.fillRect(x - 1, y - 1, 22, 22);
      fdctx.fillStyle = '#7dd3fc';
      fdctx.fillRect(x + 1, y + 1, 18, 18);
      // Warm night glow on ~70% of windows
      if ((row * 5 + col * 3) % 10 < 7) {
        fnctx.fillStyle = (row + col) % 2 === 0 ? '#fde68a' : '#fed7aa';
        fnctx.fillRect(x + 1, y + 1, 18, 18);
      }
    }
  }
  const facadeDay = finalizeColorTex(fdc, aniso, 1, 1);
  const facadeNightEmissive = finalizeColorTex(fnc, aniso, 1, 1);

  // 8. Brick / Masonry texture
  const [bc, bctx] = makeCanvas(128, 128);
  bctx.fillStyle = '#b97a63';
  bctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    bctx.fillStyle = 'rgba(235, 225, 215, 0.35)';
    bctx.fillRect(0, y, 128, 2);
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 128; x += 32) {
      bctx.fillRect(x, y, 2, 16);
    }
  }
  const brick = finalizeColorTex(bc, aniso, 2, 2);

  // 9. Radial contact shadow
  const [sc, sctx] = makeCanvas(128, 128);
  const grad = sctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 15, 25, 0.52)');
  grad.addColorStop(0.65, 'rgba(10, 15, 25, 0.18)');
  grad.addColorStop(1, 'rgba(10, 15, 25, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadow = finalizeColorTex(sc, aniso);

  return {
    grass,
    fertile,
    hill,
    waterfront,
    road,
    avenue,
    facadeDay,
    facadeNightEmissive,
    brick,
    contactShadow,
    dispose: () => {
      grass.dispose();
      fertile.dispose();
      hill.dispose();
      waterfront.dispose();
      road.dispose();
      avenue.dispose();
      facadeDay.dispose();
      facadeNightEmissive.dispose();
      brick.dispose();
      contactShadow.dispose();
    },
  };
}
