// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).

let ac = null, master = null, muted = false;
try { muted = localStorage.getItem('supercrush_muted') === '1'; } catch { /* sem storage */ }

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone({ f = 440, f2 = null, d = 0.15, type = 'sine', v = 0.2, delay = 0, attack = 0.005 }) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + d + 0.05);
}

let noiseBuf = null;
function noise({ d = 0.2, v = 0.2, delay = 0, f = 1200, type = 'lowpass' }) {
  const a = ctx(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + delay;
  const src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf;
  flt.type = type; flt.frequency.value = f;
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(flt); flt.connect(g); g.connect(master);
  src.start(t); src.stop(t + d + 0.05);
}

const last = {};
function play(name, fn) {
  if (muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 45) return;
  last[name] = now;
  try { fn(); } catch { /* áudio indisponível */ }
}

const SCALE = [523, 587, 659, 784, 880, 988, 1046, 1175, 1318, 1568];

export const sfx = {
  unlock() { if (!muted) ctx(); },
  swap() { play('swap', () => tone({ f: 520, f2: 820, d: 0.09, v: 0.1 })); },
  bad() { play('bad', () => { tone({ f: 260, f2: 170, d: 0.16, type: 'square', v: 0.05 }); tone({ f: 220, f2: 140, d: 0.18, type: 'square', v: 0.045, delay: 0.1 }); }); },
  tick() { play('tick', () => tone({ f: 1000, d: 0.05, v: 0.07 })); },
  pop(n = 1) {
    play('pop', () => {
      const f = SCALE[Math.min(n - 1, SCALE.length - 1)];
      tone({ f, f2: f * 1.5, d: 0.12, type: 'triangle', v: 0.17 });
      tone({ f: f * 2, d: 0.08, v: 0.05, delay: 0.02 });
      noise({ d: 0.05, v: 0.05, f: 4000, type: 'highpass' });
    });
  },
  make() { play('make', () => [784, 1046, 1568].forEach((f, i) => tone({ f, d: 0.14, type: 'triangle', v: 0.1, delay: i * 0.05 }))); },
  zap() { play('zap', () => { tone({ f: 1500, f2: 220, d: 0.28, type: 'sawtooth', v: 0.06 }); noise({ d: 0.22, v: 0.08, f: 3000, type: 'highpass' }); }); },
  boom() { play('boom', () => { tone({ f: 170, f2: 40, d: 0.4, v: 0.35 }); noise({ d: 0.35, v: 0.2, f: 900 }); }); },
  bomb() {
    play('bomb', () => {
      for (let i = 0; i < 6; i++) tone({ f: 600 + i * 160, f2: 1300 + i * 200, d: 0.16, type: 'triangle', v: 0.07, delay: i * 0.04 });
      tone({ f: 140, f2: 45, d: 0.5, v: 0.3, delay: 0.1 });
    });
  },
  combo(n) { play('combo', () => [0, 2, 4, 7].slice(0, Math.min(4, n - 1)).forEach((s, i) => tone({ f: SCALE[s], d: 0.2, type: 'triangle', v: 0.1, delay: i * 0.07 }))); },
  sugar() { play('sugar', () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone({ f, d: 0.25, type: 'triangle', v: 0.12, delay: i * 0.08 }))); },
  win() { play('win', () => [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.36], [784, 0.5], [1046, 0.62]].forEach(([f, t]) => tone({ f, d: 0.3, type: 'triangle', v: 0.14, delay: t }))); },
  lose() { play('lose', () => [392, 349, 311, 262].forEach((f, i) => tone({ f, d: 0.35, type: 'triangle', v: 0.12, delay: i * 0.18 }))); },
  star(i) { play('star' + i, () => { tone({ f: 880 * (1 + i * 0.26), d: 0.3, type: 'triangle', v: 0.14 }); tone({ f: 1760 * (1 + i * 0.26), d: 0.2, v: 0.05, delay: 0.03 }); }); },
  click() { play('click', () => tone({ f: 700, f2: 1000, d: 0.07, type: 'triangle', v: 0.1 })); },
};

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('supercrush_muted', m ? '1' : '0'); } catch { /* sem storage */ }
  if (!m) ctx();
}
