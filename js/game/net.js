// Match traffic in a shared room. Each player publishes their own state as presence; the host's
// presence also carries the waiting room. Reading it back is netIn, publishing is netOut.
import { ZEROES, WALL, STATES, EVENT_KINDS, zeroLines } from '../data.js';
import { TAU, rand, clamp, num, r1, r2, normAng, esc, cleanName, cleanTitle } from '../util.js';
import { W, H, SPAWN } from '../layout.js';
import { acct, zeroRGB } from '../account.js';
import { MP, peerLabel } from '../multiplayer.js';
import { G } from './state.js';
import { feed, mkBubble } from './feedback.js';
import { npcBase } from './npc.js';
import { handleAction } from './host.js';
import { processEvent } from './events.js';
import { endMatch } from './end.js';

function upsertOther(id, pr){
  let o = G.others.get(id);
  const x = clamp(num(pr.x, SPAWN.x), 0, W), y = clamp(num(pr.y, SPAWN.y), 0, H);
  if (!o) {
    o = {id, x, y, rx:x, ry:y, face:num(pr.f), rf:num(pr.f), step:0, bubble:null, pg:0, lpc:2, bcd:0, sc:0,
      sayQ:Array.isArray(pr.sy) ? num(pr.sy[0]) : 0, tossQ:Array.isArray(pr.tz) ? num(pr.tz[0]) : 0, missingSince:0};
    G.others.set(id, o);
    if (G.t > 1) feed(`<b>${esc(peerLabel(pr))}</b> arrived.`, '');
  }
  o.gone = false; o.done = false; o.missingSince = 0;
  o.nick = cleanName(pr.nick); o.nm = cleanName(pr.nm); o.z = ZEROES[pr.z] ? pr.z : 'accountant'; o.fd = clamp(num(pr.fd), 0, 1);
  o.rgb = zeroRGB(ZEROES[o.z], o.fd).join(','); o.outline = o.fd >= 1;
  o.x = x; o.y = y; o.face = num(pr.f, o.face); o.mv = !!pr.mv; o.bl = !!pr.bl; o.si = !!pr.si; o.sc = Math.max(0, num(pr.sc));
  o.acts = Array.isArray(pr.a) ? pr.a : [];
  if (Array.isArray(pr.sy) && num(pr.sy[0]) > o.sayQ) { o.sayQ = num(pr.sy[0]); const L = zeroLines(o.z); o.bubble = mkBubble(L[Math.abs(num(pr.sy[1]) | 0) % L.length]); }
  if (Array.isArray(pr.tz) && num(pr.tz[0]) > o.tossQ) {
    o.tossQ = num(pr.tz[0]);
    const sx = clamp(num(pr.tz[1]), 0, W), sy = clamp(num(pr.tz[2]), 0, H), tx = clamp(num(pr.tz[3]), WALL, W - WALL), ty = clamp(num(pr.tz[4]), WALL, H - WALL);
    G.flying.push({sx, sy, tx, ty, t:0, dur:0.42 + Math.hypot(tx - sx, ty - sy) / 700, r:rand(0, TAU), remote:true});
  }
}
export function applyHostState(hp, initial){
  const w = G.world;
  w.left = num(hp.left, w.left); w.exc = clamp(num(hp.ex, w.exc), 0, 100); w.ph = hp.ph; w.why = typeof hp.why === 'string' ? hp.why : '';
  w.served = Math.max(0, num(hp.sv) | 0);
  const e = hp.ev;
  if (Array.isArray(e) && EVENT_KINDS.includes(e[0])) {
    const prev = w.evt;
    w.evt = {k:e[0], t:num(e[1]), dur:num(e[2], 6)};
    if (e[0] === 'call') { w.evt.no = num(e[3]) | 0; w.evt.target = typeof e[4] === 'string' ? e[4] : ''; }
    if (e[0] === 'phone') { w.evt.x = clamp(num(e[3]), 0, W); w.evt.y = clamp(num(e[4]), 0, H); }
    if (e[0] === 'kid') {
      Object.assign(w.evt, {x:clamp(num(e[3]), 0, W), y:clamp(num(e[4]), 0, H), face:num(e[5]), chase:e[6] ? 1 : 0});
      if (prev && prev.k === 'kid') Object.assign(w.evt, {rx:prev.rx, ry:prev.ry, rf:prev.rf, step:prev.step});
    }
  } else w.evt = null;
  if (Array.isArray(hp.pt) && hp.pt.length >= 5) { w.point = {x:num(hp.pt[0]), y:num(hp.pt[1]), w:num(hp.pt[2], 170), h:num(hp.pt[3], 120)}; w.pointT = num(hp.pt[4]); }
  else w.point = null;
  if (Array.isArray(hp.n)) hp.n.forEach((a, i) => {
    if (!Array.isArray(a) || i > 12) return;
    let n = w.npcs[i];
    if (!n) { const x = clamp(num(a[0]), 0, W), y = clamp(num(a[1]), 0, H); n = w.npcs[i] = npcBase(i, w.cast[i] || {name:'Someone', title:'', zid:''}, x, y, num(a[2])); }
    n.x = clamp(num(a[0], n.x), 0, W); n.y = clamp(num(a[1], n.y), 0, H); n.face = num(a[2], n.face);
    n.state = STATES[a[3]] || 'wait'; n.score = Math.max(0, num(a[4])); n.cool = a[5] ? 1 : 0; n.tgt = typeof a[6] === 'string' ? a[6] : null; n.fluster = a[7] ? 1 : 0; n.bl = a[8] ? 1 : 0; n.seated = !!a[9];
  });
  if (Array.isArray(hp.e)) {
    if (initial) G.lastEvQ = Math.max(0, ...hp.e.map(e => Array.isArray(e) ? num(e[0]) : 0));
    else for (const ev of hp.e) { const q = Array.isArray(ev) ? num(ev[0]) : 0; if (q > G.lastEvQ) { G.lastEvQ = q; processEvent(ev); if (G.over) return; } }
  }
  if (!initial && hp.ph === 'end') endMatch(w.why || 'time');
}
export function netIn(now){
  const w = G.world, peers = MP.named.peers(), present = new Set();
  for (const p of peers) {
    if (p.sameTab || p.kind !== 'viewer') continue;
    const pr = p.presence; if (!pr || pr.v !== 1 || pr.mid !== w.mid) continue;
    if (pr.st === 'play') { present.add(p.peer); upsertOther(p.peer, pr); }
    else if (pr.st === 'end') { const o = G.others.get(p.peer); if (o) { o.sc = Math.max(0, num(pr.sc, o.sc)); o.done = true; } }
  }
  for (const [id, o] of G.others) {
    if (present.has(id) || o.done) continue;
    if (!o.missingSince) o.missingSince = now;
    if (now - o.missingSince > 3000) o.gone = true;
  }
  if (G.mode === 'host') {
    for (const [id, o] of G.others) {
      if (o.gone || o.done || !Array.isArray(o.acts)) continue;
      for (const a of o.acts) { if (!Array.isArray(a)) continue; const q = num(a[0]); if (q > (G.lastAct[id] || 0)) { G.lastAct[id] = q; handleAction(id, a); } }
    }
  } else {
    const hp = peers.find(p => !p.sameTab && p.presence && p.presence.v === 1 && p.presence.role === 'host' && p.presence.mid === w.mid);
    if (hp) { G.hostMissingSince = 0; applyHostState(hp.presence, false); }
    else { if (!G.hostMissingSince) G.hostMissingSince = now; if (now - G.hostMissingSince > 4000) endMatch('hostleft'); }
  }
}
function eventPresence(e){
  if (!e) return null;
  const head = [e.k, r1(e.t), e.dur];
  if (e.k === 'call') return [...head, e.no, e.target];
  if (e.k === 'phone') return [...head, r1(e.x), r1(e.y)];
  if (e.k === 'kid') return [...head, r1(e.x), r1(e.y), r2(e.face), e.chase > 0 ? 1 : 0];
  return head;
}
function hostPresence(){
  const w = G.world;
  return { ph:w.ph, why:w.why || '', lay:w.lay, seed:w.seed, map:w.map, sv:w.served || 0, ev:eventPresence(w.evt),
    nn:w.cast.map(c => c.name).join(','), nt:w.cast.map(c => c.title).join(','), nz:w.cast.map(c => c.zid).join(','), left:r1(Math.max(0, w.left)), ex:Math.round(w.exc),
    pt:w.point ? [r1(w.point.x), r1(w.point.y), w.point.w, w.point.h, Math.max(0, Math.ceil(w.pointT))] : null,
    n:w.npcs.map(n => [r1(n.x), r1(n.y), r2(normAng(n.face)), STATES.indexOf(n.state), Math.floor(n.score), n.cool > 0 ? 1 : 0, n.tgt || 0, n.fluster > 0 ? 1 : 0, n.bl > 0 ? 1 : 0, n.state === 'wait' && n.seated ? 1 : 0]),
    e:w.events };
}
export function netOut(now, force){
  if (!MP || !G) return;
  if (!force && now - G.lastPub < 66) return;
  G.lastPub = now;
  const me = G.me;
  const pr = { v:1, role:MP.role, nick:MP.nick, nm:acct.name, z:acct.zero, fd:acct.fade, st:G.over ? 'end' : 'play', mid:G.world.mid,
    x:r1(me.x), y:r1(me.y), f:r2(normAng(me.face)), mv:me.moving ? 1 : 0, bl:me.blendT > 0 ? 1 : 0, si:me.seated && !me.rising ? 1 : 0, sc:Math.floor(me.score),
    a:G.acts, sy:[me.sayQ, me.sayIdx], tz:me.lastToss };
  if (MP.role === 'host') Object.assign(pr, hostPresence());
  MP.named.presence(pr).catch(() => {});
}

// Turns the host's presence into the cast list a guest needs to start the same match.
export function castFromHost(hp){
  const nn = String(hp.nn || '').split(','), nt = String(hp.nt || '').split(','), nz = String(hp.nz || '').split(',');
  return nn.slice(0, 10).map((nm, i) => ({name:cleanName(nm) || 'Someone', title:cleanTitle(nt[i]), zid:ZEROES[nz[i]] ? nz[i] : ''}));
}
