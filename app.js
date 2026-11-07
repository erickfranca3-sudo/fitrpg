'use strict';
/* ===================== FITRPG — núcleo, estado e regras ===================== */
const $ = (s, r = document) => r.querySelector(s);
const SAVE_KEY = 'fitrpg_save_v1';
let S = null;
const pad = n => String(n).padStart(2, '0');
const r2 = n => Math.round(n * 100) / 100;
const r1 = n => Math.round(n * 10) / 10;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const fnum = n => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(1));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Tempo / dia de jogo (respeita horário de virada) ---------- */
function gameKey(date = new Date()) {
  const [h, m] = (S ? S.hero.rollover : '00:00').split(':').map(Number);
  const d = new Date(date.getTime() - (h * 60 + m) * 60000);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
const keyToDays = k => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const daysToKey = n => { const d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };

/* ---------- Banco OCULTO dos 22 exercícios (k: g=guiado, i=isometria, t=toque no chão) ---------- */
const EX = {
  1: { n: 'Agachamento Livre', k: 'g' }, 2: { n: 'Agachamento Búlgaro (por perna)', k: 'g' },
  3: { n: 'Agachamento Isométrico na Parede', k: 'i' }, 4: { n: 'Avanço / Passada', k: 'g' },
  5: { n: 'Flexão de Braço Tradicional', k: 't', nl: 1 }, 6: { n: 'Flexão Inclinada', k: 't', nl: 1 },
  7: { n: 'Flexão Fechada / Diamante', k: 't', nl: 1 }, 8: { n: 'Pike Push-up', k: 'g', nl: 1 },
  9: { n: 'Barra Fixa / Puxada Adaptada', k: 'g' }, 10: { n: 'Remada Curvada (mochila/mesa)', k: 'g' },
  11: { n: 'Superman no Solo', k: 'g', nl: 1 }, 12: { n: 'Elevação Lateral de Ombros', k: 'g' },
  13: { n: 'Rosca Direta de Bíceps', k: 'g' }, 14: { n: 'Rosca Martelo', k: 'g' },
  15: { n: 'Tríceps no Banco/Cadeira', k: 'g' }, 16: { n: 'Elevação Pélvica no Solo', k: 'g' },
  17: { n: 'Elevação Pélvica Unilateral', k: 'g' }, 18: { n: 'Stiff Unilateral com Carga', k: 'g' },
  19: { n: 'Good Morning (Bom Dia)', k: 'g' }, 20: { n: 'Abdominal Supra / Prancha', k: 'g', nl: 1 }
  /* 21 Pular Corda e 22 Caminhada/Corrida GPS (+ Pedal) vivem no pool de Cardio */
};
const PLAN = { A: [1, 2, 3, 4, 20], B: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], C: [16, 17, 18, 19, 20] };
const PLAN_NAME = { A: 'Pernas • Foco Anterior', B: 'Superiores Completos', C: 'Posteriores, Glúteos e Core' };
const COND = [null,
  { n: 'Sedentário', km: 1.2, d: 'Início leve' }, { n: 'Iniciante', km: 1.8, d: 'Carga moderada' },
  { n: 'Intermediário', km: 2.5, d: 'Carga padrão' }, { n: 'Avançado', km: 3.5, d: 'Carga intensa' },
  { n: 'Atleta / Elite', km: 5.0, d: 'Carga máxima' }];

function presc(id) {
  const m = S.mast[id] || 1;
  const sets = m <= 3 ? 3 : m <= 7 ? 4 : 5;
  const reps = Math.round(8 + (m - 1) * 17 / 9);          // 8 → 25
  const secs = Math.round(20 + (m - 1) * 70 / 9);         // 20s → 90s
  const load = EX[id].nl ? 0 : (m < 3 ? 0 : m < 5 ? 2 : m < 7 ? 5 : m < 9 ? 10 : 15);
  return { sets, reps, secs, load, rest: 60 + Math.min(30, (m - 1) * 3) };
}

/* ---------- Skills ---------- */
const SK = [
  { id: 'calist', n: 'Mestre da Calistenia', ic: '💪', d: '+0,5% Ouro/XP por nível em missões de Musculação' },
  { id: 'hermes', n: 'Passos de Hermes', ic: '👟', d: '+0,5% Ouro/XP por nível em Caminhada e Pular Corda' },
  { id: 'ciclista', n: 'Espírito Ciclista', ic: '🚲', d: 'Nv.1 libera a Bicicleta. +0,5% Ouro/XP por nível no Pedal GPS' },
  { id: 'agua', n: 'Alquimia da Água', ic: '💧', d: '+0,5% Ouro/XP por nível ao bater a meta de Hidratação' },
  { id: 'titan', n: 'Pele de Titânio', ic: '🛡️', d: '-1 HP de dano por falha e +2 HP máx. por nível' }
];
const skCost = (id, n) => (id === 'ciclista' && n === 1 ? 50 : 25 * n);
const skBonus = id => 1 + 0.005 * S.sk[id];
const maxHp = () => 100 + (S.lvl - 1) * 5 + 2 * S.sk.titan;
const lvlNeed = l => Math.round(100 * Math.pow(l, 1.25));
const RANKS = [[45, 'SS'], [30, 'S'], [20, 'A'], [15, 'B'], [10, 'C'], [5, 'D'], [1, 'E']];
const rankOf = l => RANKS.find(r => l >= r[0])[1];

/* ---------- Peso / Fases / Sprites ---------- */
const SPRITE_PCT = [0, 10, 20, 33, 45, 55, 66, 75, 88, 100];  // 10 imagens do avatar
function weightPct() {
  const { startWeight: a, goal: g, weight: w } = S.hero;
  if (a <= g) return 100;
  return Math.max(0, Math.min(100, ((a - w) / (a - g)) * 100));
}
const spriteIdx = () => { const p = Math.floor(weightPct() + 1e-9); let i = 0; SPRITE_PCT.forEach((t, k) => { if (p >= t) i = k; }); return i; };
function phaseNum() { const p = Math.floor(weightPct() + 1e-9); return p >= 100 ? 4 : p >= 67 ? 3 : p >= 34 ? 2 : 1; }
const PHASE_NAME = ['', 'Iniciante', 'Aventureiro', 'Guerreiro', 'Paladino'];
function auraOf(streak) { return streak >= 30 ? '#facc15' : streak >= 15 ? '#a855f7' : streak >= 7 ? '#00d2ff' : null; }

/* ---------- Estado ---------- */
function freshState(h) {
  return {
    v: 1, created: Date.now(), hero: h, lvl: 1, xp: 0, gold: 0, totalGold: 0, hp: 100, streak: 0, bestStreak: 0, daysDone: 0,
    sk: { calist: 0, hermes: 0, ciclista: 0, agua: 0, titan: 0 }, bike: h.cls === 'cyclist',
    walkKm: 0, walkSec: 0, shield: 0, potions: 0, tickets: [], rest: { used: 0, start: null },
    mast: {}, wIdx: 0, doneW: {}, tot: { push: 0, km: 0, jumps: 0, water: 0, workouts: 0, cardio: 0, ropeDone: 0, shieldUsed: 0, rests: 0 },
    tr: {}, weighIns: [], nextWeigh: null, debuff: false, deaths: 0, dead: false, boughtSkill: false, boughtShield: false,
    ev: { night: false, early: false, low: false, gravity: false }, day: null
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { toast('⚠️ Falha ao salvar (armazenamento cheio)'); } }
function load() { try { const r = localStorage.getItem(SAVE_KEY); return r ? migrateState(JSON.parse(r)) : null; } catch (e) { return null; } }

/* ---------- Fotos da balança: chave separada (últimas 5) para manter o save() leve ---------- */
const PHOTO_KEY = 'fitrpg_photos_v1';
function loadPhotos() { try { return JSON.parse(localStorage.getItem(PHOTO_KEY)) || {}; } catch (e) { return {}; } }
function savePhoto(at, photo) {
  try {
    const p = loadPhotos(); p[at] = photo;
    const keys = Object.keys(p).sort((a, b) => a - b);
    while (keys.length > 5) delete p[keys.shift()];
    localStorage.setItem(PHOTO_KEY, JSON.stringify(p));
  } catch (e) { }
}

/* ---------- Migração segura de saves antigos: nunca deixa NaN/undefined ---------- */
function migrateState(st) {
  if (!st || typeof st !== 'object' || !st.hero) return st;
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const fresh = freshState(st.hero);
  st.lvl = Math.max(1, Math.floor(num(st.lvl, 1)));
  ['xp', 'gold', 'totalGold', 'streak', 'bestStreak', 'daysDone', 'walkKm', 'walkSec', 'shield', 'potions', 'wIdx', 'deaths'].forEach(k => { st[k] = Math.max(0, num(st[k], 0)); });
  st.sk = Object.assign({}, fresh.sk, st.sk || {});
  Object.keys(fresh.sk).forEach(k => { st.sk[k] = Math.min(10, Math.max(0, num(st.sk[k], 0))); });
  st.tot = Object.assign({}, fresh.tot, st.tot || {});
  Object.keys(fresh.tot).forEach(k => { st.tot[k] = Math.max(0, num(st.tot[k], 0)); });
  st.ev = Object.assign({}, fresh.ev, st.ev || {});
  st.rest = Object.assign({ used: 0, start: null }, st.rest || {}); st.rest.used = Math.max(0, num(st.rest.used, 0));
  ['mast', 'doneW', 'tr'].forEach(k => { if (!st[k] || typeof st[k] !== 'object') st[k] = {}; });
  ['tickets', 'weighIns'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
  st.bike = !!st.bike; st.debuff = !!st.debuff; st.dead = !!st.dead;
  st.boughtSkill = !!st.boughtSkill; st.boughtShield = !!st.boughtShield;
  // fotos antigas embutidas no save → chave secundária (últimas 5)
  if (st.weighIns.length > 20) st.weighIns = st.weighIns.slice(-20);
  st.weighIns.forEach(w => { if (w && w.photo) { savePhoto(w.at, w.photo); } if (w) delete w.photo; });
  const mh = 100 + (st.lvl - 1) * 5 + 2 * st.sk.titan;      // mesmo cálculo de maxHp()
  st.hp = Math.min(mh, Math.max(0, num(st.hp, mh)));
  if (st.day && typeof st.day === 'object') {
    const d = st.day;
    d.water = Math.max(0, num(d.water, 0));
    d.waterGoal = Math.max(1, num(d.waterGoal, Math.round(num(st.hero.weight, 70) * 35)));
    d.done1 = !!d.done1; d.done2 = !!d.done2; d.rest = !!d.rest; d.streakGiven = !!d.streakGiven;
    const m = d.m2;
    if (m && typeof m === 'object') {
      if (m.type !== 'muscle') {
        m.km = Math.max(0, num(m.km, 0)); m.sec = Math.max(0, num(m.sec, 0)); m.jumps = Math.max(0, num(m.jumps, 0));
        m.tmKm = Math.max(0, num(m.tmKm, 0)); m.goal = Math.max(0.1, num(m.goal, 1));
      }
      m.tmSec = m.tmSec || 0; m.overPaid = m.overPaid || 0; m.overBuffGiven = !!m.overBuffGiven;
      m.overGold = m.overGold || 0; m.overXp = m.overXp || 0; m.segStart = null;
    } else st.day = null;      // dia corrompido: será regerado no rollover()
  } else st.day = null;
  return st;
}

/* ---------- Geração do dia: SEMPRE 2 missões (água + 1 sorteada) ---------- */
function walkGoal() {
  let km = COND[S.hero.level].km * (1 + 0.04 * Math.min(S.tot.cardio, 25));
  if (S.debuff) km *= 1.15;
  return r1(km);
}
function newDay(key) {
  let m2;
  if (Math.random() < 0.5) {
    const t = ['A', 'B', 'C'][S.wIdx % 3]; S.wIdx++;
    m2 = { type: 'muscle', plan: t, exs: PLAN[t].map(id => { const p = presc(id); return { id, sets: p.sets, reps: p.reps, secs: p.secs, load: p.load, rest: p.rest, done: 0 }; }) };
  } else {
    const type = pick(S.bike ? ['walk', 'rope', 'bike'] : ['walk', 'rope']);
    const g = S.debuff;
    m2 = { type, km: 0, sec: 0, jumps: 0, tmKm: 0, tmSec: 0, overPaid: 0, overBuffGiven: false, gravity: g };
    if (type === 'walk') m2.goal = walkGoal();
    else if (type === 'bike') m2.goal = r1(walkGoal() * 2.5);
    else { let j = 120 + 40 * (S.hero.level - 1) + 8 * Math.min(S.tot.cardio, 25); if (g) j *= 1.15; m2.goal = Math.round(j / 10) * 10; }
  }
  return { key, water: 0, waterGoal: Math.round(S.hero.weight * 35), done1: false, done2: false, rest: false, streakGiven: false, m2 };
}

/* ---------- Virada de dia / penalidades ---------- */
function evalDay(day) {
  if (S.dead) return;
  if (day && (day.rest || (day.done1 && day.done2))) return;
  if (S.shield > 0) { S.shield--; S.tot.shieldUsed++; toast('🛡️ Escudo de Aegis consumido! Ofensiva e HP protegidos.'); return; }
  S.streak = 0;
  const rawDmg = 35 + Math.floor((S.lvl - 1) * 1.2);
  const dmg = Math.max(1, rawDmg - S.sk.titan);
  S.hp = Math.max(0, S.hp - dmg);
  pendingFx.push('hit');
  if (S.hp > 0 && S.hp < 10) S.ev.low = true;
  if (S.hp <= 0) { S.dead = true; S.deaths++; }
}
function rollover() {
  const k = gameKey();
  if (!S.day) { S.day = newDay(k); S.rest.start = k; return; }
  if (S.day.key === k) return;
  const prev = S.day, a = keyToDays(prev.key), b = keyToDays(k);
  if (b < a) { S.day.key = k; return; }          // relógio voltou: não penaliza
  evalDay(prev);
  for (let d = a + 1; d < b && d < a + 60; d++) evalDay(null);
  S.day = newDay(k);
  if (keyToDays(k) - keyToDays(S.rest.start) >= 7) { S.rest.used = 0; S.rest.start = k; }
  if (S.hp > maxHp()) S.hp = maxHp();
}
const pendingFx = [];
let activeTrainingModal = false;   // true enquanto um modal de treino está aberto (bloqueia rollover)

/* ---------- Recompensas ---------- */
function gain(g, x) {
  S.gold = r2(S.gold + g); S.totalGold = r2(S.totalGold + g); S.xp = r2(S.xp + x);
  if (g) floaty('+' + fnum(r2(g)) + ' 💰', '#facc15');
  if (x) { floaty('+' + fnum(r2(x)) + ' XP', '#5be0ff', 28); xpBeam(); }
  let up = false;
  while (S.xp >= lvlNeed(S.lvl)) { S.xp = r2(S.xp - lvlNeed(S.lvl)); S.lvl++; up = true; S.hp = Math.min(maxHp(), S.hp + Math.round(maxHp() * 0.25)); }
  if (up) { sfx.levelUp(); pendingFx.push('levelup'); }
}
function timeEvents() {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) S.ev.night = true;
  if (h >= 4 && h < 6) S.ev.early = true;
}
function addWater(ml) {
  const d = S.day; if (S.dead) return;
  d.water += ml; S.tot.water += ml; sfx.click(); vib(30);
  if (!d.done1 && d.water >= d.waterGoal) completeWater();
  commit();
}
function completeWater() {
  const d = S.day; if (d.done1) return;
  d.done1 = true; const b = skBonus('agua');
  gain(10 * b, 25 * b); sfx.setDone(); pendingFx.push('jump'); toast('💧 Hidratação concluída!');
  dayCheck();
}
function completeM2() {
  const d = S.day, m = d.m2; if (d.done2) return;
  d.done2 = true;
  const sk = m.type === 'muscle' ? 'calist' : m.type === 'bike' ? 'ciclista' : 'hermes';
  const b = skBonus(sk);
  gain(25 * b, 75 * b);
  if (m.type === 'muscle') { S.doneW[m.plan] = true; S.tot.workouts++; }
  else { S.tot.cardio++; if (m.type === 'rope') S.tot.ropeDone++; if (m.gravity) { S.debuff = false; S.ev.gravity = true; toast('🪶 Debuff "Gravidade Aumentada" superado!'); } }
  timeEvents(); sfx.setDone(); pendingFx.push('jump'); vib([100, 50, 100]);
  toast('🎲 Missão de Treino concluída!');
  dayCheck(); commit();
}
function dayCheck() {
  const d = S.day;
  if (d.done1 && d.done2 && !d.streakGiven) {
    d.streakGiven = true; S.streak++; S.daysDone++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    let extra = '';
    if (S.hp < maxHp()) { const h = Math.max(10, Math.round(maxHp() * 0.10)), before = S.hp; S.hp = Math.min(maxHp(), S.hp + h); extra = ' +' + (S.hp - before) + ' ❤️ HP regenerado!'; pendingFx.push('heal'); }
    pendingFx.push('victory');
    toast('🔥 Dia perfeito! Ofensiva: ' + S.streak + ' dias.' + extra);
  }
}
function activateRest() {
  const d = S.day;
  if (S.rest.used >= 2 || d.rest || d.done2) return;
  d.rest = true; S.rest.used++; S.tot.rests++; sfx.click();
  const before = S.hp; S.hp = Math.min(maxHp(), S.hp + Math.round(maxHp() * 0.15));
  if (S.hp > before) pendingFx.push('heal');
  toast('🛌 Dia de descanso ativado. Ofensiva preservada.' + (S.hp > before ? ' +' + (S.hp - before) + ' ❤️ HP (recuperação muscular)' : '')); commit();
}

/* ---------- Loja ---------- */
const IRL = [
  { id: 'game', n: '🎮 Sessão Livre de Game / Cinema sem Culpa', p: 210 },
  { id: 'meal', n: '🍔 Refeição Livre Controlada (1 Refeição)', p: 420 },
  { id: 'pizza', n: '🍕 Noite da Pizza dos Campeões', p: 480 }
];
function buySkill(id) {
  const n = S.sk[id] + 1; if (n > 10) return; const c = skCost(id, n);
  if (S.gold < c) return toast('💰 Ouro insuficiente');
  S.gold = r2(S.gold - c); S.sk[id] = n; S.boughtSkill = true;
  if (id === 'ciclista' && !S.bike) { S.bike = true; toast('🚲 Bicicleta desbloqueada!'); }
  if (id === 'titan') S.hp = Math.min(maxHp(), S.hp + 2);
  sfx.coin(); toast('✨ Skill melhorada para Nv. ' + n); commit();
}
function buyItem(id) {
  if (id === 'potion') { if (S.gold < 80) return toast('💰 Ouro insuficiente'); S.gold = r2(S.gold - 80); S.potions++; }
  else if (id === 'shield') {
    if (S.shield >= 1) return toast('Você já possui um Escudo');
    if (S.gold < 180) return toast('💰 Ouro insuficiente'); S.gold = r2(S.gold - 180); S.shield = 1; S.boughtShield = true;
  } else {
    const it = IRL.find(i => i.id === id); if (S.gold < it.p) return toast('💰 Ouro insuficiente');
    S.gold = r2(S.gold - it.p); const t = { n: it.n, at: Date.now() }; S.tickets.push(t); sfx.trophy(); showTicket(t);
  }
  sfx.coin(); commit();
}
function usePotion() {
  if (S.potions < 1 || S.hp >= maxHp()) return toast(S.potions < 1 ? 'Sem poções' : 'HP já está cheio');
  const heal = Math.max(30, Math.round(maxHp() * 0.35)), before = S.hp;
  S.potions--; S.hp = Math.min(maxHp(), S.hp + heal); pendingFx.push('heal'); sfx.coin(); toast('🧪 +' + (S.hp - before) + ' HP'); commit();
}

/* ---------- 41 Conquistas secretas ---------- */
const kgLost = () => S.hero.startWeight - S.hero.weight;
const TR = [
  { n: 'Primeiro Passo', i: '👣', r: 'bronze', d: 'Completou as 2 missões de um dia.', c: () => S.daysDone >= 1 },
  { n: 'Trinca de Ferro', i: '🔥', r: 'bronze', d: '3 dias de ofensiva.', c: () => S.bestStreak >= 3 },
  { n: 'Semana Sagrada', i: '⚡', r: 'prata', d: '7 dias de ofensiva — a aura elétrica desperta.', c: () => S.bestStreak >= 7 },
  { n: 'Quinzena Sombria', i: '🌑', r: 'ouro', d: '15 dias de ofensiva.', c: () => S.bestStreak >= 15 },
  { n: 'Aura Deus Ouro', i: '👑', r: 'platina', d: '30 dias de ofensiva.', c: () => S.bestStreak >= 30 },
  { n: 'Inabalável', i: '🗿', r: 'mitica', d: '60 dias de ofensiva.', c: () => S.bestStreak >= 60 },
  { n: 'Lenda Centenária', i: '🐉', r: 'mitica', d: '100 dias de ofensiva.', c: () => S.bestStreak >= 100 },
  { n: 'O Primeiro Quilo', i: '🪶', r: 'bronze', d: 'Perdeu 1 kg na balança.', c: () => kgLost() >= 1 },
  { n: 'Cinco a Menos', i: '🎈', r: 'prata', d: 'Perdeu 5 kg.', c: () => kgLost() >= 5 },
  { n: 'Dez a Menos', i: '🦅', r: 'ouro', d: 'Perdeu 10 kg.', c: () => kgLost() >= 10 },
  { n: 'Um Quarto do Caminho', i: '🌓', r: 'prata', d: '25% da meta de peso.', c: () => weightPct() >= 25 },
  { n: 'Metade da Jornada', i: '🌗', r: 'ouro', d: '50% da meta de peso.', c: () => weightPct() >= 50 },
  { n: 'Reta Final', i: '🌔', r: 'platina', d: '75% da meta de peso.', c: () => weightPct() >= 75 },
  { n: 'Paladino Supremo', i: '⚜️', r: 'mitica', d: 'Atingiu 100% da meta de peso.', c: () => weightPct() >= 100 && S.hero.weight <= S.hero.goal },
  { n: 'Toque Inicial', i: '👃', r: 'bronze', d: '50 flexões validadas.', c: () => S.tot.push >= 50 },
  { n: 'Peitoral de Aço', i: '🛡️', r: 'prata', d: '200 flexões validadas.', c: () => S.tot.push >= 200 },
  { n: 'Máquina de Flexões', i: '⚙️', r: 'ouro', d: '500 flexões validadas.', c: () => S.tot.push >= 500 },
  { n: 'Mil Toques', i: '💥', r: 'platina', d: '1000 flexões validadas.', c: () => S.tot.push >= 1000 },
  { n: 'Andarilho', i: '🥾', r: 'bronze', d: '10 km acumulados.', c: () => S.tot.km >= 10 },
  { n: 'Explorador', i: '🧭', r: 'prata', d: '50 km acumulados.', c: () => S.tot.km >= 50 },
  { n: 'Maratonista Fantasma', i: '🏃', r: 'platina', d: '200 km acumulados.', c: () => S.tot.km >= 200 },
  { n: 'Pulinho', i: '🦘', r: 'bronze', d: '500 saltos de corda.', c: () => S.tot.jumps >= 500 },
  { n: 'Canguru', i: '🪘', r: 'prata', d: '2.000 saltos de corda.', c: () => S.tot.jumps >= 2000 },
  { n: 'Rei da Corda', i: '🌀', r: 'ouro', d: '10.000 saltos de corda.', c: () => S.tot.jumps >= 10000 },
  { n: 'Gota a Gota', i: '💧', r: 'bronze', d: '10 litros bebidos.', c: () => S.tot.water >= 10000 },
  { n: 'Riacho', i: '🏞️', r: 'prata', d: '50 litros bebidos.', c: () => S.tot.water >= 50000 },
  { n: 'Rio Caudaloso', i: '🌊', r: 'ouro', d: '100 litros bebidos.', c: () => S.tot.water >= 100000 },
  { n: 'Oceano Interior', i: '🐋', r: 'mitica', d: '500 litros bebidos.', c: () => S.tot.water >= 500000 },
  { n: 'Primeira Melhoria', i: '✨', r: 'bronze', d: 'Comprou o primeiro nível de uma Skill.', c: () => S.boughtSkill },
  { n: 'Mestre Absoluto', i: '🎓', r: 'platina', d: 'Maximizou uma Skill no Nv. 10.', c: () => Object.values(S.sk).some(v => v >= 10) },
  { n: 'Suor Recompensado', i: '🎫', r: 'ouro', d: 'Resgatou uma Recompensa IRL após 2 semanas de jornada.', c: () => S.tickets.length > 0 && Date.now() - S.created >= 14 * 864e5 },
  { n: 'Coruja Noturna', i: '🦉', r: 'prata', d: 'Treinou tarde da noite.', c: () => S.ev.night },
  { n: 'Madrugador', i: '🌅', r: 'prata', d: 'Treinou de madrugada.', c: () => S.ev.early },
  { n: 'À Beira do Abismo', i: '☠️', r: 'ouro', d: 'Sobreviveu com menos de 10 HP.', c: () => S.ev.low },
  { n: 'Fênix', i: '🔥', r: 'prata', d: 'Renasceu após a morte.', c: () => S.deaths >= 1 && !S.dead },
  { n: 'Contra a Gravidade', i: '🪽', r: 'prata', d: 'Venceu o debuff Gravidade Aumentada.', c: () => S.ev.gravity },
  { n: 'Nível 10', i: '🔟', r: 'prata', d: 'Chegou ao nível 10.', c: () => S.lvl >= 10 },
  { n: 'Nível 25', i: '🏰', r: 'platina', d: 'Chegou ao nível 25.', c: () => S.lvl >= 25 },
  { n: 'Cofre do Dragão', i: '💎', r: 'ouro', d: 'Acumulou 1.000 de ouro ao longo da jornada.', c: () => S.totalGold >= 1000 },
  { n: 'Veterano de Guerra', i: '⚔️', r: 'ouro', d: '25 treinos de musculação.', c: () => S.tot.workouts >= 25 },
  { n: 'Tríade Completa', i: '🔱', r: 'prata', d: 'Concluiu os treinos A, B e C.', c: () => S.doneW.A && S.doneW.B && S.doneW.C },
  { n: 'Salvo pelo Escudo', i: '🛡️', r: 'bronze', d: 'Um Escudo de Aegis protegeu sua ofensiva.', c: () => S.tot.shieldUsed >= 1 }
];

let trQueue = [], trOpen = false;
function checkTrophies() {
  let again = true, guard = 0;
  while (again && guard++ < 10) {
    again = false;
    TR.forEach((t, i) => {
      if (!S.tr[i + 1] && t.c()) { S.tr[i + 1] = Date.now(); gain(0, 20); trQueue.push(i + 1); again = true; }
    });
  }
  if (trQueue.length && !trOpen) showNextTrophy();
}

/* ---------- Pesagem ---------- */
function weighDue() { return S.nextWeigh && keyToDays(gameKey()) >= keyToDays(S.nextWeigh); }
function applyWeigh(kg, photo) {
  const old = S.hero.weight, diff = r1(kg - old), before = spriteIdx();
  const at = Date.now();
  S.weighIns.push({ at, kg });
  if (photo) savePhoto(at, photo);
  if (S.weighIns.length > 20) S.weighIns.shift();
  S.hero.weight = kg;
  if (!S.day.done1) { S.day.waterGoal = Math.round(kg * 35); if (S.day.water >= S.day.waterGoal) completeWater(); }
  if (diff < 0) {
    const dmg = r1(-diff);
    gain(30, 50 + Math.round(dmg * 20));
    pendingFx.push('evolve');
    toast(`💥 CRITICAL HIT! -${dmg} kg no Boss Balança! +30 💰 Ouro`);
    sfx.coin();
  } else if (diff > 0.5) {
    S.debuff = true;
    pendingFx.push('hit');
    toast(`🪨 Boss Balança usou PISÃO ESMAGADOR! (+15% de Cardio)`);
  } else {
    toast(`⚖️ Balança confirmada: ${kg} kg. O confronto continua!`);
  }
  S.nextWeigh = daysToKey(keyToDays(gameKey()) + rnd(7, 14));
  if (spriteIdx() !== before) pendingFx.push('evolve');
  commit();
}
function redeem() {
  S.lvl = 1; S.xp = 0; S.gold = 0; S.streak = 0; S.hp = 100;
  Object.keys(S.sk).forEach(k => S.sk[k] = 0);
  S.bike = (S.hero.cls === 'cyclist' || S.walkKm >= 5 || S.walkSec >= 3600);
  S.dead = false; commit();
}
