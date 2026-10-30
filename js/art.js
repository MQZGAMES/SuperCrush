// Arte procedural dos doces: cada sprite é desenhado uma vez num canvas e reaproveitado.

export const PALETTE = [
  { base: '#ff2e5b', light: '#ffb0c2', dark: '#a3001f' }, // vermelho - jujuba
  { base: '#ff8a1c', light: '#ffd59a', dark: '#b84a00' }, // laranja - pastilha
  { base: '#ffd21a', light: '#fff7b8', dark: '#c48800' }, // amarelo - gota
  { base: '#33d15a', light: '#c0f9c4', dark: '#0f7a2d' }, // verde - quadrado
  { base: '#2e8cff', light: '#b3dbff', dark: '#0a3ea6' }, // azul - bola
  { base: '#b24dff', light: '#ecc4ff', dark: '#5c129e' }, // roxo - estrela
];

export const SPECIAL = { NONE: 0, H: 1, V: 2, WRAP: 3, BOMB: 4 };

const cache = new Map();

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function rpoly(ctx, pts, t) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], pv = pts[(i - 1 + n) % n], nx = pts[(i + 1) % n];
    const ax = p[0] + (pv[0] - p[0]) * t, ay = p[1] + (pv[1] - p[1]) * t;
    const bx = p[0] + (nx[0] - p[0]) * t, by = p[1] + (nx[1] - p[1]) * t;
    if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
    ctx.quadraticCurveTo(p[0], p[1], bx, by);
  }
  ctx.closePath();
}

function shapePath(ctx, type) {
  ctx.beginPath();
  switch (type) {
    case 0: ctx.ellipse(0, 0, 0.44, 0.31, -0.55, 0, Math.PI * 2); break;
    case 1: {
      const p = [];
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; p.push([Math.cos(a) * 0.47, Math.sin(a) * 0.4]); }
      rpoly(ctx, p, 0.28); break;
    }
    case 2: {
      const cy = 0.1, r = 0.34, a1 = -0.6435, a2 = -2.4981;
      ctx.moveTo(0, -0.46);
      ctx.lineTo(Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.arc(0, cy, r, a1, a2);
      ctx.closePath(); break;
    }
    case 3: rpoly(ctx, [[-0.37, -0.37], [0.37, -0.37], [0.37, 0.37], [-0.37, 0.37]], 0.3); break;
    case 4: ctx.arc(0, 0, 0.41, 0, Math.PI * 2); break;
    case 5: {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.25 : 0.49;
        p.push([Math.cos(a) * rad, Math.sin(a) * rad + 0.03]);
      }
      rpoly(ctx, p, 0.22); break;
    }
  }
}

function squarePath(ctx, s) { ctx.beginPath(); rpoly(ctx, [[-s, -s], [s, -s], [s, s], [-s, s]], 0.35); }

function body(ctx, path, pal, S) {
  ctx.save();
  ctx.shadowColor = 'rgba(40,0,50,.5)';
  ctx.shadowBlur = S * 0.06;
  ctx.shadowOffsetY = S * 0.035;
  path(); ctx.fillStyle = pal.dark; ctx.fill();
  ctx.restore();
  const g = ctx.createRadialGradient(-0.12, -0.16, 0.02, 0, 0, 0.52);
  g.addColorStop(0, pal.light); g.addColorStop(0.45, pal.base); g.addColorStop(1, pal.dark);
  path(); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 0.025; ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke();
}

function gloss(ctx, path) {
  ctx.save();
  path(); ctx.clip();
  const g = ctx.createLinearGradient(0, -0.45, 0, 0.05);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(-0.06, -0.21, 0.27, 0.15, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.beginPath(); ctx.ellipse(0.1, 0.3, 0.2, 0.06, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath(); ctx.ellipse(-0.17, -0.22, 0.055, 0.037, -0.5, 0, Math.PI * 2); ctx.fill();
}

function stripes(ctx, path, dir) {
  ctx.save();
  path(); ctx.clip();
  for (const i of [-1, 0, 1]) {
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    if (dir === SPECIAL.H) ctx.fillRect(-0.6, i * 0.2 - 0.045, 1.2, 0.09);
    else ctx.fillRect(i * 0.2 - 0.045, -0.6, 0.09, 1.2);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    if (dir === SPECIAL.H) ctx.fillRect(-0.6, i * 0.2 + 0.045, 1.2, 0.02);
    else ctx.fillRect(i * 0.2 + 0.045, -0.6, 0.02, 1.2);
  }
  ctx.restore();
}

function wrapped(ctx, pal, S) {
  for (const side of [-1, 1]) {
    const bow = () => {
      ctx.beginPath();
      ctx.moveTo(side * 0.2, 0);
      ctx.lineTo(side * 0.5, -0.28);
      ctx.quadraticCurveTo(side * 0.38, 0, side * 0.5, 0.28);
      ctx.closePath();
    };
    body(ctx, bow, pal, S);
  }
  const sq = () => squarePath(ctx, 0.31);
  body(ctx, sq, pal, S);
  ctx.save();
  sq(); ctx.clip();
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(255,255,255,.38)';
  for (let x = -0.6; x < 0.6; x += 0.17) ctx.fillRect(x, -0.6, 0.06, 1.2);
  ctx.restore();
  ctx.lineWidth = 0.03; ctx.strokeStyle = 'rgba(255,255,255,.7)';
  sq(); ctx.stroke();
  gloss(ctx, sq);
}

function bomb(ctx, S) {
  const path = () => { ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, Math.PI * 2); };
  ctx.save();
  ctx.shadowColor = 'rgba(40,0,50,.55)'; ctx.shadowBlur = S * 0.07; ctx.shadowOffsetY = S * 0.035;
  path(); ctx.fillStyle = '#2a1206'; ctx.fill();
  ctx.restore();
  const g = ctx.createRadialGradient(-0.12, -0.15, 0.02, 0, 0, 0.5);
  g.addColorStop(0, '#a8663a'); g.addColorStop(0.5, '#5a2d12'); g.addColorStop(1, '#22100a');
  path(); ctx.fillStyle = g; ctx.fill();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.31;
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = PALETTE[i % 6].base;
    ctx.beginPath(); ctx.roundRect(-0.055, -0.02, 0.11, 0.04, 0.02); ctx.fill();
    ctx.restore();
  }
  gloss(ctx, path);
}

export function getSprite(type, special, px) {
  const key = special === SPECIAL.BOMB ? `b_${px}` : `${type}_${special}_${px}`;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  ctx.translate(px / 2, px / 2);
  ctx.scale(px * 0.92, px * 0.92);
  const S = px;
  if (special === SPECIAL.BOMB) bomb(ctx, S);
  else if (special === SPECIAL.WRAP) wrapped(ctx, PALETTE[type], S);
  else {
    const path = () => shapePath(ctx, type);
    body(ctx, path, PALETTE[type], S);
    if (special === SPECIAL.H || special === SPECIAL.V) stripes(ctx, path, special);
    gloss(ctx, path);
  }
  cache.set(key, cv);
  return cv;
}

const urlCache = new Map();
export function iconURL(type, special = 0, px = 72) {
  const key = `${type}_${special}_${px}`;
  if (!urlCache.has(key)) urlCache.set(key, getSprite(type, special, px).toDataURL());
  return urlCache.get(key);
}
