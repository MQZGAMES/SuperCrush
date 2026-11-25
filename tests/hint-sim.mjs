// Mede a qualidade da dica: um bot joga as fases seguindo cada política e conta vitórias.
// Uso: node tests/hint-sim.mjs [partidas por fase] [fases, ex.: 1-60]
import { makeState, applyMove, legalMoves, bestMove, firstMove, goalLeft } from '../js/hint.js';
import { getLevel } from '../js/levels.js';

const games = +(process.argv[2] || 20);
const [from, to] = (process.argv[3] || '1-30').split('-').map(Number);

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function newGame(L, rand) {
  const rt = () => Math.floor(rand() * L.colors);
  const grid = [];
  for (let r = 0; r < L.rows; r++) {
    const row = [];
    for (let c = 0; c < L.cols; c++) {
      let t;
      do { t = rt(); } while ((c >= 2 && row[c - 1].t === t && row[c - 2].t === t) || (r >= 2 && grid[r - 1][c].t === t && grid[r - 2][c].t === t));
      row.push({ t, s: 0 });
    }
    grid.push(row);
  }
  const jelly = [];
  for (let r = 0; r < L.rows; r++) { jelly.push([]); for (let c = 0; c < L.cols; c++) jelly[r].push(L.jelly ? L.jelly(r, c) : 0); }
  return makeState({ rows: L.rows, cols: L.cols, grid, jelly, collect: L.collect, kind: L.kind, moves: L.moves, target: L.target, colors: L.colors });
}

function shuffleIfStuck(st, rand) {
  for (let t = 0; t < 300 && !legalMoves(st).length; t++) st.cells.forEach(cd => { if (cd && !cd.s) cd.t = Math.floor(rand() * st.colors); });
}

const policies = {
  antiga: st => firstMove(st),
  aleatoria: (st, rand) => { const m = legalMoves(st); return m[Math.floor(rand() * m.length)]; },
  '1 lance': st => bestMove(st, { depth: 1 }).move,
  nova: st => bestMove(st).move,
};

const res = {};
let hintMs = 0, hintCalls = 0, hintMax = 0;
for (const name of Object.keys(policies)) res[name] = { win: 0, total: 0, left: 0 };
for (let n = from; n <= to; n++) {
  const L = getLevel(n);
  for (let g = 0; g < games; g++) {
    for (const [name, pick] of Object.entries(policies)) {
      const rand = rng(n * 1000 + g + 1); // mesmo tabuleiro inicial para todas as políticas
      const st = newGame(L, rand);
      const refill = () => Math.floor(rand() * L.colors);
      while (st.moves > 0 && goalLeft(st) > 0) {
        shuffleIfStuck(st, rand);
        const t0 = performance.now();
        const m = pick(st, rand);
        if (name === 'nova') { const dt = performance.now() - t0; hintMs += dt; hintCalls++; hintMax = Math.max(hintMax, dt); }
        if (!m) break;
        applyMove(st, m, refill);
      }
      const r = res[name];
      r.total++;
      if (goalLeft(st) === 0) r.win++;
      else r.left += L.kind === 'score' ? goalLeft(st) / L.target : L.kind === 'jelly' ? goalLeft(st) / L.jellyTotal : goalLeft(st) / Object.values(L.collect).reduce((a, b) => a + b, 0);
    }
  }
}
console.log(`fases ${from}-${to}, ${games} partidas cada`);
for (const [name, r] of Object.entries(res)) {
  const lost = r.total - r.win;
  console.log(`${name.padEnd(10)} vitórias ${(100 * r.win / r.total).toFixed(1).padStart(5)}%  (${r.win}/${r.total})  meta restante média nas derrotas ${lost ? (100 * r.left / lost).toFixed(0) : 0}%`);
}
console.log(`tempo da dica nova: média ${(hintMs / hintCalls).toFixed(1)} ms, máx ${hintMax.toFixed(1)} ms (Node, desktop)`);
