// Your side of every tick: moving, abilities wearing off, noticing and being noticed, and scoring.
import { WALL, KID_RANGE, MY_RANGE, MY_NOTICE_TIME, COMMON_LINES, zeroLines, rangeOf, seenOf } from '../data.js';
import { rand, clamp, angDiff, esc, isTouch, reduceMotion } from '../util.js';
import { W, H, setDark, pushOut, sees } from '../layout.js';
import { acct } from '../account.js';
import { G, keys, joy, mouse } from './state.js';
import { feed, toast, float, mkBubble } from './feedback.js';
import { errandDone } from './errands.js';
import { act } from './events.js';
import { freeSeatNear, land } from './abilities.js';
import { startStill, endStill } from './potg.js';
import { endMatch } from './end.js';
import { kidEvent, smoothKid } from './kid.js';

export function clientUpdate(dt){
  const p = G.me, z = G.z, w = G.world;
  const myRange = MY_RANGE * (z.gazeMul || 1), myNeed = MY_NOTICE_TIME * (z.noticeMul || 1), warmTime = z.warmTime || 3;
  G.t += dt;
  if (G.mode === 'guest' && w.evt) w.evt.t = Math.max(0, w.evt.t - dt);
  const ev = w.evt, ringing = ev && ev.k === 'phone' ? ev : null, dark = !!(ev && ev.k === 'dark');
  setDark(dark);
  if (G.mode === 'guest') w.left -= dt;
  while (G.hints.length && G.t >= G.hints[0][0]) toast(G.hints.shift()[1]);
  if (!G.warned10 && w.left <= 10) { G.warned10 = true; toast('Leaving soon. Try not to make it a thing.'); }
  if (G.mode === 'guest' && w.left < -4) { endMatch('time'); return; }

  let ix = 0, iy = 0;
  if (!G.paused) {
    if (keys.has('ArrowLeft') || keys.has('KeyA')) ix -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) ix += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) iy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) iy += 1;
    if (joy.active) { ix += joy.x; iy += joy.y; }
  }
  const m = Math.hypot(ix, iy);
  // Sitting: trying to move starts getting up, which takes a second.
  if (p.seated) {
    if (m > 0.18 && !p.rising) { p.rising = 1; p.warm = null; }
    if (p.rising) { p.rising = Math.max(0, p.rising - dt); if (!p.rising) { p.seated = false; float(p.x, p.y - 30, 'up', 'meta'); } }
  }
  const moving = m > 0.18 && !p.seated;
  if (moving) {
    const k = Math.min(1, m) / m, sp = 74 * (z.speedMul || 1);
    p.x += ix * k * sp * dt; p.y += iy * k * sp * dt;
    p.face = Math.atan2(iy, ix); p.step += dt * 9;
  } else if (mouse.in && !isTouch && !G.paused) {
    p.face += angDiff(Math.atan2(mouse.y - p.y, mouse.x - p.x), p.face) * Math.min(1, dt * 10);
  }
  p.x = clamp(p.x, WALL + 12, W - WALL - 12); p.y = clamp(p.y, WALL + 12, H - WALL - 12);
  pushOut(p, 12);
  p.canSit = !p.seated && !!freeSeatNear(p.x, p.y);

  if (moving) { if (!p.moving) endStill(); p.stillT = 0; }
  else { if (p.moving) startStill(); p.stillT += dt; }
  p.moving = moving;

  if (p.warm) {
    if (moving) { p.warm = null; float(p.x, p.y - 30, 'interrupted. nothing still happened', 'meta'); }
    else {
      p.warm.t += dt;
      if (p.warm.t >= warmTime) { p.warm = null; p.score += 15; G.stats.warmups++; float(p.x, p.y - 30, '+15 nothing happened', 'good'); p.bubble = mkBubble('\u2026'); }
    }
  }
  p.pen = Math.max(0, p.pen - 0.5 * (z.penDrainMul || 1) * dt);
  if (p.blendT > 0) p.blendT = Math.max(0, p.blendT - dt);
  if (p.unpT > 0) p.unpT = Math.max(0, p.unpT - dt);
  if (p.unpCd > 0) p.unpCd = Math.max(0, p.unpCd - dt);
  if (p.tossCd > 0) p.tossCd = Math.max(0, p.tossCd - dt);
  if (p.courtesy < (z.courtesyMax || 3)) { p.courtRegen += dt; if (p.courtRegen >= (z.courtesyRegen || 18)) { p.courtesy++; p.courtRegen = 0; } }
  if (p.bubble) { p.bubble.t += dt; if (p.bubble.t > p.bubble.dur) p.bubble = null; }
  p.voiceT -= dt;
  if (p.voiceT <= 0) {
    const L = zeroLines(acct.zero), idx = Math.random() < 0.7 ? (Math.random() * z.lines.length) | 0 : z.lines.length + ((Math.random() * COMMON_LINES.length) | 0);
    p.bubble = mkBubble(L[idx]); p.sayQ++; p.sayIdx = idx; p.voiceT = rand(13, 21);
  }

  const r = w.point;
  const inPoint = !!r && p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
  if (inPoint && !p.inPoint) feed('You\u2019re involved with the Point.', 'bad');
  p.inPoint = inPoint;
  const nearPhone = !!ringing && Math.hypot(p.x - ringing.x, p.y - ringing.y) < 80;
  if (nearPhone && !p.nearPhone) feed('You\u2019re standing next to the ringing phone.', 'bad');
  p.nearPhone = nearPhone; p.dark = dark;
  p.called = !!(ev && ev.k === 'call' && ev.target === G.myId);
  if (z.repairs) {
    for (let i = G.litter.length - 1; i >= 0; i--) {
      const l = G.litter[i];
      if (Math.hypot(l.x - p.x, l.y - p.y) < 17) { G.litter.splice(i, 1); p.score += 5; G.stats.repaired++; float(l.x, l.y - 10, '+5 cleaned up', 'good'); }
    }
  }

  const blended = p.blendT > 0, lerp = Math.min(1, dt * 12), sittingNowPre = p.seated && !p.rising;
  let watched = false;
  for (const n of w.npcs) {
    if (G.mode === 'guest') {
      if (Math.hypot(n.x - n.rx, n.y - n.ry) > 80) { n.rx = n.x; n.ry = n.y; }
      n.rx += (n.x - n.rx) * lerp; n.ry += (n.y - n.ry) * lerp; n.rf += angDiff(n.face, n.rf) * lerp;
    } else { n.rx = n.x; n.ry = n.y; n.rf = n.face; }
    if (n.state === 'walk') n.step += dt * 8;
    if (n.bubble) { n.bubble.t += dt; if (n.bubble.t > n.bubble.dur) n.bubble = null; }
    n.lpc = Math.max(0, n.lpc - dt); n.bcd = Math.max(0, n.bcd - dt);
    const idle = n.state === 'walk' || n.state === 'wait';
    const d = Math.hypot(p.x - n.x, p.y - n.y);
    if (idle && !(n.cool > 0) && !blended && sees(n, p.x, p.y, n.gazeRange * (z.seenMul || 1))) { n.lg += dt / (sittingNowPre ? 1.3 : 1); watched = true; }
    else n.lg = Math.max(0, n.lg - dt * 1.2);
    if ((n.state === 'notice' || n.state === 'chat') && n.tgt === G.myId && d < 150) watched = true;
    if (idle && n.lpc <= 0 && !(n.bl > 0) && sees(p, n.x, n.y, myRange * n.seenMul)) {
      n.pg += dt;
      if (n.pg >= myNeed * (n.seated && n.state === 'wait' ? 1.3 : 1)) {
        n.pg = 0; n.lpc = 8;
        if (Math.abs(angDiff(Math.atan2(p.y - n.y, p.x - n.x), n.face)) > 1.6) G.behind.add('n' + n.i);
        act('pn', n.i);
      }
    } else n.pg = Math.max(0, n.pg - dt * 1.5);
    if (d < 22) {
      const push = (22 - d) / 2, ux = d ? (p.x - n.x) / d : 1, uy = d ? (p.y - n.y) / d : 0;
      p.x += ux * push; p.y += uy * push;
      if (moving && n.bcd <= 0) {
        n.bcd = 2.5;
        if (p.courtesy > 0) { p.courtesy--; p.courtRegen = 0; G.met.add(n.name); feed(`Courtesy protected <b>${esc(n.name)}</b> from you.`, ''); act('bs', n.i); }
        else act('bn', n.i);
      }
    }
  }
  for (const o of G.others.values()) {
    if (o.gone || o.done) continue;
    if (Math.hypot(o.x - o.rx, o.y - o.ry) > 80) { o.rx = o.x; o.ry = o.y; }
    o.rx += (o.x - o.rx) * lerp; o.ry += (o.y - o.ry) * lerp; o.rf += angDiff(o.face, o.rf) * lerp;
    if (o.mv) o.step += dt * 9;
    if (o.bubble) { o.bubble.t += dt; if (o.bubble.t > o.bubble.dur) o.bubble = null; }
    o.lpc = Math.max(0, o.lpc - dt);
    o.watchingMe = !o.bl && !blended && sees(o, p.x, p.y, rangeOf(o.z) * (z.seenMul || 1));
    if (o.watchingMe) watched = true;
    if (!o.bl && o.lpc <= 0 && sees(p, o.x, o.y, myRange * seenOf(o.z))) {
      o.pg += dt;
      if (o.pg >= myNeed * (o.si ? 1.3 : 1)) { const eye = !blended && sees(o, p.x, p.y, rangeOf(o.z) * (z.seenMul || 1));
        if (Math.abs(angDiff(Math.atan2(p.y - o.y, p.x - o.x), o.face)) > 1.6) G.behind.add('p' + o.id); o.pg = 0; o.lpc = 8; act('pp', o.id, eye ? 1 : 0); }
    } else o.pg = Math.max(0, o.pg - dt * 1.5);
    const d = Math.hypot(p.x - o.rx, p.y - o.ry);
    if (d < 22) { const ux = d ? (p.x - o.rx) / d : 1, uy = d ? (p.y - o.ry) / d : 0; p.x += ux * (22 - d); p.y += uy * (22 - d); }
  }
  const kid = kidEvent();
  if (kid) {
    smoothKid(kid, dt, lerp);
    p.kidSees = !blended && !kid.chase && sees(kid, p.x, p.y, KID_RANGE);
    if (p.kidSees) watched = true;
  } else p.kidSees = false;
  p.watched = watched;

  let rate = 0;
  const sittingNow = p.seated && !p.rising;
  if (!inPoint && !watched && !nearPhone) { rate = 2 * (z.scoreMul || 1); if (p.stillT > 1) rate *= 2; if (p.unpT > 0) rate *= 1.5; if (dark) rate *= 1.5; if (sittingNow) rate *= 1.25; }
  p.sitT = sittingNow ? p.sitT + dt : 0;
  if (p.sitT >= 15) errandDone('sit15');
  p.ghostT = !watched && !inPoint && !nearPhone ? p.ghostT + dt : 0;
  if (p.ghostT >= 20) errandDone('ghost20');
  if (dark) { p.darkEarned += rate * dt; if (p.darkEarned >= 40) errandDone('dark'); }
  if (inPoint) { p.everInPoint = true; G.stats.pointTime += dt; }
  if (p.stillT > 1) G.stats.stillTime += dt;
  p.rate = rate; p.score += rate * dt;

  for (let i = G.flying.length - 1; i >= 0; i--) { const f = G.flying[i]; f.t += dt; if (f.t >= f.dur) { G.flying.splice(i, 1); land(f); } }
  for (let i = G.floats.length - 1; i >= 0; i--) { G.floats[i].t += dt; if (G.floats[i].t > 1.4) G.floats.splice(i, 1); }
  if (!reduceMotion) { G.flicker -= dt; if (G.flicker <= 0 && Math.random() < dt * 0.1) G.flicker = rand(0.15, 0.5); }
}
