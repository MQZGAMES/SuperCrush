// Telas, mapa de fases, HUD, modais e progresso salvo.
import { Board } from './board.js';
import { getLevel, MAX_LEVEL } from './levels.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { getSprite, iconURL } from './art.js';

const $ = s => document.querySelector(s);
const SAVE_KEY = 'supercrush_v1';
const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 1.8l3 6.4 7 .8-5.2 4.8 1.4 6.9L12 17.2l-6.2 3.5 1.4-6.9L2 9l7-.8z"/></svg>';
const ICONS = {
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

let save = loadSave();
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.unlocked) return s;
  } catch { /* sem save */ }
  return { unlocked: 1, stars: {}, best: {} };
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* sem storage */ } }

const fmt = n => n.toLocaleString('pt-BR');

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function refreshSoundButtons() {
  document.querySelectorAll('.btn-sound').forEach(b => { b.innerHTML = isMuted() ? ICONS.soundOff : ICONS.soundOn; });
}
document.addEventListener('click', e => {
  const b = e.target.closest('.btn-sound');
  if (!b) return;
  setMuted(!isMuted());
  refreshSoundButtons();
  sfx.click();
});

// ---------- título ----------
function titleRain() {
  const cv = $('#title-rain'), ctx = cv.getContext('2d');
  const drops = Array.from({ length: 22 }, () => newDrop(true));
  function newDrop(initial) {
    return {
      x: Math.random(), y: initial ? Math.random() : -0.1, s: 34 + Math.random() * 30,
      v: 0.00004 + Math.random() * 0.00006, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.002,
      type: Math.floor(Math.random() * 6), sp: Math.random() < 0.15 ? 1 + Math.floor(Math.random() * 4) : 0,
    };
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    if ($('#screen-title').classList.contains('active')) {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drops.forEach((d, i) => {
        d.y += d.v * dt; d.r += d.vr * dt;
        if (d.y > 1.1) drops[i] = newDrop(false);
        const spr = getSprite(d.type, d.sp, Math.round(d.s * dpr));
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(d.x * w, d.y * h);
        ctx.rotate(d.r);
        ctx.drawImage(spr, -d.s / 2, -d.s / 2, d.s, d.s);
        ctx.restore();
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

$('#btn-play').addEventListener('click', () => {
  sfx.unlock(); sfx.click();
  buildMap();
  show('screen-map');
  requestAnimationFrame(scrollMapToCurrent);
});
$('#map-back').addEventListener('click', () => { sfx.click(); show('screen-title'); });

// ---------- mapa ----------
const GAP = 104, PAD = 130;
function nodePos(i, w, H) {
  return { x: w * (0.5 + Math.sin(i * 0.85) * 0.3), y: H - PAD - (i - 1) * GAP };
}

function buildMap() {
  const inner = $('#map-inner');
  const w = inner.clientWidth || 360;
  const H = PAD * 2 + (MAX_LEVEL - 1) * GAP;
  inner.style.height = H + 'px';
  let d = '';
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const p = nodePos(i, w, H);
    if (i === 1) d += `M${p.x},${p.y}`;
    else { const q = nodePos(i - 1, w, H); d += ` C${q.x},${q.y - GAP / 2} ${p.x},${p.y + GAP / 2} ${p.x},${p.y}`; }
  }
  let html = `<svg class="map-path" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">
    <path d="${d}" class="road-shadow"/><path d="${d}" class="road"/><path d="${d}" class="road-dash"/></svg>`;
  for (let i = 0; i < 26; i++) {
    const y = (i + 0.5) * (H / 26), side = i % 2 ? 0.08 : 0.92;
    const x = w * (side + (Math.sin(i * 3.1) * 0.05));
    html += `<img class="deco" src="${iconURL(i % 6, i % 9 === 4 ? 3 : 0, 64)}" style="left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${i * 47}deg)" alt="">`;
  }
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const p = nodePos(i, w, H);
    const st = save.stars[i] || 0;
    const cls = i < save.unlocked || st ? 'done' : i === save.unlocked ? 'current' : 'locked';
    const stars = cls === 'locked' ? '' : `<div class="node-stars">${[1, 2, 3].map(k => `<i class="${k <= st ? 'on' : ''}">${STAR_SVG}</i>`).join('')}</div>`;
    html += `<button class="node ${cls}" data-level="${i}" style="left:${p.x}px;top:${p.y}px">
      <span>${cls === 'locked' ? '🔒' : i}</span>${stars}</button>`;
  }
  inner.innerHTML = html;
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $('#map-stars').innerHTML = `${STAR_SVG}<b>${total}</b>`;
}

function scrollMapToCurrent() {
  const el = document.querySelector(`.node[data-level="${Math.min(save.unlocked, MAX_LEVEL)}"]`);
  const sc = $('#map-scroll');
  if (el) sc.scrollTop = el.offsetTop - sc.clientHeight / 2;
}

$('#map-inner').addEventListener('click', e => {
  const n = e.target.closest('.node');
  if (!n) return;
  const lvl = +n.dataset.level;
  if (lvl > save.unlocked) { sfx.bad(); n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); return; }
  sfx.click();
  showIntro(lvl);
});

let lastMapW = 0;
new ResizeObserver(() => {
  const w = $('#map-inner').clientWidth;
  if (w && w !== lastMapW && $('#screen-map').classList.contains('active')) { lastMapW = w; buildMap(); }
}).observe($('#map-scroll'));

// ---------- modais ----------
function openModal(html, cls = '') {
  const m = $('#modal');
  m.querySelector('.card').className = 'card ' + cls;
  m.querySelector('.card').innerHTML = html;
  m.classList.add('open');
}
function closeModal() { $('#modal').classList.remove('open'); }

function goalHTML(L, big) {
  const sz = big ? 'big' : '';
  if (L.kind === 'score') return `<div class="goal-row ${sz}"><div class="goal-chip"><span class="goal-score">${fmt(L.target)}</span><small>pontos</small></div></div>`;
  if (L.kind === 'collect') {
    return `<div class="goal-row ${sz}">${Object.entries(L.collect).map(([t, n]) =>
      `<div class="goal-chip"><img src="${iconURL(+t, 0, 96)}" alt=""><b>${n}</b></div>`).join('')}</div>`;
  }
  return `<div class="goal-row ${sz}"><div class="goal-chip"><div class="jelly-ico"></div><b>${L.jellyTotal}</b></div></div>`;
}

function goalText(L) {
  if (L.kind === 'score') return `Faça <b>${fmt(L.target)}</b> pontos`;
  if (L.kind === 'collect') return 'Colete os doces';
  return 'Limpe toda a geleia';
}

function showIntro(n) {
  const L = getLevel(n);
  openModal(`
    <div class="ribbon">Nível ${n}</div>
    <div class="modal-stars">${[1, 2, 3].map(k => `<i class="${k <= (save.stars[n] || 0) ? 'on' : ''}">${STAR_SVG}</i>`).join('')}</div>
    <p class="goal-desc">${goalText(L)} em <b>${L.moves}</b> jogadas</p>
    ${goalHTML(L, true)}
    ${save.best[n] ? `<p class="best">Recorde: ${fmt(save.best[n])}</p>` : ''}
    <div class="btns"><button class="btn ghost" data-act="close">Voltar</button><button class="btn primary" data-act="play" data-level="${n}">Jogar!</button></div>`);
}

$('#modal').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) { if (e.target.id === 'modal' && $('#modal .card.dismiss')) closeModal(); return; }
  sfx.click();
  const act = b.dataset.act;
  if (act === 'close') closeModal();
  else if (act === 'play') startLevel(+b.dataset.level);
  else if (act === 'resume') { closeModal(); if (board) board.paused = false; }
  else if (act === 'retry') startLevel(cur.n);
  else if (act === 'next') showIntro(Math.min(cur.n + 1, MAX_LEVEL));
  else if (act === 'map') toMap();
});

function toMap() {
  closeModal();
  board?.destroy(); board = null;
  buildMap();
  show('screen-map');
  requestAnimationFrame(scrollMapToCurrent);
}

// ---------- jogo ----------
let board = null, cur = null;

function startLevel(n) {
  closeModal();
  cur = getLevel(n);
  board?.destroy();
  show('screen-game');
  $('#hud-level').textContent = n;
  buildHudGoals();
  board = new Board($('#board'), cur, { onUpdate: updateHud, onEnd, onBigText: bigText });
  fitBoard();
  updateHud();
  board.start();
}

function fitBoard() {
  if (!board) return;
  const wrap = $('#board-wrap');
  const w = wrap.clientWidth - 20, h = wrap.clientHeight - 20;
  const size = Math.max(200, Math.floor(Math.min(w, (h * cur.cols) / cur.rows)));
  board.resize(size);
}
new ResizeObserver(fitBoard).observe($('#board-wrap'));

function buildHudGoals() {
  const g = $('#hud-goals');
  if (cur.kind === 'score') g.innerHTML = `<div class="hg score"><small>Meta</small><b>${fmt(cur.target)}</b></div>`;
  else if (cur.kind === 'collect') g.innerHTML = Object.keys(cur.collect).map(t => `<div class="hg" data-t="${t}"><img src="${iconURL(+t, 0, 72)}" alt=""><b></b></div>`).join('');
  else g.innerHTML = '<div class="hg jelly"><div class="jelly-ico"></div><b></b></div>';
  const th = cur.stars, max = th[2];
  $('#starbar').querySelectorAll('.mk').forEach((m, i) => { m.style.left = `${(th[i] / max) * 100}%`; });
}

let shownScore = 0;
function updateHud() {
  if (!board) return;
  const mv = $('#hud-moves');
  mv.textContent = board.moves;
  mv.parentElement.classList.toggle('low', board.moves <= 5 && !board.ended);
  shownScore = board.score;
  $('#hud-score').textContent = fmt(shownScore);
  const th = cur.stars;
  $('#starbar .fill').style.width = `${Math.min(100, (board.score / th[2]) * 100)}%`;
  $('#starbar').querySelectorAll('.mk').forEach((m, i) => m.classList.toggle('on', board.score >= th[i]));
  if (cur.kind === 'collect') {
    $('#hud-goals').querySelectorAll('.hg').forEach(el => {
      const left = board.collect[el.dataset.t];
      el.querySelector('b').textContent = left > 0 ? left : '✓';
      el.classList.toggle('done', left <= 0);
    });
  } else if (cur.kind === 'jelly') {
    const el = $('#hud-goals .hg');
    el.querySelector('b').textContent = board.jellyLeft > 0 ? board.jellyLeft : '✓';
    el.classList.toggle('done', board.jellyLeft <= 0);
  } else {
    $('#hud-goals .hg').classList.toggle('done', board.score >= cur.target);
  }
}

function bigText(text, kind = '') {
  const el = $('#combo-text');
  el.textContent = text;
  el.dataset.t = text;
  el.className = '';
  void el.offsetWidth;
  el.className = 'show ' + kind;
}

function onEnd({ win, score, stars }) {
  const n = cur.n;
  if (win) {
    save.stars[n] = Math.max(save.stars[n] || 0, stars);
    save.best[n] = Math.max(save.best[n] || 0, score);
    save.unlocked = Math.max(save.unlocked, Math.min(n + 1, MAX_LEVEL));
    persist();
  }
  setTimeout(() => {
    if (win) {
      sfx.win();
      openModal(`
        <div class="ribbon win">Nível ${n} concluído!</div>
        <div class="modal-stars big">${[1, 2, 3].map(k => `<i class="${k <= stars ? 'on pop' : ''}" style="animation-delay:${0.25 + k * 0.3}s">${STAR_SVG}</i>`).join('')}</div>
        <p class="final-score">${fmt(score)}</p>
        <p class="best">Pontuação</p>
        <div class="btns"><button class="btn ghost" data-act="map">Mapa</button>${n < MAX_LEVEL ? '<button class="btn primary" data-act="next">Próximo</button>' : '<button class="btn primary" data-act="retry">Jogar de novo</button>'}</div>`, 'win');
      for (let k = 0; k < stars; k++) setTimeout(() => sfx.star(k), 550 + k * 300);
      confetti();
    } else {
      sfx.lose();
      openModal(`
        <div class="ribbon lose">Acabaram as jogadas!</div>
        <div class="sad">🍬</div>
        <p class="goal-desc">${cur.kind === 'score' ? `Faltaram <b>${fmt(Math.max(0, cur.target - score))}</b> pontos` : 'Faltou pouco para completar a meta'}</p>
        ${cur.kind !== 'score' ? remainingHTML() : ''}
        <div class="btns"><button class="btn ghost" data-act="map">Mapa</button><button class="btn primary" data-act="retry">Tentar de novo</button></div>`);
    }
  }, win ? 500 : 700);
}

function remainingHTML() {
  if (cur.kind === 'collect') {
    return `<div class="goal-row">${Object.entries(board.collect).map(([t, n]) =>
      `<div class="goal-chip ${n <= 0 ? 'ok' : ''}"><img src="${iconURL(+t, 0, 96)}" alt=""><b>${n > 0 ? n : '✓'}</b></div>`).join('')}</div>`;
  }
  return `<div class="goal-row"><div class="goal-chip"><div class="jelly-ico"></div><b>${board.jellyLeft}</b></div></div>`;
}

$('#btn-pause').addEventListener('click', () => {
  if (!board || board.ended) return;
  sfx.click();
  board.paused = true;
  openModal(`
    <div class="ribbon">Pausa</div>
    <p class="goal-desc">${goalText(cur)}</p>
    ${goalHTML(cur, false)}
    <div class="btns col">
      <button class="btn primary" data-act="resume">Continuar</button>
      <button class="btn secondary" data-act="retry">Recomeçar</button>
      <button class="btn ghost" data-act="map">Sair para o mapa</button>
    </div>`);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && board && !board.ended && !$('#modal').classList.contains('open')) $('#btn-pause').click();
});

// ---------- confete ----------
function confetti() {
  const layer = $('#confetti');
  layer.innerHTML = '';
  const colors = ['#ff2e5b', '#ff8a1c', '#ffd21a', '#33d15a', '#2e8cff', '#b24dff', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = Math.random() * 0.6 + 's';
    s.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    s.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px');
    s.style.setProperty('--rot', Math.random() * 900 + 'deg');
    layer.appendChild(s);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 4000);
}

// ---------- início ----------
window.SuperCrush = { get board() { return board; }, startLevel };
refreshSoundButtons();
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  titleRain();
  document.body.classList.add('ready');
});
