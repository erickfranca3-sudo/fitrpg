
/* ===================== UI: som, efeitos, modais ===================== */
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d, type = 'sine', t0 = 0, v = 0.15) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.05);
}
const sfx = {
  click: () => tone(660, 0.06, 'square', 0, 0.05),
  coin: () => { tone(988, 0.08, 'square', 0, 0.08); tone(1319, 0.22, 'square', 0.08, 0.08); },
  setDone: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', i * 0.09, 0.18)),
  rest: () => [880, 880, 1175].forEach((f, i) => tone(f, 0.18, 'square', i * 0.22, 0.1)),
  levelUp: () => [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.28, 'triangle', i * 0.1, 0.2)),
  trophy: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', i * 0.12, 0.2)); tone(130, 1, 'sawtooth', 0, 0.08); },
  death: () => [392, 330, 262, 196, 130].forEach((f, i) => tone(f, 0.55, 'sawtooth', i * 0.32, 0.15)),
  warn: () => tone(160, 0.25, 'sawtooth', 0, 0.12)
};

/* ---------- Funcionamento em segundo plano: Wake Lock + áudio keep-alive + MediaSession ---------- */
const wakeLock = {
  sentinel: null, want: false,
  async acquire() {
    this.want = true;
    try {
      if ('wakeLock' in navigator && !this.sentinel && !document.hidden) {
        const s = await navigator.wakeLock.request('screen');
        if (!this.want) { s.release(); return; }
        this.sentinel = s;
        s.addEventListener('release', () => { if (this.sentinel === s) this.sentinel = null; this.badge(); });
      }
    } catch (e) { }
    this.badge();
  },
  release() {
    this.want = false;
    try { this.sentinel && this.sentinel.release(); } catch (e) { }
    this.sentinel = null; this.badge();
  },
  badge() { document.querySelectorAll('.wl-badge').forEach(b => { b.hidden = !this.sentinel; }); }
};
const keepAlive = {
  audio: null, url: null, osc: null, gain: null, on: false,
  makeWav() {
    const rate = 8000, n = rate, buf = new ArrayBuffer(44 + n), dv = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    str(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);      // silêncio (PCM 8-bit)
    return new Blob([buf], { type: 'audio/wav' });
  },
  start() {
    if (this.on) return; this.on = true;
    try {
      if (!this.audio) { this.url = URL.createObjectURL(this.makeWav()); this.audio = new Audio(this.url); this.audio.loop = true; this.audio.volume = 0.01; }
      const p = this.audio.play(); p && p.catch && p.catch(() => { });
    } catch (e) { }
    try {
      const a = ac();
      if (a && !this.osc) {
        this.osc = a.createOscillator(); this.gain = a.createGain();
        this.osc.frequency.value = 20; this.gain.gain.value = 0.00001;
        this.osc.connect(this.gain); this.gain.connect(a.destination); this.osc.start();
      }
    } catch (e) { }
    this.meta('Iniciando…');
  },
  meta(text) {
    try {
      if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'FitRPG • Treino em Andamento', artist: text, album: 'FitRPG' });
      navigator.mediaSession.playbackState = 'playing';
    } catch (e) { }
  },
  stop() {
    if (!this.on) return; this.on = false;
    try { this.audio && this.audio.pause(); } catch (e) { }
    try { if (this.osc) { this.osc.stop(); this.osc.disconnect(); this.gain.disconnect(); } } catch (e) { }
    this.osc = null; this.gain = null;
    try { if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; } } catch (e) { }
  }
};
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (wakeLock.want) wakeLock.acquire();
    if (keepAlive.on && keepAlive.audio) { const p = keepAlive.audio.play(); p && p.catch && p.catch(() => { }); }
  }
});
const WL_BADGE = '<div class="wl-badge" hidden style="font-size:.75rem;color:#4ade80;opacity:.85;margin-bottom:4px">🔆 Tela ativa</div>';

function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#toasts').appendChild(d); setTimeout(() => d.remove(), 3500);
}
function floaty(text, color, off = 0, big = false) {
  const st = $('#stage'); if (!st) return;
  const d = document.createElement('div'); d.className = 'float' + (big ? ' bigfloat' : '');
  d.textContent = text; d.style.color = color; d.style.bottom = (200 + off) + 'px';
  st.appendChild(d); setTimeout(() => d.remove(), 2700);
}
let zc = 100;
function modal(html, o = {}) {
  const ov = document.createElement('div'); ov.className = 'ov'; ov.style.zIndex = ++zc;
  ov.innerHTML = `<div class="mod ${o.cls || ''}">${o.close === false ? '' : '<button class="x" aria-label="Fechar">✕</button>'}<div class="mb">${html}</div></div>`;
  document.body.appendChild(ov);
  const M = { el: ov, body: ov.querySelector('.mb'), closed: false, close() { if (M.closed) return; M.closed = true; try { o.onClose && o.onClose(); } finally { ov.remove(); } } };
  if (o.close !== false) ov.querySelector('.x').onclick = () => { if (o.beforeClose) o.beforeClose(); M.close(); };
  return M;
}

/* ---------- Motor de efeitos do palco (canvas) ---------- */
const FX = { cv: null, cx: null, p: [], ff: [], leaves: [], stars: [], spiral: null };
function fxInit() {
  FX.cv = $('#fx'); FX.cx = FX.cv.getContext('2d');
  for (let i = 0; i < 14; i++) FX.ff.push({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28, s: 0.0004 + Math.random() * 0.0006 });
  for (let i = 0; i < 16; i++) {      // estrelinhas do estado de vitória (ao redor do avatar)
    const a = Math.random() * 6.28, rr = 0.7 + Math.random() * 0.4;
    FX.stars.push({ dx: Math.cos(a) * 115 * rr, dy: 150 + Math.sin(a) * 120 * rr, r: 3 + Math.random() * 4, ph: Math.random() * 6.28, sp: 0.003 + Math.random() * 0.004 });
  }
  requestAnimationFrame(fxLoop);
}
function burst(color, n = 40, rise = false) {
  const w = FX.cv.width, h = FX.cv.height;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 1 + Math.random() * 4;
    FX.p.push({ x: w / 2, y: h - 150, vx: Math.cos(a) * s, vy: (rise ? -Math.abs(Math.sin(a)) : Math.sin(a)) * s - 1.5, life: 1, dec: 0.012 + Math.random() * 0.015, r: 2 + Math.random() * 3, c: color, g: 0.06 });
  }
}
/* ---------- Folhas verdes caindo (vento suave + rotação) ---------- */
const LEAF_COLORS = ['#3fbf4a', '#58d65c', '#2f9e44', '#7be07a', '#22853a'];
function newLeaf(w, h, init) {
  return { x: Math.random() * w, y: init ? Math.random() * h : -12 - Math.random() * 40, vy: 0.35 + Math.random() * 0.55, ph: Math.random() * 6.28, amp: 0.3 + Math.random() * 0.5, fr: 0.0012 + Math.random() * 0.0012, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.04, s: 4 + Math.random() * 4, c: pick(LEAF_COLORS), a: 0.55 + Math.random() * 0.4 };
}
function drawLeaves(cx, w, h, t) {
  if (!FX.leaves.length) for (let i = 0; i < 16; i++) FX.leaves.push(newLeaf(w, h, true));
  const wind = Math.sin(t / 3500) * 0.25 + 0.15;
  cx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < FX.leaves.length; i++) {
    let l = FX.leaves[i];
    l.y += l.vy; l.x += Math.sin(t * l.fr + l.ph) * l.amp + wind; l.rot += l.vr + Math.sin(t * l.fr + l.ph) * 0.01;
    if (l.y > h + 12) { l = FX.leaves[i] = newLeaf(w, h, false); }
    if (l.x > w + 20) l.x = -15; else if (l.x < -20) l.x = w + 15;
    cx.save(); cx.translate(l.x, l.y); cx.rotate(l.rot); cx.globalAlpha = l.a; cx.fillStyle = l.c;
    cx.beginPath(); cx.ellipse(0, 0, l.s, l.s * 0.45, 0, 0, 6.28); cx.fill();
    cx.strokeStyle = '#0b5d2a'; cx.globalAlpha = l.a * 0.7; cx.lineWidth = 0.8;
    cx.beginPath(); cx.moveTo(-l.s, 0); cx.lineTo(l.s, 0); cx.stroke(); cx.restore();
  }
  cx.globalAlpha = 1;
}
function drawStar(cx, x, y, r) {
  cx.beginPath(); cx.moveTo(x, y - r); cx.quadraticCurveTo(x, y, x + r, y); cx.quadraticCurveTo(x, y, x, y + r);
  cx.quadraticCurveTo(x, y, x - r, y); cx.quadraticCurveTo(x, y, x, y - r); cx.fill();
}
/* ---------- Redemoinho espiral dourado ---------- */
function startSpiral(dur = 2400) { FX.spiral = { t0: performance.now(), dur }; }
function spiralStep(cx, w, h, t) {
  const sp = FX.spiral, k = (t - sp.t0) / sp.dur;
  if (k >= 1) { FX.spiral = null; victoryPose(); return; }
  const cxp = w / 2, base = h - 64, top = 240, fade = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
  const col = cx.createLinearGradient(0, base - top, 0, base);        // coluna de luz translúcida
  col.addColorStop(0, '#ffd24a00'); col.addColorStop(1, '#ffd24a55');
  cx.globalAlpha = 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.1)) * fade; cx.fillStyle = col;
  cx.fillRect(cxp - 62, base - top, 124, top); cx.globalAlpha = 1;
  const head = Math.min(1, k * 1.2) * top, n = Math.round(12 * fade);
  for (let i = 0; i < n; i++) {
    const s = i % 3, u = Math.random() * head, ang = u / top * 14 + k * 9 + s * 2.094, rad = 64 - 20 * (u / top);
    FX.p.push({ x: cxp + Math.cos(ang) * rad, y: base - u + Math.sin(ang) * rad * 0.28, vx: Math.cos(ang + 1.57) * 0.5, vy: -0.5, life: 1, dec: 0.03, r: 1.5 + Math.random() * 2.5, c: Math.random() < 0.3 ? '#fff3b0' : '#ffc928', g: 0 });
  }
  for (let s = 0; s < 3; s++) {            // cabeça luminosa de cada braço da espiral
    const ang = head / top * 14 + k * 9 + s * 2.094, rad = 64 - 20 * (head / top);
    FX.p.push({ x: cxp + Math.cos(ang) * rad, y: base - head + Math.sin(ang) * rad * 0.28, vx: 0, vy: -0.2, life: 1, dec: 0.06, r: 4.5, c: '#ffffff', g: 0 });
  }
}
function fxLoop(t) {
  const cv = FX.cv, cx = FX.cx;
  if (cv.width !== cv.clientWidth) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
  const w = cv.width, h = cv.height;
  cx.clearRect(0, 0, w, h);
  if (!w || !h) { requestAnimationFrame(fxLoop); return; }
  drawLeaves(cx, w, h, t);
  cx.globalCompositeOperation = 'lighter';
  FX.ff.forEach(f => {
    f.a += f.s * 16; f.x += Math.cos(f.a) * 0.0006; f.y += Math.sin(f.a * 1.3) * 0.0006;
    const al = 0.4 + 0.4 * Math.sin(t / 400 + f.a * 5);
    cx.fillStyle = `rgba(190,255,120,${al})`; cx.beginPath(); cx.arc(((f.x % 1) + 1) % 1 * w, ((f.y % 1) + 1) % 1 * (h - 60), 2.2, 0, 6.28); cx.fill();
  });
  if (FX.spiral) spiralStep(cx, w, h, t);
  if (S && S.day && S.day.done1 && S.day.done2) {      // brilhos dourados de vitória
    cx.fillStyle = '#ffe58a';
    FX.stars.forEach(st => {
      const tw = Math.sin(t * st.sp + st.ph); if (tw < 0.1) return;
      cx.globalAlpha = tw; drawStar(cx, w / 2 + st.dx, h - 60 - st.dy, st.r * (0.5 + tw));
    });
    cx.globalAlpha = 1;
  }
  const col = S && auraOf(S.streak);
  if (col) {
    const n = S.streak >= 30 ? 3 : S.streak >= 15 ? 2 : 1;
    for (let i = 0; i < n; i++) FX.p.push({ x: w / 2 + (Math.random() - 0.5) * 120, y: h - 70 - Math.random() * 40, vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random() * 1.8, life: 1, dec: 0.012, r: 1.5 + Math.random() * 3, c: col, g: 0 });
  }
  FX.p = FX.p.filter(p => p.life > 0);
  FX.p.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= p.dec;
    cx.globalAlpha = Math.max(0, p.life); cx.fillStyle = p.c;
    cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill();
  });
  cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(fxLoop);
}
function avAnim(cls) {
  const w = $('#avWrap'); w.classList.remove('jump', 'hit', 'evolve'); void w.offsetWidth; w.classList.add(cls);
  setTimeout(() => w.classList.remove(cls), 1500);
}
function stageOverlay(cls) {
  const d = document.createElement('div'); d.className = cls; $('#stage').appendChild(d); setTimeout(() => d.remove(), 1000);
}
/* Círculo de invocação + redemoinho; ao dissipar revela a Pose de Vitória */
let summoning = false;
function summon() {
  if (summoning) return; summoning = true;
  const s = $('#summon'), r = $('#ring'), w = $('#avWrap');
  w.classList.remove('jump', 'hit', 'evolve', 'victory');
  s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  r.classList.add('charge'); w.classList.add('charge');
  startSpiral(2400);
  setTimeout(() => { s.classList.remove('on'); r.classList.remove('charge'); w.classList.remove('charge'); }, 2700);
  setTimeout(() => { if (summoning) { FX.spiral = null; summoning = false; } }, 6000);   // proteção (aba oculta)
}
function victoryPose() {
  const w = $('#avWrap'); if (!w) return;
  w.classList.remove('jump', 'hit', 'evolve', 'charge', 'victory'); void w.offsetWidth; w.classList.add('victory');
  burst('#facc15', 60, true); burst('#ffffff', 30); vib([80, 40, 160]);
  setTimeout(() => { w.classList.remove('victory'); summoning = false; }, 1700);
}
/* Feixe de luz mágica percorrendo a barra de XP */
let lastBeam = 0;
function xpBeam() {
  const now = performance.now(); if (now - lastBeam < 500) return; lastBeam = now;
  const bar = $('.bar.xp'), tr = $('.bar.xp .track'), f = $('#xpFill'); if (!bar || !tr || !f) return;
  const b = document.createElement('div'); b.className = 'xp-beam'; tr.appendChild(b); setTimeout(() => b.remove(), 1100);
  bar.classList.remove('xp-glow'); f.classList.remove('xp-hot'); void bar.offsetWidth; bar.classList.add('xp-glow'); f.classList.add('xp-hot');
  setTimeout(() => { bar.classList.remove('xp-glow'); f.classList.remove('xp-hot'); }, 1400);
}
/* Micro-animações em repouso: piscar e limpar o suor da testa */
function idleStart() {
  const av = $('#avatar'), sw = $('#avSweat'), wrap = $('#avWrap'); let n = 0;
  const busy = () => activeTrainingModal || document.hidden || summoning || ['jump', 'hit', 'evolve', 'victory', 'charge'].some(c => wrap.classList.contains(c));
  const run = (cls, ms) => { av.classList.remove('blink', 'wipe'); void av.offsetWidth; av.classList.add(cls); setTimeout(() => av.classList.remove(cls), ms); };
  const loop = () => {
    if (!busy()) {
      n++;
      if (n % 4 === 0) { run('wipe', 1800); sw.classList.remove('on'); void sw.offsetWidth; sw.classList.add('on'); setTimeout(() => sw.classList.remove('on'), 1500); }
      else { run('blink', 300); if (Math.random() < 0.3) setTimeout(() => { if (!busy()) run('blink', 300); }, 450); }
    }
    setTimeout(loop, 2800 + Math.random() * 2400);
  };
  setTimeout(loop, 2500);
}
function flushFx() {
  while (pendingFx.length) {
    const f = pendingFx.shift();
    if (f === 'jump') { avAnim('jump'); burst('#facc15', 36, true); }
    else if (f === 'hit') { avAnim('hit'); stageOverlay('stage-red'); sfx.warn(); vib([200, 80, 200]); }
    else if (f === 'evolve') { stageOverlay('flash'); burst('#ffffff', 90); floaty('EVOLUÇÃO!', '#fff', 0, true); sfx.levelUp(); summon(); }
    else if (f === 'levelup') { burst('#00d2ff', 70); burst('#facc15', 40); floaty('LEVEL UP!', '#facc15', 40, true); summon(); }
    else if (f === 'victory') { if (!summoning) victoryPose(); }
    else if (f === 'heal') { burst('#4ade80', 40, true); }
  }
}

/* ---------- Render ---------- */
let curSprite = null;
function commit() {
  checkTrophies(); save(); render(); flushFx();
  if (S.dead) showDeath();
}
function render() {
  const h = S.hero, ph = phaseNum(), pct = weightPct(), need = lvlNeed(S.lvl);
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#hTitle').textContent = `${PHASE_NAME[ph]} ${h.name} • Nv. ${S.lvl}`;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#hRank').textContent = 'Rank ' + rankOf(S.lvl);
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#hpFill').style.width = (S.hp / maxHp() * 100) + '%'; $('#hpTxt').textContent = `${S.hp} / ${maxHp()}`;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#xpFill').style.width = (S.xp / need * 100) + '%'; $('#xpTxt').textContent = `${Math.floor(S.xp)} / ${need}`;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#wtFill').style.width = pct + '%'; $('#wtTxt').textContent = `Boss HP: ${r1(Math.max(0, h.weight - h.goal))} kg`;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#cGold').textContent = fnum(S.gold); $('#cStreak').textContent = S.streak;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#cWeight').textContent = `⚖️ ${r1(h.weight)} kg (Boss: -${r1(Math.max(0, h.weight - h.goal))} kg)`;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#cClass').textContent = (h.cls === 'cyclist' ? '🚲 Ciclista' : '🥾 Andarilho') + ' • ' + COND[h.level].n;
  const col = auraOf(S.streak), si = spriteIdx();
  const src = `assets/av${si + 1}.png`;
  if (curSprite !== src) { const im = $('#avatar'); if (curSprite) { im.style.opacity = 0; setTimeout(() => { im.src = src; im.style.opacity = 1; }, 250); } else im.src = src; curSprite = src; }
  const g = $('#auraGlow');
  g.style.opacity = col ? 1 : 0;
  if (col) { g.style.background = `radial-gradient(circle,${col}88 0,${col}33 45%,transparent 70%)`; g.style.animation = 'ring 1.8s ease-in-out infinite'; }
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#ring').querySelectorAll('i').forEach(i => { i.style.borderColor = col || '#00d2ff'; i.style.boxShadow = `0 0 18px ${col || '#00d2ff'},inset 0 0 18px ${col || '#00d2ff'}`; });
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#phaseTag').textContent = `${PHASE_NAME[ph].toUpperCase()}${col ? ' • AURA ' + (S.streak >= 30 ? 'OURO' : S.streak >= 15 ? 'SOMBRIA' : 'ELÉTRICA') : ''}`;
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#avWrap').classList.toggle('won', !!(S.day && S.day.done1 && S.day.done2));
  renderMissions(); renderShop(); renderTrophies();
}

function renderMissions() {
  const d = S.day, m = d.m2, el = $('#tab-missions');
  const wp = Math.min(100, d.water / d.waterGoal * 100);
  const bossHp = r1(Math.max(0, S.hero.weight - S.hero.goal));
  const isDue = weighDue();
  const daysLeft = S.nextWeigh ? Math.max(0, keyToDays(S.nextWeigh) - keyToDays(gameKey())) : 7;
  let h = '';

  // Card do Boss Balança (Guardião da Balança)
  if (isDue) {
    h += `<div class="banner-w boss-ambush">
      <span style="font-size:2.2rem">👹</span>
      <div style="flex:1">
        <b style="color:#ffe066;font-size:1.05rem">🚨 EMBOSCADA DO BOSS BALANÇA!</b>
        <div class="muted">O Guardião da Balança convocou a Pesagem Oficial! Fotografe o visor e golpeie o Boss com OCR.</div>
      </div>
      <button class="btn gold" data-act="weigh">⚔️ BATALHAR</button>
    </div>`;
  } else {
    h += `<div class="card boss-card">
      <div class="ic" style="font-size:2.2rem">⚖️</div>
      <div class="tx">
        <b style="color:#c084fc">👹 RAID BOSS: GUARDIÃO DA BALANÇA</b>
        <small>HP do Boss: <b style="color:#facc15">${bossHp} kg</b> até a meta ideal</small>
        <small class="muted">👁️ Espreitando nas sombras • Emboscada surpresa em ~${daysLeft} dia${daysLeft === 1 ? '' : 's'}</small>
      </div>
      <button class="btn" style="border-color:#a855f7;box-shadow:0 0 10px #a855f755" data-act="weigh">⚔️ DESAFIAR</button>
    </div>`;
  }

  h += `<div class="mission water ${d.done1 ? 'done' : ''}"><span class="reward">+10 💰 +25 XP</span><h3>💧 Missão #1 • Hidratação Real</h3>
    <div class="muted">Meta: ${r1(S.hero.weight)} kg × 35 ml = ${d.waterGoal} ml</div>
    <div class="pbar"><i style="width:${wp}%"></i><span>${d.water} / ${d.waterGoal} ml</span></div>
    <div class="btns"><button class="btn" data-act="water" data-ml="250">+250ml Copo</button><button class="btn" data-act="water" data-ml="500">+500ml Garrafa</button></div></div>`;
  const rw = '<span class="reward">+25 💰 +75 XP</span>';
  if (d.rest && !d.done2) {
    h += `<div class="mission rest"><h3>🛌 Missão #2 • Congelada</h3><div class="muted">Dia de Descanso ativo. Ofensiva e HP protegidos hoje.</div></div>`;
  } else if (m.type === 'muscle') {
    const tot = m.exs.length, dn = m.exs.filter(e => e.done >= e.sets).length;
    h += `<div class="mission train ${d.done2 ? 'done' : ''}">${rw}<h3>🏋️ Missão #2 • Treino ${m.plan}</h3><div class="muted">${PLAN_NAME[m.plan]} • conclua TODOS os exercícios</div>
      <div class="pbar red"><i style="width:${dn / tot * 100}%"></i><span>${dn} / ${tot} exercícios</span></div><div class="exlist">`;
    m.exs.forEach((e, i) => {
      const ok = e.done >= e.sets, x = EX[e.id], tgt = x.k === 'i' ? e.secs + 's' : e.reps + ' reps';
      h += `<button class="ex ${ok ? 'ok' : ''}" data-act="ex" data-i="${i}" ${ok ? 'disabled' : ''}><span>${ok ? '✅' : x.k === 't' ? '👃' : '▶️'}</span><div style="flex:1"><b>${x.n}</b><br><small>${e.sets}× ${tgt}${e.load ? ' • 🎒 ' + e.load + ' kg' : ''}</small></div><small>${e.done}/${e.sets}</small></button>`;
    });
    h += '</div></div>';
  } else {
    const names = { walk: '🥾 Caminhada GPS', bike: '🚲 Pedal GPS', rope: '🦘 Pular Corda' };
    const cur = m.type === 'rope' ? m.jumps : m.km, un = m.type === 'rope' ? 'saltos' : 'km';
    const p = Math.min(100, cur / m.goal * 100), pc = Math.round(cur / m.goal * 100);
    const lbl = `${m.type === 'rope' ? Math.floor(cur) : cur.toFixed(2)} / ${m.goal} ${un}${d.done2 ? ' (' + pc + '%)' : ''}`;
    h += `<div class="mission train ${d.done2 ? 'done' : ''}">${rw}<h3>${names[m.type]}</h3><div class="muted">Missão #2 • Cardio sorteado${m.gravity ? ' • 🪨 Gravidade Aumentada (+15%)' : ''}</div>
      <div class="pbar red"><i style="width:${p}%"></i><span>${lbl}</span></div>
      <button class="btn primary big" data-act="cardio">${d.done2 ? '🔥 TREINAR MAIS (MODO OVERDRIVE)' : cur > 0 ? '▶️ CONTINUAR' : '▶️ INICIAR'}</button></div>`;
  }
  const left = 2 - S.rest.used;
  h += `<button class="btn big" data-act="rest" ${(left <= 0 || d.rest || d.done2) ? 'disabled' : ''}>🛌 Ativar Dia de Descanso Hoje (${S.rest.used}/2 usados)</button>
        <p class="muted center">Folgas resetam a cada 7 dias${d.rest ? ' • Descanso ativo hoje' : ''}.</p>`;
  el.innerHTML = h;
}
function renderShop() {
  let h = `<div class="sec">🌳 ÁRVORE DE HABILIDADES</div>`;
  SK.forEach(s => {
    const n = S.sk[s.id], nx = n + 1, c = skCost(s.id, nx);
    const eff = s.id === 'titan' ? `-${n} HP de dano • +${2 * n} HP máx.` : `+${(n * 0.5).toFixed(1).replace('.', ',')}% atual`;
    h += `<div class="card"><div class="ic">${s.ic}</div><div class="tx"><b>${s.n} • Nv. ${n}/10</b><small>${s.d}</small><small>${eff}</small><div class="lvl">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="btn" data-act="skill" data-id="${s.id}" ${n >= 10 || S.gold < c ? 'disabled' : ''}>${n >= 10 ? 'MAX' : c + ' 💰'}</button></div>`;
  });
  h += `<div class="sec">🧪 SOBREVIVÊNCIA</div>
    <div class="card"><div class="ic">🧪</div><div class="tx"><b>Poção de Sangue Vital</b><small>+${Math.max(30, Math.round(maxHp() * 0.35))} HP (35% do máx.) • Possui: ${S.potions}</small></div>
      <div style="display:grid;gap:4px"><button class="btn" data-act="buy" data-id="potion" ${S.gold < 80 ? 'disabled' : ''}>80 💰</button><button class="btn" data-act="usepotion" ${S.potions < 1 || S.hp >= maxHp() ? 'disabled' : ''}>Usar</button></div></div>
    <div class="card"><div class="ic">🛡️</div><div class="tx"><b>Escudo de Aegis</b><small>Protege Ofensiva e HP em 1 falha • Limite 1 • Possui: ${S.shield}</small></div>
      <button class="btn" data-act="buy" data-id="shield" ${S.shield >= 1 || S.gold < 180 ? 'disabled' : ''}>180 💰</button></div>
    <div class="sec">🎁 RECOMPENSAS DA VIDA REAL</div>`;
  IRL.forEach(i => { h += `<div class="card"><div class="tx"><b>${i.n}</b></div><button class="btn gold" data-act="buy" data-id="${i.id}" ${S.gold < i.p ? 'disabled' : ''}>${i.p} 💰</button></div>`; });
  if (S.tickets.length) {
    h += `<div class="sec">🎫 TICKETS RESGATADOS</div>`;
    S.tickets.slice().reverse().forEach(t => { h += `<div class="ticket">🎫 ${esc(t.n)}<br><small>${new Date(t.at).toLocaleString('pt-BR')}</small></div>`; });
  }
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#tab-shop').innerHTML = h;
}
const RAR = { bronze: ['Bronze', '#cd7f32'], prata: ['Prata', '#cfd8e3'], ouro: ['Ouro', '#facc15'], platina: ['Platina', '#7ff0ff'], mitica: ['Mítica', '#ff4df0'] };
function renderTrophies() {
  const n = Object.keys(S.tr).length;
  let h = `<div class="sec">🏆 SALA DE TROFÉUS • ${n} / ${TR.length} desbloqueadas</div><div class="tgrid">`;
  TR.forEach((t, i) => {
    const id = i + 1, num = pad(id);
    if (S.tr[id]) h += `<div class="tro r-${t.r}"><div class="ic">${t.i}</div><b>${t.n}</b><div class="rar" style="color:${RAR[t.r][1]}">${RAR[t.r][0]}</div><small>${t.d}</small></div>`;
    else h += `<div class="tro lock"><div class="ic">🔒</div><b>🔒 Conquista Secreta #${num}</b><small>??? (Continue treinando e superando seus limites para descobrir este segredo)</small></div>`;
  });
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#tab-trophies').innerHTML = h + '</div>';
}

/* ---------- Modais gerais ---------- */
function showNextTrophy() {
  const id = trQueue.shift(); if (!id) { trOpen = false; return; }
  trOpen = true; const t = TR[id - 1]; sfx.trophy(); vib([200, 100, 200]);
  const M = modal(`<div class="big-ic">${t.i}</div><h2>🏆 NOVA CONQUISTA DESBLOQUEADA!</h2><h3>${t.n}</h3><div class="rar" style="color:${RAR[t.r][1]}">${RAR[t.r][0]}</div><p>${t.d}</p><p class="muted">+20 XP</p><button class="btn gold big" id="ok">INCRÍVEL!</button>`,
    { cls: 'trophy', close: false, onClose: () => { trOpen = false; if (trQueue.length) setTimeout(showNextTrophy, 200); } });
  M.el.querySelector('#ok').onclick = M.close;
}
function showTicket(t) {
  const M = modal(`<div style="font-size:3.5rem">🎫</div><h2>TICKET DOURADO!</h2><div class="ticket">${esc(t.n)}<br><small>${new Date(t.at).toLocaleString('pt-BR')}</small></div><p class="muted">Você suou por isso. Aproveite sem culpa!</p><button class="btn gold big" id="ok">RESGATAR NA VIDA REAL</button>`, { cls: 'trophy' });
  M.el.querySelector('#ok').onclick = M.close;
}
let deathOpen = false;
function showDeath() {
  if (deathOpen) return; deathOpen = true; sfx.death(); vib([500, 200, 500]);
  const M = modal(`<div style="font-size:4rem">💀</div><h2 style="color:#ff5a5a">VOCÊ SUCUMBIU À INÉRCIA!</h2>
    <p>Seu HP chegou a 0. Você voltou ao Nível 1, perdeu todo o Ouro, os níveis de Skills e a Ofensiva (seu peso real, troféus e maestria oculta dos exercícios foram mantidos).</p>
    <button class="btn primary big" id="ok">⚔️ JURAR REDENÇÃO (Recomeçar Nv. 1)</button>`, { cls: 'death', close: false, onClose: () => { deathOpen = false; } });
  M.el.querySelector('#ok').onclick = () => { M.close(); redeem(); toast('🔥 Você renasceu das cinzas.'); };
}

/* ---------- Modal de Musculação ---------- */
function openExercise(i) {
  const ex = S.day.m2.exs[i]; if (!ex || ex.done >= ex.sets) return;
  const x = EX[ex.id]; if (!x) return;
  let phase = 'ready', tap = 0, lastTap = 0, t0 = 0, restEnd = 0, iv = null, isoAlerted = false;
  const target = x.k === 'i' ? ex.secs + ' segundos (isometria)' : ex.reps + ' repetições';
  const minT = x.k === 'i' ? ex.secs : Math.max(6, ex.reps * 1.5);
  activeTrainingModal = true; wakeLock.acquire();
  const M = modal('', { beforeClose: () => save(), onClose: () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); ex.runStart = null; ex.restEnd = null; wakeLock.release(); activeTrainingModal = false; commit(); } });
  const draw = () => {
    let b = `${WL_BADGE}<h2>${x.n}</h2><div class="muted">${ex.load ? '🎒 Carga Improvisada: <b>' + ex.load + ' kg</b> (mochila, livros ou garrafas)' : 'Peso corporal'}</div>
      <div class="big">Série ${ex.done + 1} de ${ex.sets}</div><div class="muted">Meta: ${target}</div>`;
    if (phase === 'rest') b += `<div class="big" style="color:#5be0ff;margin-top:14px">⏳ DESCANSO</div><div class="clock" id="clk"></div><div class="muted">Respire. A próxima série começa quando zerar.</div>`;
    else if (x.k === 't') b += `<button class="touchbtn" data-a="tap">👃<br>TOQUE AQUI COM O NARIZ OU PEITO<b id="tc">${tap}/${ex.reps}</b></button><div class="warn" id="warn"></div><div class="muted">Trava anti-cheat: 1,2 s entre repetições</div>`;
    else if (phase === 'ready') b += `<button class="btn primary big" data-a="start">▶️ INICIAR SÉRIE</button>`;
    else b += `<div class="clock" id="clk"></div><button class="btn big" id="fin" data-a="fin" disabled>✅ Concluir Série</button>`;
    M.body.innerHTML = b; wakeLock.badge();
  };
  const tick = () => {
    const c = M.body.querySelector('#clk');
    if (phase === 'rest') {
      const left = Math.ceil((restEnd - Date.now()) / 1000);
      if (left <= 0) { sfx.rest(); vib([300, 100, 300]); phase = 'ready'; tap = 0; draw(); return; }
      if (c) c.textContent = left + 's';
    } else if (phase === 'run' && c) {
      const el = (Date.now() - t0) / 1000;
      if (x.k === 'i') {
        const left = Math.max(0, Math.ceil(minT - el)); c.textContent = left + 's';
        if (left <= 0 && !isoAlerted) { isoAlerted = true; sfx.rest(); vib([300, 100, 300]); }
      }
      else c.textContent = el.toFixed(0) + 's';
      const f = M.body.querySelector('#fin');
      if (f && el >= minT && f.disabled) { f.disabled = false; sfx.click(); vib(60); }
      if (f && el < minT && x.k !== 'i') f.textContent = `✅ Concluir Série (${Math.ceil(minT - el)}s)`; else if (f) f.textContent = '✅ Concluir Série';
    }
  };
  const finishSet = () => {
    if (M.closed) return;
    ex.done++; if (x.k === 't') S.tot.push += ex.reps; timeEvents(); sfx.setDone(); vib(120);
    if (ex.done >= ex.sets) {
      S.mast[ex.id] = Math.min(10, (S.mast[ex.id] || 1) + 1);
      const all = S.day.m2.exs.every(e => e.done >= e.sets);
      M.close();
      if (all) completeM2(); else { toast('✅ Exercício concluído!'); commit(); }
    } else { phase = 'rest'; restEnd = Date.now() + ex.rest * 1000; ex.restEnd = restEnd; ex.runStart = null; commit(); draw(); }
  };
  M.body.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'); if (!a) return; ac();
    if (a.dataset.a === 'start') { phase = 'run'; t0 = Date.now(); ex.runStart = t0; isoAlerted = false; draw(); tick(); }
    else if (a.dataset.a === 'fin') { if ((Date.now() - t0) / 1000 >= minT) finishSet(); }
    else if (a.dataset.a === 'tap') {
      const n = Date.now(), w = M.body.querySelector('#warn');
      if (n - lastTap < 1200) { sfx.warn(); vib(150); if (w) w.textContent = '⚠️ Cadência inválida! Desça e suba de verdade.'; return; }
      lastTap = n; tap++; sfx.click(); vib(40); if (w) w.textContent = '';
      const tc = M.body.querySelector('#tc'); if (tc) tc.textContent = tap + '/' + ex.reps;
      if (tap >= ex.reps) setTimeout(finishSet, 250);
    }
  });
  const vis = () => { if (!M.closed && !document.hidden) tick(); };
  draw(); iv = setInterval(tick, 250);
  document.addEventListener('visibilitychange', vis);
}

/* ---------- Sensores ---------- */
async function motionPerm() {
  if (typeof DeviceMotionEvent === 'undefined') return false;
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try { return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (e) { return false; }
  }
  return true;
}
function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180, dLa = (b.la - a.la) * rad, dLo = (b.lo - a.lo) * rad;
  const q = Math.sin(dLa / 2) ** 2 + Math.cos(a.la * rad) * Math.cos(b.la * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}
const mmss = s => pad(Math.floor(s / 60)) + ':' + pad(Math.floor(s % 60));

/* ---------- Overdrive (excedente após bater a meta) ---------- */
const OVD = {
  walk: { unit: 0.1, gold: 1.5, xp: 4.5, sk: 'hermes' },      // +15💰 +45XP por 1,0 km
  bike: { unit: 0.25, gold: 1.5, xp: 4.5, sk: 'ciclista' },    // +15💰 +45XP por 2,5 km
  rope: { unit: 10, gold: 1, xp: 3, sk: 'hermes' }             // +10💰 +30XP por 100 saltos
};
function overInit(m) { m.overPaid = m.overPaid || 0; m.overGold = m.overGold || 0; m.overXp = m.overXp || 0; m.overBuffGiven = !!m.overBuffGiven; m.tmSec = m.tmSec || 0; m.tmKm = m.tmKm || 0; }
function overAmount(m) { return Math.max(0, (m.type === 'rope' ? m.jumps : m.km) - m.goal); }
/* Credita incrementalmente o bônus de Overdrive e o buff Overachiever. Retorna true se algo foi pago. */
function payOverdrive(m) {
  overInit(m);
  const o = OVD[m.type], cur = m.type === 'rope' ? m.jumps : m.km; let paid = false;
  // Unidades inteiras de excedente (km/saltos acima da meta); m.overPaid persiste no save, então reabrir o modal nunca repaga nem perde bônus
  const units = Math.max(0, Math.floor(overAmount(m) / o.unit + 1e-6)), add = units - m.overPaid;
  if (add > 0) {
    const b = skBonus(o.sk), g = r2(add * o.gold * b), x = r2(add * o.xp * b);
    m.overPaid = units; m.overGold = r2(m.overGold + g); m.overXp = r2(m.overXp + x);
    gain(g, x); paid = true;
  }
  if (!m.overBuffGiven && cur >= 1.25 * m.goal) {
    m.overBuffGiven = true; S.debuff = false;
    const before = S.hp; S.hp = Math.min(maxHp(), S.hp + Math.max(5, Math.round(maxHp() * 0.05)));
    pendingFx.push('heal'); sfx.coin(); vib([80, 40, 80]);
    toast('🚀 OVERACHIEVER! +25% além da meta: debuffs removidos' + (S.hp > before ? ' e +' + (S.hp - before) + ' ❤️ HP' : '') + '!');
    paid = true;
  }
  if (paid) commit();
  return paid;
}
const overPanelHtml = '<div id="ovb" hidden style="background:linear-gradient(90deg,#ff7a00,#ff1f6b);border-radius:12px;padding:10px;margin:8px 0;font-weight:800;box-shadow:0 0 14px #ff7a0099">🎉 META BATIDA! Continue treinando para ganhar BÔNUS DE OVERDRIVE!<div id="ovp" style="margin-top:6px;font-weight:700"></div></div>';
function overDraw(q, m, reached) {
  const b = q('#ovb'); if (!b) return;
  b.hidden = !reached;
  if (reached) {
    const ex = overAmount(m), t = m.type === 'rope' ? '+' + Math.floor(ex) + ' saltos' : '+' + ex.toFixed(2) + ' km';
    q('#ovp').textContent = `⚡ OVERDRIVE ${t} • Bônus: +${fnum(r2(m.overGold || 0))} 💰 +${fnum(r2(m.overXp || 0))} XP`;
  }
}

/* ---------- Modal Cardio GPS (Caminhada / Pedal) ---------- */
function openCardio() {
  const m = S.day.m2, bike = m.type === 'bike', vmax = bike ? 45 : 18;
  overInit(m); m.segStart = null;   // resto de sessão anterior não é creditado automaticamente
  let run = false, wid = null, last = null, tm = false, iv = null, lastStep = 0, msg = '', n = 0;
  activeTrainingModal = true;
  /* Tempo real por diferença de timestamps: m.sec = baseSec + (agora - segStart) */
  const syncTime = () => {
    if (!run || !m.segStart) return;
    const ns = (m.baseSec || 0) + (Date.now() - m.segStart) / 1000, dt = Math.max(0, ns - m.sec);
    m.sec = ns; if (!bike) S.walkSec += dt; if (tm) m.tmSec += dt;
  };
  const pauseRun = () => {
    syncTime(); run = false; m.segStart = null; stopWatch(); clearInterval(iv);
    window.removeEventListener('devicemotion', motion);
    wakeLock.release(); keepAlive.stop(); save();
  };
  const stop = () => {
    if (run) pauseRun(); else { stopWatch(); clearInterval(iv); window.removeEventListener('devicemotion', motion); wakeLock.release(); keepAlive.stop(); save(); }
    document.removeEventListener('visibilitychange', vis); activeTrainingModal = false;
  };
  const M = modal(`${WL_BADGE}<h2>${bike ? '🚲 Pedal GPS' : '🥾 Caminhada GPS'}</h2>
    <div class="stat3"><div><small>Tempo</small><b id="ct">00:00</b></div><div><small>Distância</small><b id="cd"></b></div><div><small>Ritmo</small><b id="cp">--</b></div></div>
    <div class="pbar red"><i id="cb"></i><span id="cl"></span></div>${overPanelHtml}<div class="warn" id="cm"></div>
    <button class="btn primary big" data-a="go">▶️ INICIAR</button>
    ${bike ? '' : `<label class="sw"><input type="checkbox" id="tmc" data-a="tm"> 🏃 Modo Esteira / Interno</label><button class="btn big" data-a="step" id="stp" hidden>👣 Registrar passo (ritmo humano)</button><div class="muted" id="tmh" hidden>Acelerômetro conta os passos. Há tempo mínimo obrigatório (4m30s/km).</div>`}
    <button class="btn big" data-a="exit" id="cx" style="margin-top:10px"></button>`,
    { beforeClose: () => { if (run) pauseRun(); save(); }, onClose: () => { stop(); commit(); } });
  const q = s => M.body.querySelector(s);
  const tmOk = () => m.tmSec >= (m.tmKm || 0) * 270;
  const reached = () => m.km >= m.goal && tmOk();
  const draw = () => {
    q('#ct').textContent = mmss(m.sec); q('#cd').textContent = m.km.toFixed(2) + ' km';
    q('#cp').textContent = m.km > 0.02 ? (() => { const p = m.sec / 60 / m.km; return Math.floor(p) + ':' + pad(Math.round((p % 1) * 60) % 60) + '/km'; })() : '--';
    q('#cb').style.width = Math.min(100, m.km / m.goal * 100) + '%';
    q('#cl').textContent = `${m.km.toFixed(2)} / ${m.goal} km` + (m.km >= m.goal ? ` (${Math.round(m.km / m.goal * 100)}%)` : '');
    q('#cm').textContent = msg;
    const go = q('[data-a=go]'); go.textContent = run ? '⏸️ PAUSAR' : (m.sec > 0 ? '▶️ RETOMAR' : '▶️ INICIAR');
    const rc = reached(), cx = q('#cx');
    cx.textContent = rc ? '🏁 FINALIZAR TREINO E SAIR' : '⏹️ PAUSAR E SAIR'; cx.classList.toggle('gold', rc);
    overDraw(q, m, rc);
    if (run) keepAlive.meta(`${m.km.toFixed(2)} km • ${mmss(m.sec)}`);
    wakeLock.badge();
  };
  const check = () => {
    if (m.km >= m.goal) {
      if (tmOk()) {
        if (!S.day.done2) completeM2();       // recompensa base + som de vitória; NÃO para o treino
        payOverdrive(m);
        return false;
      }
      msg = '⏳ Tempo mínimo da esteira ainda não atingido.';
    }
    return false;
  };
  const addKm = d => {
    m.km += d; S.tot.km += d; if (!bike) S.walkKm += d;
    if (!S.bike && (S.walkKm >= 5 || S.walkSec >= 3600)) { S.bike = true; toast('🚲 Bicicleta desbloqueada!'); }
    timeEvents(); check(); draw();
  };
  const startWatch = () => {
    if (!navigator.geolocation) { msg = '❌ GPS indisponível neste dispositivo. Use o Modo Esteira.'; draw(); return; }
    last = null;
    wid = navigator.geolocation.watchPosition(p => {
      if (!run || tm) return;
      const { latitude: la, longitude: lo, accuracy } = p.coords, t = p.timestamp || Date.now();
      /* Retomada após tela bloqueada (lacuna > 15 s): tolera accuracy até 65 m */
      const resumed = last && (t - last.t) / 1000 > 15;
      if (accuracy > (resumed ? 65 : 40)) { msg = '📡 Sinal de GPS fraco...'; draw(); return; }
      if (!last) { last = { la, lo, t }; msg = ''; draw(); return; }
      const d = haversine(last, { la, lo }), dt = (t - last.t) / 1000;
      if (d < 0.003) return;                       // ruído parado < 3 m
      const v = dt > 0 ? d / dt * 3600 : 0; last = { la, lo, t };
      if (v > vmax) { msg = `🚫 Velocidade de veículo (${v.toFixed(0)} km/h): distância ignorada.`; sfx.warn(); draw(); return; }
      msg = ''; addKm(d);                          // v <= vmax: aceita o deslocamento acumulado mesmo após lacuna
    }, e => { msg = '❌ GPS: ' + e.message; draw(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 });
  };
  function stopWatch() { if (wid !== null) navigator.geolocation.clearWatch(wid); wid = null; }
  const step = () => { m.tmKm = (m.tmKm || 0) + 0.00075; addKm(0.00075); };
  function motion(e) {
    if (!run || !tm) return; const g = e.accelerationIncludingGravity; if (!g) return;
    const mag = Math.hypot(g.x || 0, g.y || 0, g.z || 0), now = Date.now();
    if (mag > 12 && now - lastStep > 350) { lastStep = now; step(); }
  }
  const tickTime = () => { if (run) { syncTime(); if (++n % 5 === 0) save(); check(); draw(); } };
  function vis() { if (!document.hidden) tickTime(); }       // recompõe o tempo exato ao voltar
  document.addEventListener('visibilitychange', vis);
  M.body.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]'); if (!a) return; ac();
    if (a.dataset.a === 'go') {
      if (run) pauseRun(); else {
        run = true; msg = ''; m.baseSec = m.sec; m.segStart = Date.now();
        wakeLock.acquire(); keepAlive.start();
        if (tm) { await motionPerm(); window.addEventListener('devicemotion', motion); } else startWatch();
        clearInterval(iv); iv = setInterval(tickTime, 1000);
      }
      draw();
    } else if (a.dataset.a === 'exit') {
      if (run) pauseRun(); M.close();
    } else if (a.dataset.a === 'tm') {
      syncTime(); if (run) { m.baseSec = m.sec; m.segStart = Date.now(); }
      tm = a.checked; q('#stp').hidden = !tm; q('#tmh').hidden = !tm;
      if (tm) { stopWatch(); if (run) { await motionPerm(); window.addEventListener('devicemotion', motion); } }
      else { window.removeEventListener('devicemotion', motion); if (run) startWatch(); }
    } else if (a.dataset.a === 'step') {
      const now = Date.now(); if (run && now - lastStep > 350) { lastStep = now; step(); } else if (!run) { msg = 'Inicie o treino primeiro.'; draw(); }
    }
  });
  draw();
}

/* ---------- Modal Pular Corda ---------- */
function openRope() {
  const m = S.day.m2; overInit(m); let run = false, lastJ = 0, sensor = false;
  activeTrainingModal = true; wakeLock.acquire();
  const stop = () => { window.removeEventListener('devicemotion', motion); run = false; keepAlive.stop(); wakeLock.release(); activeTrainingModal = false; save(); };
  const M = modal(`${WL_BADGE}<h2>🦘 Pular Corda</h2><div class="clock" id="rj"></div><div class="pbar red"><i id="rb"></i><span id="rl"></span></div>${overPanelHtml}
    <div class="warn" id="rm"></div><button class="btn primary big" data-a="go">▶️ ATIVAR SENSOR (acelerômetro no bolso)</button>
    <button class="touchbtn" style="width:170px;height:170px" data-a="jump">🦘<b>SALTEI</b></button><div class="muted">Sem sensor? Toque a cada salto (trava humana de 350 ms).</div>
    <button class="btn big" data-a="exit" id="rx" style="margin-top:10px"></button>`,
    { beforeClose: () => save(), onClose: () => { stop(); commit(); } });
  const q = s => M.body.querySelector(s);
  const draw = () => {
    q('#rj').textContent = Math.floor(m.jumps) + ' saltos'; q('#rb').style.width = Math.min(100, m.jumps / m.goal * 100) + '%';
    q('#rl').textContent = Math.floor(m.jumps) + ' / ' + m.goal + (m.jumps >= m.goal ? ` (${Math.round(m.jumps / m.goal * 100)}%)` : '');
    const rc = m.jumps >= m.goal, rx = q('#rx');
    rx.textContent = rc ? '🏁 FINALIZAR TREINO E SAIR' : '⏹️ PAUSAR E SAIR'; rx.classList.toggle('gold', rc);
    overDraw(q, m, rc);
    if (run) keepAlive.meta(`${Math.floor(m.jumps)} saltos`);
    wakeLock.badge();
  };
  const jump = () => {
    m.jumps++; S.tot.jumps++; timeEvents(); sfx.click(); if (m.jumps % 10 === 0) save();
    if (m.jumps >= m.goal) { if (!S.day.done2) completeM2(); payOverdrive(m); }   // não fecha: segue em Overdrive
    draw();
  };
  const motion = e => {
    if (!run) return; const g = e.accelerationIncludingGravity; if (!g) return;
    const mag = Math.hypot(g.x || 0, g.y || 0, g.z || 0), n = Date.now();
    if (Math.abs(mag - 9.81) > 7 && n - lastJ > 350) { lastJ = n; sensor = true; jump(); }
  };
  M.body.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]'); if (!a) return; ac();
    if (a.dataset.a === 'go') {
      if (run) {      // alterna: pausa o sensor
        run = false; window.removeEventListener('devicemotion', motion); keepAlive.stop();
        a.textContent = '▶️ ATIVAR SENSOR (acelerômetro no bolso)'; q('#rm').textContent = '⏸️ Sensor pausado.'; return;
      }
      const ok = await motionPerm(); if (M.closed) return; run = ok;
      if (ok) { window.addEventListener('devicemotion', motion); keepAlive.start(); q('#rm').textContent = '✅ Sensor ativo — guarde o celular no bolso e pule!'; a.textContent = '⏸️ PAUSAR SENSOR'; }
      else q('#rm').textContent = '❌ Sensor indisponível. Use o botão de ritmo.';
    } else if (a.dataset.a === 'jump') {
      const n = Date.now(); if (n - lastJ < 350) { sfx.warn(); q('#rm').textContent = '⚠️ Rápido demais para ser humano!'; return; }
      lastJ = n; q('#rm').textContent = ''; jump();
    } else if (a.dataset.a === 'exit') M.close();
  });
  draw();
}

/* ---------- Pesagem + OCR ---------- */
function loadTess() {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res();
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = res; s.onerror = () => rej(new Error('offline')); document.head.appendChild(s);
  });
}
function parseWeight(text) {
  const t = text.replace(/,/g, '.').replace(/[^\d.\s]/g, ' ');
  let m = t.match(/\b(\d{2,3})\.(\d)\b/), v = null;
  if (m) v = parseFloat(m[1] + '.' + m[2]);
  else if ((m = t.match(/\b(\d{3,4})\b/))) v = parseInt(m[1], 10) / 10;
  else if ((m = t.match(/\b(\d{2,3})\b/))) v = parseFloat(m[1]);
  return v && v >= 30 && v <= 300 ? v : null;
}
function openWeigh() {
  let img = null;
  const bossHp = r1(Math.max(0, S.hero.weight - S.hero.goal));
  const pct = Math.floor(weightPct());
  const M = modal(`<h2>⚔️ RAID BOSS: O GUARDIÃO DA BALANÇA</h2>
    <div style="font-size:3.2rem;margin:4px 0">⚖️👹</div>
    <div class="muted">O Boss se alimenta dos quilos extras. Fotografe o visor da sua balança real: o OCR lerá os dígitos para desferir um golpe crítico!</div>
    <div class="stat3" style="margin:12px 0">
      <div><small>Peso Atual</small><b>${r1(S.hero.weight)} kg</b></div>
      <div><small>HP do Boss</small><b style="color:#c084fc">${bossHp} kg</b></div>
      <div><small>Progresso</small><b style="color:var(--cy)">${pct}%</b></div>
    </div>
    <p class="muted">Tire uma foto nítida do visor da balança. O OCR lê os dígitos automaticamente.</p>
    <input type="file" id="wf" accept="image/*" capture="environment"><img class="prev" id="wp" hidden>
    <div class="muted" id="ws"></div>
    <label class="sw">Dígitos confirmados (kg): <input type="number" id="wk" step="0.1" min="30" max="300" style="width:120px"></label>
    <button class="btn primary big" id="wok" disabled>💥 DESFERIR GOLPE (CONFIRMAR PESO)</button>`, { cls: 'boss-modal' });
  const q = s => M.body.querySelector(s), chk = () => { q('#wok').disabled = !(img && parseFloat(q('#wk').value) >= 30); };
  q('#wk').oninput = chk;
  q('#wf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = async () => {
      img = im; q('#wp').src = url; q('#wp').hidden = false; chk();
      q('#ws').textContent = '🔎 Lendo visor da balança com OCR...';
      try {
        await loadTess();
        const r = await Tesseract.recognize(url, 'eng', { tessedit_char_whitelist: '0123456789.,' });
        const w = parseWeight(r.data.text || '');
        if (w) { q('#wk').value = w.toFixed(1); q('#ws').textContent = '✅ Peso lido: ' + w.toFixed(1) + ' kg — confira os dígitos e golpeie!'; }
        else q('#ws').textContent = '⚠️ Não consegui ler automaticamente. Digite o valor que está no visor.';
      } catch (err) { q('#ws').textContent = '⚠️ OCR offline. Digite o valor do visor manualmente.'; }
      URL.revokeObjectURL(url);      // libera o blob da foto (imagem já decodificada)
      chk();
    };
    im.onerror = () => { URL.revokeObjectURL(url); q('#ws').textContent = '⚠️ Não foi possível abrir a imagem.'; };
    im.src = url;
  };
  q('#wok').onclick = () => {
    const kg = r1(parseFloat(q('#wk').value)); if (!img || !(kg >= 30 && kg <= 300)) return;
    const c = document.createElement('canvas'), w = 360, h = Math.round(img.naturalHeight * w / img.naturalWidth);
    c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    x.fillStyle = '#000b'; x.fillRect(0, h - 26, w, 26); x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif';
    x.fillText('FitRPG • ' + new Date().toLocaleString('pt-BR') + ' • ' + kg + ' kg', 8, h - 8);
    const photo = c.toDataURL('image/jpeg', 0.55);
    M.close(); applyWeigh(kg, photo);
  };
}

/* ===================== Início / Onboarding ===================== */
function buildOnboard() {
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#obLevels').innerHTML = [1, 2, 3, 4, 5].map(n => `<label class="opt"><input type="radio" name="lv" value="${n}" ${n === 1 ? 'checked' : ''}><div><b>Nível ${n}: ${COND[n].n}</b><small>${COND[n].d} • Meta base de Cardio: ${COND[n].km.toFixed(1)} km</small></div></label>`).join('');
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#obForm').onsubmit = e => {
    e.preventDefault();
    const w = r1(parseFloat($('#obWeight').value)), g = r1(parseFloat($('#obGoal').value));
    if (!(g < w)) { $('#obErr').textContent = 'A meta ideal precisa ser menor que o peso atual.'; return; }
    const h = { name: $('#obName').value.trim() || 'Herói', weight: w, startWeight: w, goal: g, level: +document.querySelector('input[name=lv]:checked').value, cls: document.querySelector('input[name=cls]:checked').value, rollover: $('#obRoll').value || '00:00' };
    S = freshState(h); S.nextWeigh = daysToKey(keyToDays(gameKey()) + rnd(7, 14)); rollover(); save(); ac(); startGame();
  };
}
let started = false;
function startGame() {
  h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#onboard').hidden = true; $('#game').hidden = false;
  if (!started) {
    started = true; fxInit(); idleStart();
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
      document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab-' + b.dataset.tab); sfx.click();
    });
    h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#tab-missions').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; ac();
      const a = b.dataset.act;
      if (a === 'water') addWater(+b.dataset.ml);
      else if (a === 'ex') openExercise(+b.dataset.i);
      else if (a === 'cardio') (S.day.m2.type === 'rope' ? openRope : openCardio)();
      else if (a === 'rest') activateRest();
      else if (a === 'weigh') openWeigh();
    });
    h += `<div class="sec">💾 BACKUP & DADOS</div>
    <div class="card" style="flex-direction:column;align-items:stretch">
      <b>Backup do Progresso</b>
      <small class="muted" style="margin-bottom:8px">Exporte seu progresso para não perder seu herói ou transfira para outro celular/link.</small>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn gold" data-act="export">📤 EXPORTAR</button>
        <button class="btn" data-act="import">📥 IMPORTAR</button>
      </div>
    </div>`;
  $('#tab-shop').innerHTML = h;'#tab-shop').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; ac();
      if (b.dataset.act === 'skill') buySkill(b.dataset.id);
      else if (b.dataset.act === 'buy') buyItem(b.dataset.id);
      else if (b.dataset.act === 'usepotion') usePotion();
      else if (b.dataset.act === 'export') openExportModal();
      else if (b.dataset.act === 'import') openImportModal();
    });
    const bb = $('#bossBar');
    if (bb) bb.onclick = () => { ac(); openWeigh(); };
    const tickDay = () => { if (activeTrainingModal) return; const k = S.day.key; rollover(); if (S.day.key !== k) { commit(); toast('🌅 Novo dia, novas missões!'); } };
    setInterval(tickDay, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tickDay(); });
  }
  const k = S.day.key; rollover();
  commit();
  if (S.day.key !== k) toast('🌅 Novo dia, novas missões!');
  if (weighDue() && !S.dead) setTimeout(() => { toast('⚖️ Pesagem Surpresa convocada!'); openWeigh(); }, 900);
}
/* ===================== Suporte a Instalação PWA ===================== */
let deferredPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isStandalone) {
    const banner = $('#pwaBanner');
    if (banner) banner.hidden = false;
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const banner = $('#pwaBanner');
  if (banner) banner.hidden = true;
  toast('🎉 FitRPG instalado com sucesso!');
});

function initPwaInstall() {
  const btn = $('#pwaInstallBtn');
  if (btn) {
    btn.onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          const banner = $('#pwaBanner');
          if (banner) banner.hidden = true;
        }
        deferredPrompt = null;
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          modal(`<h2>📲 Como Instalar no iPhone</h2>
            <p>1. Toque no botão de <b>Compartilhar</b> (ícone de quadrado com seta para cima <span style="font-size:1.3rem">⎋</span> no Safari).</p>
            <p>2. Role a lista e toque em <b>"Adicionar à Tela de Início"</b> ➕.</p>
            <p>3. Toque em <b>"Adicionar"</b>.</p>
            <p class="muted">O FitRPG abrirá direto como aplicativo!</p>`, { cls: 'trophy' });
        } else {
          modal(`<h2>📲 Instalar no Celular</h2>
            <p>Toque nos <b>3 pontinhos</b> (⋮) no topo do Chrome/Navegador e selecione:</p>
            <p style="font-size:1.15rem;font-weight:bold;color:var(--cy)">📲 "Instalar aplicativo" ou "Adicionar à tela inicial"</p>
            <p class="muted">Ele será instalado diretamente no sistema, sem APK e sem navegador!</p>`, { cls: 'trophy' });
        }
      }
    };
  }
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isStandalone && isMobile) {
    const banner = $('#pwaBanner');
    if (banner) banner.hidden = false;
  }
}

(function boot() {
  initPwaInstall();
  S = load();
  if (S) { startGame(); } else { $('#onboard').hidden = false; buildOnboard(); }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();

/* ---------- Modais de Backup (Exportar / Importar) ---------- */
function openExportModal() {
  const json = JSON.stringify(S);
  const M = modal(`<h2>📤 Exportar Progresso</h2>
    <p class="muted">Copie o código abaixo ou baixe o arquivo para transferir seu jogo!</p>
    <textarea id="expTxt" readonly style="width:100%;height:130px;background:#050b24;color:var(--cy);border:1px solid #1f3a8a;border-radius:8px;padding:8px;font-family:monospace;font-size:.75rem;word-break:break-all"></textarea>
    <div style="display:grid;gap:8px;margin-top:10px">
      <button class="btn gold" id="btnCopy">📋 COPIAR CÓDIGO</button>
      <button class="btn primary" id="btnDownload">💾 BAIXAR ARQUIVO (.fitrpg)</button>
    </div>
    <div style="margin-top:14px;padding:10px;background:#07123a;border-radius:10px;border:1px solid #1d4fd8;text-align:left">
      <b style="color:var(--cy);font-size:.85rem">💡 Quer resgatar de um link antigo?</b>
      <p style="font-size:.75rem;color:var(--mu);margin:4px 0">No app antigo, toque 5 vezes seguidas no título do seu herói no topo para copiar o código automaticamente!</p>
    </div>`, { cls: 'trophy' });
  const json = JSON.stringify(S);
  const M = modal(`<h2>📤 Exportar Progresso</h2>
    <p class="muted">Copie o código abaixo ou baixe o arquivo para restaurar seu jogo em qualquer lugar!</p>
    <textarea id="expTxt" readonly style="width:100%;height:140px;background:#050b24;color:var(--cy);border:1px solid #1f3a8a;border-radius:8px;padding:8px;font-family:monospace;font-size:.75rem;word-break:break-all"></textarea>
    <div style="display:grid;gap:8px;margin-top:10px">
      <button class="btn gold" id="btnCopy">📋 COPIAR CÓDIGO</button>
      <button class="btn primary" id="btnDownload">💾 BAIXAR ARQUIVO (.fitrpg)</button>
    </div>`, { cls: 'trophy' });
  const ta = M.body.querySelector('#expTxt');
  ta.value = json;
  M.body.querySelector('#btnCopy').onclick = () => {
    ta.select();
    navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(json).then(() => toast('✅ Código de backup copiado!')) : toast('Selecione e copie o texto');
  };
  M.body.querySelector('#btnDownload').onclick = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitrpg_backup_${S.hero ? S.hero.name : 'heroi'}.fitrpg`;
    a.click();
    URL.revokeObjectURL(url);
    toast('💾 Arquivo de backup baixado!');
  };
}

function openImportModal() {
  const M = modal(`<h2>📥 Importar Progresso</h2>
    <p class="muted">Cole o código do seu progresso antigo ou envie o arquivo para restaurar seu herói!</p>
    <textarea id="impTxt" placeholder="Cole o código do backup aqui..." style="width:100%;height:110px;background:#050b24;color:#fff;border:1px solid #1f3a8a;border-radius:8px;padding:8px;font-family:monospace;font-size:.75rem"></textarea>
    <input type="file" id="impFile" accept=".json,.fitrpg,text/plain" style="margin:8px 0">
    <button class="btn gold big" id="btnApply" style="margin-top:8px">⚡ RESTAURAR HERÓI</button>`);
  
  const ta = M.body.querySelector('#impTxt');
  const fileInput = M.body.querySelector('#impFile');
  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { ta.value = ev.target.result; };
    reader.readAsText(file);
  };

  M.body.querySelector('#btnApply').onclick = () => {
    try {
      const parsed = JSON.parse(ta.value.trim());
      if (!parsed || !parsed.hero) throw new Error('Formato inválido');
      S = migrateState(parsed);
      save();
      M.close();
      toast('🎉 Progresso restaurado com sucesso!');
      sfx.levelUp();
      render();
    } catch (err) {
      toast('⚠️ Código de backup inválido ou corrompido!');
    }
  };
}