// Tabuleiro: lógica de combinação, doces especiais, cascatas, animações e efeitos.
import { getSprite, PALETTE, SPECIAL, hexA } from './art.js';
import { sfx } from './audio.js';

const { NONE, H, V, WRAP, BOMB } = SPECIAL;

const ease = {
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOut: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

const K = (r, c) => r * 16 + c;
const RC = k => [Math.floor(k / 16), k % 16];

let UID = 1;
class Candy {
  constructor(type, special, r, c) {
    this.id = UID++;
    this.type = type; this.special = special;
    this.x = c; this.y = r;
    this.scale = 1; this.alpha = 1; this.sx = 1; this.sy = 1; this.rot = 0;
  }
}

const COMBO_WORDS = { 3: 'Doce!', 4: 'Saboroso!', 5: 'Delicioso!', 6: 'Divino!' };

export class Board {
  constructor(canvas, level, cb) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = level;
    this.cb = cb;
    this.rows = level.rows; this.cols = level.cols;
    this.moves = level.moves;
    this.score = 0;
    this.collect = level.collect ? { ...level.collect } : null;
    this.jelly = [];
    this.jellyLeft = 0;
    for (let r = 0; r < this.rows; r++) {
      this.jelly.push([]);
      for (let c = 0; c < this.cols; c++) {
        const j = level.jelly ? level.jelly(r, c) : 0;
        this.jelly[r].push(j);
        this.jellyLeft += j;
      }
    }
    this.tweens = []; this.particles = []; this.fx = []; this.texts = []; this.dying = [];
    this.shake = 0; this.time = 0; this.idle = 0;
    this.busy = true; this.ended = false; this.paused = false; this.destroyed = false;
    this.hint = null; this.hintIds = null; this.selected = null; this.drag = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.generate();
    this.bindInput();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- ciclo ----------
  loop = (now) => {
    if (this.destroyed) return;
    const dt = Math.min(50, now - this.last);
    this.last = now;
    if (!this.paused) {
      this.time += dt;
      this.updateTweens(dt);
      this.updateFx(dt);
      if (!this.busy && !this.ended) {
        this.idle += dt;
        if (this.idle > 5000 && !this.hint) {
          this.hint = this.findMove();
          if (this.hint) this.hintIds = new Set(this.hint.map(([r, c]) => this.grid[r][c].id));
        }
      }
    }
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    const cv = this.canvas;
    cv.removeEventListener('pointerdown', this._down);
    cv.removeEventListener('pointermove', this._move);
    cv.removeEventListener('pointerup', this._up);
    cv.removeEventListener('pointercancel', this._cancel);
  }

  resize(size) {
    this.cellCss = size / this.cols;
    const w = size, h = this.cellCss * this.rows;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.spritePx = Math.round(this.cellCss * this.dpr);
  }

  tween(obj, to, dur, ez = ease.outQuad, delay = 0) {
    return new Promise(res => this.tweens.push({ obj, to, dur, ez, t: -delay, res, from: null }));
  }
  wait(ms) { return new Promise(res => this.tweens.push({ obj: null, dur: ms, t: 0, res })); }

  updateTweens(dt) {
    const list = this.tweens, keep = [], done = [];
    this.tweens = [];
    for (const tw of list) {
      tw.t += dt;
      if (tw.t < 0) { keep.push(tw); continue; }
      if (tw.obj) {
        if (!tw.from) { tw.from = {}; for (const k in tw.to) tw.from[k] = tw.obj[k]; }
        const e = tw.ez(Math.min(1, tw.t / tw.dur));
        for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      }
      (tw.t >= tw.dur ? done : keep).push(tw);
    }
    this.tweens = keep.concat(this.tweens);
    for (const tw of done) tw.res();
  }

  // ---------- geração ----------
  randType() { return Math.floor(Math.random() * this.level.colors); }
  inside(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }

  generate() {
    for (let tries = 0; tries < 300; tries++) {
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          let t;
          do { t = this.randType(); } while (
            (c >= 2 && row[c - 1].type === t && row[c - 2].type === t) ||
            (r >= 2 && this.grid[r - 1][c].type === t && this.grid[r - 2][c].type === t));
          row.push(new Candy(t, NONE, r, c));
        }
        this.grid.push(row);
      }
      if (this.findMove()) break;
    }
  }

  async start() {
    this.busy = true;
    const proms = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const cd = this.grid[r][c];
      cd.y = r - this.rows - 1;
      proms.push(this.tween(cd, { y: r }, 520, ease.outBack, c * 40 + (this.rows - r) * 30));
    }
    await Promise.all(proms);
    this.busy = false;
  }

  // ---------- entrada ----------
  bindInput() {
    const cv = this.canvas;
    this._down = e => {
      if (this.busy || this.ended || this.paused) return;
      const p = this.cellAt(e); if (!p) return;
      this.drag = { ...p, x: e.clientX, y: e.clientY };
      try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ }
      this.idle = 0; this.hint = null; this.hintIds = null;
    };
    this._move = e => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cellCss * 0.3) return;
      let dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = Math.sign(dx); else dr = Math.sign(dy);
      const { r, c } = this.drag;
      this.drag = null; this.selected = null;
      if (this.inside(r + dr, c + dc)) this.trySwap(r, c, r + dr, c + dc);
    };
    this._up = () => {
      if (!this.drag) return;
      const { r, c } = this.drag;
      this.drag = null;
      const s = this.selected;
      if (s) {
        if (s.r === r && s.c === c) { this.selected = null; return; }
        if (Math.abs(s.r - r) + Math.abs(s.c - c) === 1) { this.selected = null; this.trySwap(s.r, s.c, r, c); return; }
      }
      this.selected = { r, c };
      sfx.tick();
    };
    this._cancel = () => { this.drag = null; };
    cv.addEventListener('pointerdown', this._down);
    cv.addEventListener('pointermove', this._move);
    cv.addEventListener('pointerup', this._up);
    cv.addEventListener('pointercancel', this._cancel);
  }

  cellAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / this.cellCss);
    const r = Math.floor((e.clientY - rect.top) / this.cellCss);
    return this.inside(r, c) ? { r, c } : null;
  }

  // ---------- regras ----------
  typeAt(r, c) {
    const cd = this.grid[r][c];
    return !cd || cd.special === BOMB ? -1 : cd.type;
  }

  matchAt(r, c) {
    const t = this.typeAt(r, c);
    if (t < 0) return false;
    let n = 1;
    for (let x = c - 1; x >= 0 && this.typeAt(r, x) === t; x--) n++;
    for (let x = c + 1; x < this.cols && this.typeAt(r, x) === t; x++) n++;
    if (n >= 3) return true;
    n = 1;
    for (let y = r - 1; y >= 0 && this.typeAt(y, c) === t; y--) n++;
    for (let y = r + 1; y < this.rows && this.typeAt(y, c) === t; y++) n++;
    return n >= 3;
  }

  findMove() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (!this.inside(r2, c2)) continue;
        const a = this.grid[r][c], b = this.grid[r2][c2];
        if (!a || !b) continue;
        if (a.special === BOMB || b.special === BOMB || (a.special && b.special)) return [[r, c], [r2, c2]];
        this.grid[r][c] = b; this.grid[r2][c2] = a;
        const ok = this.matchAt(r, c) || this.matchAt(r2, c2);
        this.grid[r][c] = a; this.grid[r2][c2] = b;
        if (ok) return [[r, c], [r2, c2]];
      }
    }
    return null;
  }

  findGroups() {
    const runs = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const t = this.typeAt(r, c);
        let e = c + 1;
        if (t >= 0) while (e < this.cols && this.typeAt(r, e) === t) e++;
        if (t >= 0 && e - c >= 3) runs.push({ dir: 'h', type: t, keys: Array.from({ length: e - c }, (_, i) => K(r, c + i)) });
        c = e;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const t = this.typeAt(r, c);
        let e = r + 1;
        if (t >= 0) while (e < this.rows && this.typeAt(e, c) === t) e++;
        if (t >= 0 && e - r >= 3) runs.push({ dir: 'v', type: t, keys: Array.from({ length: e - r }, (_, i) => K(r + i, c)) });
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

  planSpecial(g, pref) {
    const longest = g.runs.reduce((a, b) => (b.keys.length > a.keys.length ? b : a));
    const hasH = g.runs.some(r => r.dir === 'h'), hasV = g.runs.some(r => r.dir === 'v');
    let special = NONE;
    if (longest.keys.length >= 5) special = BOMB;
    else if (hasH && hasV) special = WRAP;
    else if (longest.keys.length === 4) special = longest.dir === 'h' ? V : H;
    if (!special) return null;
    const cand = [];
    if (pref) for (const [r, c] of pref) { const k = K(r, c); if (g.cells.has(k)) cand.push(k); }
    if (special === WRAP) {
      const cnt = new Map();
      g.runs.forEach(run => run.keys.forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1)));
      for (const [k, n] of cnt) if (n > 1) cand.push(k);
    }
    cand.push(longest.keys[Math.floor(longest.keys.length / 2)], ...g.cells);
    const key = cand.find(k => { const [r, c] = RC(k); const cd = this.grid[r][c]; return cd && !cd.special; });
    return key === undefined ? null : { key, special };
  }

  // ---------- jogadas ----------
  async trySwap(r1, c1, r2, c2) {
    if (this.busy || this.ended) return;
    const a = this.grid[r1][c1], b = this.grid[r2][c2];
    if (!a || !b) return;
    this.busy = true; this.hint = null; this.hintIds = null; this.idle = 0;
    sfx.swap();
    this.grid[r1][c1] = b; this.grid[r2][c2] = a;
    await Promise.all([this.tween(a, { x: c2, y: r2 }, 170, ease.inOut), this.tween(b, { x: c1, y: r1 }, 170, ease.inOut)]);
    const combo = a.special === BOMB || b.special === BOMB || (a.special && b.special);
    if (combo) {
      this.useMove();
      await this.comboSwap(a, r2, c2, b, r1, c1);
      await this.resolve(null);
    } else if (this.matchAt(r1, c1) || this.matchAt(r2, c2)) {
      this.useMove();
      await this.resolve([[r2, c2], [r1, c1]]);
    } else {
      sfx.bad();
      this.grid[r1][c1] = a; this.grid[r2][c2] = b;
      await Promise.all([this.tween(a, { x: c1, y: r1 }, 170, ease.inOut), this.tween(b, { x: c2, y: r2 }, 170, ease.inOut)]);
      this.busy = false;
      return;
    }
    await this.afterTurn();
  }

  useMove() { this.moves--; this.cb.onUpdate?.(); }

  async comboSwap(a, ra, ca, b, rb, cb) {
    const consume = (cd, r, c) => { this.grid[r][c] = null; this.hitJelly(r, c); this.killCandy(cd); };
    const all = () => { const out = []; for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) out.push(K(r, c)); return out; };
    let keys = [];
    if (a.special === BOMB && b.special === BOMB) {
      consume(a, ra, ca); consume(b, rb, cb);
      this.fx.push({ kind: 'ring', x: ca + 0.5, y: ra + 0.5, t: 0, life: 700, maxR: 9, color: '#ffffff' });
      this.shake = 22; sfx.bomb(); sfx.boom();
      this.cb.onBigText?.('Incrível!', 'mega');
      await this.wait(350);
      keys = all();
    } else if (a.special === BOMB || b.special === BOMB) {
      const [bm, br, bc, other] = a.special === BOMB ? [a, ra, ca, b] : [b, rb, cb, a];
      consume(bm, br, bc);
      const color = other.type, kind = other.special;
      sfx.bomb();
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cd = this.grid[r][c];
        if (!cd || cd.special === BOMB || cd.type !== color) continue;
        keys.push(K(r, c));
        this.fx.push({ kind: 'bolt', x1: bc + 0.5, y1: br + 0.5, x2: c + 0.5, y2: r + 0.5, t: 0, life: 520, color: PALETTE[color].base });
        if (kind === H || kind === V) cd.special = Math.random() < 0.5 ? H : V;
        else if (kind === WRAP) cd.special = WRAP;
        if (kind) { cd.scale = 1.5; this.tween(cd, { scale: 1 }, 300, ease.outBack); }
      }
      this.shake = 10;
      if (kind) this.cb.onBigText?.('Divino!', 'mega');
      await this.wait(kind ? 520 : 300);
    } else {
      consume(a, ra, ca); consume(b, rb, cb);
      const striped = s => s === H || s === V;
      if (striped(a.special) && striped(b.special)) {
        for (let i = 0; i < this.cols; i++) keys.push(K(ra, i));
        for (let i = 0; i < this.rows; i++) keys.push(K(i, ca));
        this.beam('h', ra, a.type); this.beam('v', ca, b.type);
        sfx.zap(); this.shake = 10;
      } else if (a.special === WRAP && b.special === WRAP) {
        for (let r = ra - 2; r <= ra + 2; r++) for (let c = ca - 2; c <= ca + 2; c++) if (this.inside(r, c)) keys.push(K(r, c));
        this.fx.push({ kind: 'ring', x: ca + 0.5, y: ra + 0.5, t: 0, life: 600, maxR: 3.5, color: PALETTE[a.type].base });
        sfx.boom(); this.shake = 18;
      } else {
        for (let d = -1; d <= 1; d++) {
          if (this.inside(ra + d, 0)) { for (let i = 0; i < this.cols; i++) keys.push(K(ra + d, i)); this.beam('h', ra + d, a.type); }
          if (this.inside(0, ca + d)) { for (let i = 0; i < this.rows; i++) keys.push(K(i, ca + d)); this.beam('v', ca + d, b.type); }
        }
        sfx.zap(); sfx.boom(); this.shake = 16;
      }
      this.cb.onBigText?.('Divino!', 'mega');
    }
    await this.explode(keys, new Set(), 1, true);
    await this.gravity();
  }

  async resolve(pref) {
    let cascade = 0;
    for (;;) {
      const groups = this.findGroups();
      if (!groups.length) break;
      cascade++;
      const clear = [], created = new Map();
      for (const g of groups) {
        const plan = this.planSpecial(g, pref);
        g.cells.forEach(k => clear.push(k));
        if (plan) created.set(plan.key, plan);
        const bonus = plan ? [0, 60, 60, 120, 200][plan.special] : 0;
        let sx = 0, sy = 0;
        g.cells.forEach(k => { const [r, c] = RC(k); sx += c; sy += r; });
        this.addScore((g.cells.size * 20 + bonus) * cascade, sx / g.cells.size + 0.5, sy / g.cells.size + 0.5, PALETTE[g.type].dark);
      }
      sfx.pop(cascade);
      if (COMBO_WORDS[Math.min(cascade, 6)] && cascade >= 3) {
        this.cb.onBigText?.(COMBO_WORDS[Math.min(cascade, 6)]);
        sfx.combo(cascade);
      }
      for (const [k, p] of created) {
        const [r, c] = RC(k);
        const cd = this.grid[r][c];
        this.hitJelly(r, c);
        cd.special = p.special;
        cd.scale = 1.5;
        this.tween(cd, { scale: 1 }, 380, ease.outBack);
        this.burst(r, c, '#ffffff', 10, true);
        sfx.make();
      }
      await this.explode(clear, new Set(created.keys()), cascade, false);
      await this.gravity();
      pref = null;
    }
    return cascade;
  }

  async explode(keys, protect, cascade, scoreAll) {
    let wave = keys;
    const done = new Set();
    let depth = 0, any = false;
    while (wave.length) {
      const next = [];
      let pts = 0, px = 0, py = 0, pc = null;
      for (const k of wave) {
        if (done.has(k) || protect.has(k)) continue;
        const [r, c] = RC(k);
        if (!this.inside(r, c)) continue;
        done.add(k);
        this.hitJelly(r, c);
        const cd = this.grid[r][c];
        if (!cd) continue;
        this.grid[r][c] = null;
        any = true;
        this.killCandy(cd);
        if (cd.special !== BOMB) this.collectHit(cd.type);
        if (depth > 0 || scoreAll) { pts += 30 * cascade; px = c; py = r; pc = PALETTE[cd.type]?.dark; }
        if (cd.special) next.push(...this.activate(cd, r, c));
      }
      if (pts) this.addScore(pts, px + 0.5, py + 0.5, pc || '#5c129e');
      wave = next;
      depth++;
      if (wave.length) await this.wait(150);
    }
    this.cb.onUpdate?.();
    if (any) await this.wait(190);
  }

  activate(cd, r, c) {
    const out = [];
    switch (cd.special) {
      case H:
        for (let i = 0; i < this.cols; i++) out.push(K(r, i));
        this.beam('h', r, cd.type); sfx.zap(); this.shake = Math.max(this.shake, 7);
        break;
      case V:
        for (let i = 0; i < this.rows; i++) out.push(K(i, c));
        this.beam('v', c, cd.type); sfx.zap(); this.shake = Math.max(this.shake, 7);
        break;
      case WRAP:
        for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (this.inside(y, x)) out.push(K(y, x));
        this.fx.push({ kind: 'ring', x: c + 0.5, y: r + 0.5, t: 0, life: 500, maxR: 2.2, color: PALETTE[cd.type].base });
        sfx.boom(); this.shake = Math.max(this.shake, 12);
        break;
      case BOMB: {
        const t = this.mostCommon();
        for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
          const o = this.grid[y][x];
          if (o && o.special !== BOMB && o.type === t) {
            out.push(K(y, x));
            this.fx.push({ kind: 'bolt', x1: c + 0.5, y1: r + 0.5, x2: x + 0.5, y2: y + 0.5, t: 0, life: 480, color: PALETTE[t].base });
          }
        }
        sfx.bomb(); this.shake = Math.max(this.shake, 9);
        break;
      }
    }
    return out;
  }

  mostCommon() {
    const cnt = new Array(6).fill(0);
    for (const row of this.grid) for (const cd of row) if (cd && cd.special !== BOMB) cnt[cd.type]++;
    return cnt.indexOf(Math.max(...cnt));
  }

  async gravity() {
    const proms = [];
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const cd = this.grid[r][c];
        if (!cd) continue;
        if (write !== r) { this.grid[write][c] = cd; this.grid[r][c] = null; }
        write--;
      }
      const missing = write + 1;
      for (let r = write; r >= 0; r--) this.grid[r][c] = new Candy(this.randType(), NONE, r - missing - 0.3, c);
      for (let r = 0; r < this.rows; r++) {
        const cd = this.grid[r][c];
        if (cd.y === r && cd.x === c) continue;
        const dist = Math.abs(r - cd.y);
        const p = this.tween(cd, { y: r, x: c }, 90 + 95 * Math.sqrt(dist), ease.inQuad).then(() => {
          cd.sy = 0.8; cd.sx = 1.15;
          return this.tween(cd, { sx: 1, sy: 1 }, 220, ease.outBack);
        });
        proms.push(p);
      }
    }
    await Promise.all(proms);
  }

  async afterTurn() {
    if (this.goalDone()) {
      await this.sugarCrush();
      this.end(true);
      return;
    }
    if (this.moves <= 0) { this.end(false); return; }
    if (!this.findMove()) await this.shuffle();
    this.busy = false;
  }

  goalDone() {
    const L = this.level;
    if (L.kind === 'score') return this.score >= L.target;
    if (L.kind === 'collect') return Object.values(this.collect).every(v => v <= 0);
    return this.jellyLeft <= 0;
  }

  starsEarned() {
    const n = this.level.stars.filter(t => this.score >= t).length;
    return Math.max(1, n);
  }

  end(win) {
    this.ended = true;
    this.selected = null;
    this.cb.onEnd?.({ win, score: this.score, stars: win ? this.starsEarned() : 0 });
  }

  async sugarCrush() {
    this.cb.onBigText?.('Super Crush!', 'mega');
    sfx.sugar();
    await this.wait(900);
    let i = 0;
    while (this.moves > 0) {
      const pool = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cd = this.grid[r][c];
        if (cd && !cd.special) pool.push([r, c]);
      }
      if (!pool.length) break;
      const [r, c] = pool[Math.floor(Math.random() * pool.length)];
      const cd = this.grid[r][c];
      cd.special = Math.random() < 0.5 ? H : V;
      cd.scale = 1.7;
      this.tween(cd, { scale: 1 }, 300, ease.outBack);
      this.burst(r, c, '#fff6a8', 8, true);
      this.moves--;
      this.addScore(100, c + 0.5, r + 0.5, '#c48800');
      sfx.star(i++ % 4);
      await this.wait(110);
    }
    for (let guard = 0; guard < 12; guard++) {
      const keys = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c]?.special) keys.push(K(r, c));
      if (!keys.length) break;
      await this.explode(keys, new Set(), 1, true);
      await this.gravity();
      await this.resolve(null);
    }
  }

  async shuffle() {
    this.cb.onBigText?.('Embaralhando!', 'info');
    await this.wait(600);
    const list = [];
    for (const row of this.grid) for (const cd of row) list.push(cd);
    const place = () => { let i = 0; for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.grid[r][c] = list[i++]; };
    let ok = false;
    for (let t = 0; t < 80 && !ok; t++) {
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      place();
      ok = !this.findGroups().length && !!this.findMove();
    }
    for (let t = 0; t < 300 && !ok; t++) {
      list.forEach(cd => { if (!cd.special) cd.type = this.randType(); });
      ok = !this.findGroups().length && !!this.findMove();
    }
    const proms = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) proms.push(this.tween(this.grid[r][c], { x: c, y: r }, 480, ease.inOut));
    await Promise.all(proms);
  }

  // ---------- metas e pontos ----------
  hitJelly(r, c) {
    if (this.jelly[r][c] > 0) {
      this.jelly[r][c]--;
      this.jellyLeft--;
      this.burst(r, c, '#ff7ad0', 6, false);
    }
  }

  collectHit(type) {
    if (this.collect && this.collect[type] > 0) this.collect[type]--;
  }

  addScore(pts, x, y, color) {
    this.score += pts;
    if (x != null) this.texts.push({ x, y, text: String(pts), t: 0, life: 900, color });
    this.cb.onUpdate?.();
  }

  // ---------- efeitos ----------
  killCandy(cd) {
    this.dying.push(cd);
    cd.scale = 1.18;
    const col = cd.special === BOMB ? '#ffffff' : PALETTE[cd.type].base;
    this.burst(cd.y, cd.x, col, 7, false);
    this.tween(cd, { scale: 0, alpha: 0 }, 260, ease.inQuad).then(() => {
      const i = this.dying.indexOf(cd);
      if (i >= 0) this.dying.splice(i, 1);
    });
  }

  beam(dir, idx, type) {
    this.fx.push({ kind: 'beam', dir, idx, t: 0, life: 420, color: PALETTE[type]?.base || '#ffffff' });
  }

  burst(r, c, color, n, sparkle) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.0015 + Math.random() * 0.0045;
      this.particles.push({
        x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.002,
        t: 0, life: 450 + Math.random() * 350, color, size: 0.05 + Math.random() * 0.07,
        star: sparkle || Math.random() < 0.25,
      });
    }
  }

  updateFx(dt) {
    for (const p of this.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.000011 * dt; }
    this.particles = this.particles.filter(p => p.t < p.life);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < t.life);
    this.shake *= Math.pow(0.88, dt / 16);
    if (this.shake < 0.3) this.shake = 0;
  }

  // ---------- desenho ----------
  render() {
    const ctx = this.ctx, cs = this.cellCss;
    if (!cs) return;
    const W = cs * this.cols, Hh = cs * this.rows;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    ctx.save();
    if (this.shake) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const x = c * cs, y = r * cs;
      ctx.fillStyle = (r + c) & 1 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.17)';
      ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, cs - 3, cs - 3, cs * 0.2); ctx.fill();
      const j = this.jelly[r][c];
      if (j) {
        ctx.fillStyle = j > 1 ? 'rgba(255,50,170,.85)' : 'rgba(255,120,210,.62)';
        ctx.beginPath(); ctx.roundRect(x + 2.5, y + 2.5, cs - 5, cs - 5, cs * 0.22); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.beginPath(); ctx.roundRect(x + cs * 0.17, y + cs * 0.12, cs * 0.36, cs * 0.09, cs * 0.05); ctx.fill();
      }
    }

    if (this.selected) {
      const { r, c } = this.selected;
      const p = 0.5 + 0.5 * Math.sin(this.time / 140);
      ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.15 * p})`;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 + 0.3 * p})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(c * cs + 2, r * cs + 2, cs - 4, cs - 4, cs * 0.22); ctx.fill(); ctx.stroke();
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, Hh); ctx.clip();
    for (const row of this.grid) for (const cd of row) if (cd) this.drawCandy(cd);
    for (const cd of this.dying) this.drawCandy(cd);
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fx) this.drawFx(f, W, Hh);
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      const s = p.size * cs * (0.5 + 0.5 * k);
      const x = p.x * cs, y = p.y * cs;
      ctx.beginPath();
      if (p.star) {
        ctx.moveTo(x, y - s * 1.6); ctx.quadraticCurveTo(x, y, x + s * 1.6, y);
        ctx.quadraticCurveTo(x, y, x, y + s * 1.6); ctx.quadraticCurveTo(x, y, x - s * 1.6, y);
        ctx.quadraticCurveTo(x, y, x, y - s * 1.6);
      } else ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const p = t.t / t.life;
      const pop = p < 0.15 ? ease.outBack(p / 0.15) : 1;
      ctx.globalAlpha = 1 - p * p;
      ctx.font = `700 ${cs * 0.46 * pop}px Fredoka, system-ui, sans-serif`;
      const y = (t.y - p * 0.8) * cs;
      ctx.lineWidth = Math.max(3, cs * 0.09);
      ctx.strokeStyle = t.color; ctx.lineJoin = 'round';
      ctx.strokeText(t.text, t.x * cs, y);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.text, t.x * cs, y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawCandy(cd) {
    if (cd.scale <= 0.01 || cd.alpha <= 0.01) return;
    const ctx = this.ctx, cs = this.cellCss;
    const spr = getSprite(cd.type, cd.special, this.spritePx);
    let s = cd.scale, rot = cd.rot;
    if (cd.special === BOMB) rot += this.time * 0.0012;
    if (this.hintIds && this.hintIds.has(cd.id)) s *= 1 + 0.1 * Math.max(0, Math.sin(this.time / 110));
    if (this.selected && this.grid[this.selected.r][this.selected.c] === cd) s *= 1.06 + 0.04 * Math.sin(this.time / 140);
    ctx.save();
    ctx.globalAlpha = cd.alpha;
    ctx.translate((cd.x + 0.5) * cs, (cd.y + 0.5) * cs);
    if (rot) ctx.rotate(rot);
    ctx.scale(s * cd.sx, s * cd.sy);
    ctx.drawImage(spr, -cs / 2, -cs / 2, cs, cs);
    ctx.restore();
  }

  drawFx(f, W, Hh) {
    const ctx = this.ctx, cs = this.cellCss;
    const p = f.t / f.life, a = 1 - p;
    if (f.kind === 'beam') {
      const w = cs * (0.95 * (1 - p) + 0.08);
      const horiz = f.dir === 'h';
      const mid = (f.idx + 0.5) * cs;
      const g = horiz ? ctx.createLinearGradient(0, mid - w / 2, 0, mid + w / 2) : ctx.createLinearGradient(mid - w / 2, 0, mid + w / 2, 0);
      g.addColorStop(0, hexA(f.color, 0)); g.addColorStop(0.3, hexA(f.color, 0.8 * a));
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(0.7, hexA(f.color, 0.8 * a)); g.addColorStop(1, hexA(f.color, 0));
      ctx.fillStyle = g;
      if (horiz) ctx.fillRect(0, mid - w / 2, W, w); else ctx.fillRect(mid - w / 2, 0, w, Hh);
    } else if (f.kind === 'ring') {
      const rad = f.maxR * cs * ease.outQuad(p);
      ctx.strokeStyle = hexA(f.color, a);
      ctx.lineWidth = cs * 0.4 * a + 1;
      ctx.beginPath(); ctx.arc(f.x * cs, f.y * cs, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
      ctx.fill();
    } else if (f.kind === 'bolt') {
      const x1 = f.x1 * cs, y1 = f.y1 * cs, x2 = f.x2 * cs, y2 = f.y2 * cs;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const reach = Math.min(1, p * 4);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      const seg = 7;
      for (let i = 1; i <= seg; i++) {
        const tt = (i / seg) * reach;
        const j = i === seg ? 0 : (Math.random() - 0.5) * cs * 0.5;
        ctx.lineTo(x1 + dx * tt + nx * j, y1 + dy * tt + ny * j);
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = hexA(f.color, 0.85 * a); ctx.lineWidth = cs * 0.14; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = cs * 0.05; ctx.stroke();
    }
  }
}
