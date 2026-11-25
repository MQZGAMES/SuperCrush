// Dica estratégica: simula cada troca (e a melhor resposta seguinte) sem animação e
// escolhe a que mais avança a meta da fase. As regras espelham board.js
// (findGroups, planSpecial, resolve, explode, activate, comboSwap, gravity):
// ao mudar uma regra lá, mude aqui também.
// Sem DOM: roda no navegador e no Node (tests/).

export const NONE = 0, H = 1, V = 2, WRAP = 3, BOMB = 4;
const UNKNOWN = -2; // doce que ainda vai cair: a dica não conta com ele.
const WIN = 1e6;
const LOOKAHEAD = 0.7; // peso da melhor jogada seguinte
const POTENTIAL = 0.35; // peso de um especial criado que fica no tabuleiro

// ---------- estado ----------
// cells: array linear rows*cols de { t, s } (t = cor, s = especial) ou null.
export function makeState({ rows, cols, grid, jelly, collect, kind, moves, score = 0, target = 0, colors = 6 }) {
  const cells = new Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cd = grid[r][c];
    cells[r * cols + c] = cd ? { t: cd.type ?? cd.t, s: cd.special ?? cd.s ?? NONE } : null;
  }
  return {
    rows, cols, cells, colors, kind, moves, score, target,
    jelly: jelly ? jelly.flat() : new Array(rows * cols).fill(0),
    collect: collect ? { ...collect } : null,
  };
}

function clone(st) {
  return {
    ...st,
    cells: st.cells.map(x => (x ? { t: x.t, s: x.s } : null)),
    jelly: st.jelly.slice(),
    collect: st.collect ? { ...st.collect } : null,
  };
}

const typeAt = (st, i) => { const cd = st.cells[i]; return !cd || cd.s === BOMB || cd.t < 0 ? -1 : cd.t; };
const known = cd => cd && cd.t !== UNKNOWN;

function matchAt(st, r, c) {
  const { cols, rows } = st, t = typeAt(st, r * cols + c);
  if (t < 0) return false;
  let n = 1;
  for (let x = c - 1; x >= 0 && typeAt(st, r * cols + x) === t; x--) n++;
  for (let x = c + 1; x < cols && typeAt(st, r * cols + x) === t; x++) n++;
  if (n >= 3) return true;
  n = 1;
  for (let y = r - 1; y >= 0 && typeAt(st, y * cols + c) === t; y--) n++;
  for (let y = r + 1; y < rows && typeAt(st, y * cols + c) === t; y++) n++;
  return n >= 3;
}

// Trocas válidas (mesmo critério de Board.findMove / trySwap).
export function legalMoves(st) {
  const out = [], { rows, cols, cells } = st;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = r + dr, c2 = c + dc;
      if (r2 >= rows || c2 >= cols) continue;
      const i = r * cols + c, j = r2 * cols + c2, a = cells[i], b = cells[j];
      if (!known(a) || !known(b)) continue;
      if (a.s === BOMB || b.s === BOMB || (a.s && b.s)) { out.push([[r, c], [r2, c2]]); continue; }
      cells[i] = b; cells[j] = a;
      const ok = matchAt(st, r, c) || matchAt(st, r2, c2);
      cells[i] = a; cells[j] = b;
      if (ok) out.push([[r, c], [r2, c2]]);
    }
  }
  return out;
}

// ---------- simulação ----------
function findGroups(st) {
  const { rows, cols } = st, runs = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const t = typeAt(st, r * cols + c);
      let e = c + 1;
      if (t >= 0) while (e < cols && typeAt(st, r * cols + e) === t) e++;
      if (t >= 0 && e - c >= 3) runs.push({ dir: 'h', type: t, keys: Array.from({ length: e - c }, (_, i) => r * cols + c + i) });
      c = e;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const t = typeAt(st, r * cols + c);
      let e = r + 1;
      if (t >= 0) while (e < rows && typeAt(st, e * cols + c) === t) e++;
      if (t >= 0 && e - r >= 3) runs.push({ dir: 'v', type: t, keys: Array.from({ length: e - r }, (_, i) => (r + i) * cols + c) });
      r = e;
    }
  }
  const parent = runs.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  runs.forEach((run, i) => run.keys.forEach(k => {
    if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i);
  }));
  const groups = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, { runs: [], cells: new Set(), type: run.type });
    const g = groups.get(root);
    g.runs.push(run);
    run.keys.forEach(k => g.cells.add(k));
  });
  return [...groups.values()];
}

function planSpecial(st, g, pref) {
  const longest = g.runs.reduce((a, b) => (b.keys.length > a.keys.length ? b : a));
  const hasH = g.runs.some(r => r.dir === 'h'), hasV = g.runs.some(r => r.dir === 'v');
  let special = NONE;
  if (longest.keys.length >= 5) special = BOMB;
  else if (hasH && hasV) special = WRAP;
  else if (longest.keys.length === 4) special = longest.dir === 'h' ? V : H;
  if (!special) return null;
  const cand = [];
  if (pref) for (const k of pref) if (g.cells.has(k)) cand.push(k);
  if (special === WRAP) {
    const cnt = new Map();
    g.runs.forEach(run => run.keys.forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1)));
    for (const [k, n] of cnt) if (n > 1) cand.push(k);
  }
  cand.push(longest.keys[Math.floor(longest.keys.length / 2)], ...g.cells);
  const key = cand.find(k => { const cd = st.cells[k]; return cd && !cd.s; });
  return key === undefined ? null : { key, special };
}

function hitJelly(st, k, acc) {
  if (st.jelly[k] > 0) { st.jelly[k]--; acc.jelly++; }
}

function collectHit(st, t, acc) {
  if (st.collect && st.collect[t] > 0) { st.collect[t]--; acc.collected++; }
}

function mostCommon(st) {
  const cnt = new Array(6).fill(0);
  for (const cd of st.cells) if (known(cd) && cd.s !== BOMB) cnt[cd.t]++;
  return cnt.indexOf(Math.max(...cnt));
}

function activate(st, cd, k) {
  const { rows, cols } = st, r = Math.floor(k / cols), c = k % cols, out = [];
  if (cd.s === H) for (let i = 0; i < cols; i++) out.push(r * cols + i);
  else if (cd.s === V) for (let i = 0; i < rows; i++) out.push(i * cols + c);
  else if (cd.s === WRAP) {
    for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < rows && x >= 0 && x < cols) out.push(y * cols + x);
  } else if (cd.s === BOMB) {
    const t = mostCommon(st);
    st.cells.forEach((o, i) => { if (known(o) && o.s !== BOMB && o.t === t) out.push(i); });
  }
  return out;
}

function explode(st, keys, protect, cascade, scoreAll, acc) {
  let wave = keys, depth = 0;
  const done = new Set();
  while (wave.length) {
    const next = [];
    for (const k of wave) {
      if (done.has(k) || protect.has(k)) continue;
      done.add(k);
      hitJelly(st, k, acc);
      const cd = st.cells[k];
      if (!cd) continue;
      st.cells[k] = null;
      if (cd.t === UNKNOWN) continue;
      if (cd.s !== BOMB) collectHit(st, cd.t, acc);
      if (depth > 0 || scoreAll) acc.points += 30 * cascade;
      if (cd.s) { acc.fired++; next.push(...activate(st, cd, k)); }
    }
    wave = next;
    depth++;
  }
}

// refill: null = desconhecido (dica); função = cor aleatória (simulação de partida).
function gravity(st, refill) {
  const { rows, cols, cells } = st;
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const cd = cells[r * cols + c];
      if (!cd) continue;
      if (write !== r) { cells[write * cols + c] = cd; cells[r * cols + c] = null; }
      write--;
    }
    for (let r = write; r >= 0; r--) cells[r * cols + c] = { t: refill ? refill() : UNKNOWN, s: NONE };
  }
}

function resolve(st, pref, acc, refill) {
  let cascade = 0;
  for (;;) {
    const groups = findGroups(st);
    if (!groups.length) break;
    cascade++;
    const clear = [], created = new Map();
    for (const g of groups) {
      const plan = planSpecial(st, g, pref);
      g.cells.forEach(k => clear.push(k));
      if (plan) created.set(plan.key, plan);
      const bonus = plan ? [0, 60, 60, 120, 200][plan.special] : 0;
      acc.points += (g.cells.size * 20 + bonus) * cascade;
    }
    for (const [k, p] of created) {
      hitJelly(st, k, acc);
      st.cells[k].s = p.special;
      st.cells[k].fresh = true; // criado nesta jogada (clone() descarta a marca)
      acc.made.push({ k, s: p.special });
    }
    explode(st, clear, new Set(created.keys()), cascade, false, acc);
    gravity(st, refill);
    pref = null;
  }
  acc.cascades = Math.max(acc.cascades, cascade);
}

function comboSwap(st, a, ka, b, kb, acc, refill) {
  const { rows, cols } = st, all = () => st.cells.map((_, i) => i);
  const consume = k => { st.cells[k] = null; hitJelly(st, k, acc); };
  const ra = Math.floor(ka / cols), ca = ka % cols;
  let keys = [];
  if (a.s === BOMB && b.s === BOMB) {
    consume(ka); consume(kb); keys = all(); acc.combo = 'bomb2';
  } else if (a.s === BOMB || b.s === BOMB) {
    const [kbm, other] = a.s === BOMB ? [ka, b] : [kb, a];
    consume(kbm);
    let flip = 0;
    st.cells.forEach((cd, i) => {
      if (!known(cd) || cd.s === BOMB || cd.t !== other.t) return;
      keys.push(i);
      if (other.s === H || other.s === V) cd.s = flip++ % 2 ? V : H;
      else if (other.s === WRAP) cd.s = WRAP;
    });
    acc.combo = other.s ? 'bombSpecial' : 'bomb';
  } else {
    consume(ka); consume(kb);
    const striped = s => s === H || s === V;
    if (striped(a.s) && striped(b.s)) {
      for (let i = 0; i < cols; i++) keys.push(ra * cols + i);
      for (let i = 0; i < rows; i++) keys.push(i * cols + ca);
      acc.combo = 'cross';
    } else if (a.s === WRAP && b.s === WRAP) {
      for (let r = ra - 2; r <= ra + 2; r++) for (let c = ca - 2; c <= ca + 2; c++) if (r >= 0 && r < rows && c >= 0 && c < cols) keys.push(r * cols + c);
      acc.combo = 'wrap2';
    } else {
      for (let d = -1; d <= 1; d++) {
        if (ra + d >= 0 && ra + d < rows) for (let i = 0; i < cols; i++) keys.push((ra + d) * cols + i);
        if (ca + d >= 0 && ca + d < cols) for (let i = 0; i < rows; i++) keys.push(i * cols + ca + d);
      }
      acc.combo = 'stripeWrap';
    }
  }
  explode(st, keys, new Set(), 1, true, acc);
  gravity(st, refill);
}

// Aplica uma troca válida em st (muta) e devolve o que aconteceu.
export function applyMove(st, [[r1, c1], [r2, c2]], refill = null) {
  const { cols } = st, k1 = r1 * cols + c1, k2 = r2 * cols + c2;
  const a = st.cells[k1], b = st.cells[k2];
  const acc = { jelly: 0, collected: 0, points: 0, made: [], fired: 0, combo: null, cascades: 0 };
  st.cells[k1] = b; st.cells[k2] = a;
  if (a.s === BOMB || b.s === BOMB || (a.s && b.s)) {
    comboSwap(st, a, k2, b, k1, acc, refill);
    resolve(st, null, acc, refill);
  } else {
    resolve(st, [k2, k1], acc, refill);
  }
  st.moves--;
  st.score += acc.points;
  return acc;
}

// ---------- avaliação ----------
export function goalLeft(st) {
  if (st.kind === 'jelly') return st.jelly.reduce((a, b) => a + b, 0);
  if (st.kind === 'collect') return Object.values(st.collect).reduce((a, b) => a + Math.max(0, b), 0);
  if (st.kind === 'score' && st.target) return Math.max(0, st.target - st.score);
  return Infinity; // infinito: sem meta fechada
}

// Valor de uma jogada em "unidades de meta": geleia/coleta valem muito, pontos pouco.
function gain(st, acc) {
  const pts = st.kind === 'score' || st.kind === 'infinite' ? acc.points : acc.points * 0.05;
  let v = pts + (acc.jelly + acc.collected) * 120;
  if (goalLeft(st) === 0) v += WIN;
  return v;
}

// Quanto um especial que ficou no tabuleiro renderia se explodisse sozinho agora.
function potential(st, k) {
  const cd = st.cells[k];
  if (!known(cd) || !cd.s) return 0;
  const s2 = clone(st);
  const acc = { jelly: 0, collected: 0, points: 0, made: [], fired: 0 };
  explode(s2, [k], new Set(), 1, true, acc);
  const pts = st.kind === 'score' || st.kind === 'infinite' ? acc.points : acc.points * 0.05;
  return pts + (acc.jelly + acc.collected) * 120;
}

function evaluate(st, move) {
  const s = clone(st);
  const acc = applyMove(s, move);
  let v = gain(s, acc);
  if (goalLeft(s) !== 0 && s.moves > 0) {
    s.cells.forEach((cd, k) => { if (cd && cd.fresh && cd.s) v += POTENTIAL * potential(s, k); });
  }
  return { v, acc, after: s };
}

const SPECIAL_NAME = { [H]: 'um doce listrado', [V]: 'um doce listrado', [WRAP]: 'um embrulhado', [BOMB]: 'uma bomba de chocolate' };
const COMBO_TEXT = {
  bomb2: 'Bomba + bomba: limpa tudo!',
  bombSpecial: 'Bomba + especial: combo gigante!',
  bomb: 'Use a bomba de chocolate',
  cross: 'Junte os listrados: explosão em cruz!',
  wrap2: 'Junte os embrulhados: explosão 5x5!',
  stripeWrap: 'Listrado + embrulhado: cruz tripla!',
};

function bestSpecial(acc) {
  return acc.made.reduce((a, m) => (!a || m.s > a ? m.s : a), 0);
}

function goalNoun(st, acc) {
  if (st.kind === 'jelly' && acc.jelly) return `limpe ${acc.jelly} geleia${acc.jelly > 1 ? 's' : ''}`;
  if (st.kind === 'collect' && acc.collected) return `colete ${acc.collected} doce${acc.collected > 1 ? 's' : ''} da meta`;
  return null;
}

function explain(st, best) {
  const { acc, next } = best;
  if (best.win) return 'Essa jogada vence a fase!';
  if (acc.combo) return COMBO_TEXT[acc.combo];
  const sp = bestSpecial(acc);
  const noun = goalNoun(st, acc);
  if (next && next.winNext) return 'Prepare a vitória na próxima jogada';
  if (next && next.big && next.v > best.now * 1.5) {
    if (next.acc.combo) return 'Prepare um combo de especiais para a próxima';
    const nsp = bestSpecial(next.acc);
    if (nsp) return `Abra caminho para formar ${SPECIAL_NAME[nsp]} na próxima`;
  }
  if (sp) return `Forme ${SPECIAL_NAME[sp]}${noun ? ` e ${noun}` : ''}`;
  if (noun) return noun[0].toUpperCase() + noun.slice(1);
  if (st.kind === 'score' || st.kind === 'infinite') return 'A jogada que mais rende pontos agora';
  return null;
}

// Melhor jogada para a meta atual. Devolve { move, text } ou null.
export function bestMove(st, { depth = 2 } = {}) {
  const moves = legalMoves(st);
  if (!moves.length) return null;
  let best = null;
  for (const move of moves) {
    const e = evaluate(st, move);
    const win = goalLeft(e.after) === 0;
    let v = e.v, next = null;
    if (depth > 1 && !win && e.after.moves > 0) {
      for (const m2 of legalMoves(e.after)) {
        const e2 = evaluate(e.after, m2);
        if (!next || e2.v > next.v) next = { v: e2.v, acc: e2.acc, winNext: goalLeft(e2.after) === 0 };
      }
      if (next) {
        next.big = !!(next.acc.combo || bestSpecial(next.acc));
        v += LOOKAHEAD * next.v;
      }
    }
    // Desempate: jogadas mais baixas mexem mais no tabuleiro (mais chance de cascata).
    v += (move[0][0] + move[1][0]) * 0.5;
    if (!best || v > best.v) best = { move, v, now: e.v, acc: e.acc, next, win };
  }
  return { move: best.move, text: explain(st, best) };
}

// Primeira troca válida (dica antiga), usada como base de comparação nos testes.
export function firstMove(st) {
  return legalMoves(st)[0] || null;
}
