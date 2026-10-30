// Fases geradas de forma determinística: alterna pontuação, coleta e geleia.

export const MAX_LEVEL = 60;

const JELLY_PATTERNS = {
  centro: (r, c) => r >= 2 && r <= 5 && c >= 2 && c <= 5,
  base: (r) => r >= 5,
  borda: (r, c) => r === 0 || r === 7 || c === 0 || c === 7,
  cruz: (r, c) => r === 3 || r === 4 || c === 3 || c === 4,
  cantos: (r, c) => (r < 3 || r > 4) && (c < 3 || c > 4),
  xis: (r, c) => Math.abs(r - c) <= 1 || Math.abs(r + c - 7) <= 1,
  cheio: () => true,
};
const PATTERN_ORDER = ['centro', 'base', 'cruz', 'borda', 'cantos', 'xis', 'cheio'];

function seeded(n) {
  let s = n * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

export function getLevel(n) {
  const kind = ['score', 'collect', 'jelly'][(n - 1) % 3];
  const tier = Math.floor((n - 1) / 3);
  const colors = n <= 4 || n % 7 === 0 ? 5 : 6;
  const L = { n, kind, rows: 8, cols: 8, colors };

  if (kind === 'score') {
    L.moves = Math.max(15, 22 - Math.floor(tier / 3));
    L.target = 1500 + tier * 450;
    L.stars = [L.target, Math.round(L.target * 1.5), L.target * 2];
  } else if (kind === 'collect') {
    const rnd = seeded(n);
    const pool = [...Array(colors).keys()];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const k = n < 14 ? 2 : 3;
    const count = k === 2 ? 12 + tier * 2 : 10 + Math.round(tier * 1.4);
    L.collect = {};
    pool.slice(0, k).forEach(t => { L.collect[t] = count; });
    L.moves = 20 + Math.floor(tier / 4);
    L.stars = [L.moves * 60, L.moves * 140, L.moves * 230];
  } else {
    const pat = PATTERN_ORDER[tier % PATTERN_ORDER.length];
    const fn = JELLY_PATTERNS[pat];
    const double = n >= 15;
    L.jellyName = pat;
    L.jelly = (r, c) => (fn(r, c) ? (double && r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 2 : 1) : 0);
    let total = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) total += L.jelly(r, c);
    L.jellyTotal = total;
    L.moves = Math.min(40, 16 + Math.ceil(total / 3));
    L.stars = [L.moves * 60, L.moves * 140, L.moves * 230];
  }
  return L;
}
