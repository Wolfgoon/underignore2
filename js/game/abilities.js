// What you can do: sit, Warmup, Penultimate, Unping and tossing receipts.
import { WALL } from '../data.js';
import { TAU, rand, clamp, r1, esc } from '../util.js';
import { W, H, SEATS } from '../layout.js';
import { G } from './state.js';
import { feed, float, penalty, otherName } from './feedback.js';
import { errandDone } from './errands.js';
import { act } from './events.js';
import { startStill } from './potg.js';

export function freeSeatNear(x, y){
  let best = null, bd = 34;
  for (const s of SEATS) {
    const d = Math.hypot(s.x - x, s.y - y); if (d >= bd) continue;
    if (G.world.npcs.some(n => n.state !== 'walk' && Math.hypot(n.x - s.x, n.y - s.y) < 16)) continue;
    if ([...G.others.values()].some(o => !o.gone && !o.done && o.si && Math.hypot(o.x - s.x, o.y - s.y) < 16)) continue;
    bd = d; best = s;
  }
  return best;
}
export function doSit(){
  const p = G.me;
  if (p.seated) { if (!p.rising) { p.rising = 1; p.warm = null; } return; }
  const s = freeSeatNear(p.x, p.y);
  if (!s) { float(p.x, p.y - 30, 'no free chair nearby', 'meta'); return; }
  p.seated = true; p.rising = 0; p.sitT = 0; p.x = s.x; p.y = s.y; p.face = s.face;
  if (p.moving) { p.moving = false; startStill(); }
  float(p.x, p.y - 30, 'sat down', 'meta');
}
export function doWarm(){
  const p = G.me; if (p.warm) return;
  if (p.moving) { float(p.x, p.y - 30, 'stand still first', 'meta'); return; }
  p.warm = {t:0};
}
export function doPen(){
  const p = G.me; if (p.blendT > 0) return;
  if (p.pen < 5) { float(p.x, p.y - 30, 'too weak to bother', 'meta'); return; }
  const d = Math.max(1, 6 * p.pen / 100);
  if (G.world.npcs.some(n => n.lg >= 0.3) || [...G.others.values()].some(o => !o.gone && !o.done && o.watchingMe)) errandDone('blendsave');
  p.blendT = d; p.pen = Math.max(0, p.pen - (G.z.penCost || 18));
  feed(`You used <b>${G.z.pen}</b>. It was ${d < 2.5 ? 'barely' : d < 4.5 ? 'somewhat' : 'fairly'} effective.`, '');
}
export function doUnping(){
  const p = G.me; if (p.unpCd > 0) return;
  p.unpT = 7; p.unpCd = 16 * (G.z.unpCdMul || 1);
  feed('You unmarked the Point. Nobody knows where anything is.', '');
}
export function doToss(x, y){
  const p = G.me; if (p.tossCd > 0) return;
  let dx = x - p.x, dy = y - p.y; const d = Math.hypot(dx, dy);
  if (d < 10) return;
  const R = 230; if (d > R) { dx *= R / d; dy *= R / d; }
  const tx = clamp(p.x + dx, WALL + 6, W - WALL - 6), ty = clamp(p.y + dy, WALL + 6, H - WALL - 6);
  p.face = Math.atan2(ty - p.y, tx - p.x);
  G.flying.push({sx:p.x, sy:p.y, tx, ty, t:0, dur:0.42 + Math.hypot(tx - p.x, ty - p.y) / 700, r:rand(0, TAU)});
  p.tossCd = 1; p.tossQ++; p.lastToss = [p.tossQ, r1(p.x), r1(p.y), r1(tx), r1(ty)];
}
export function land(f){
  G.litter.push({x:f.tx, y:f.ty, r:f.r, kind:'receipt'}); if (G.litter.length > 40) G.litter.shift();
  if (f.remote) return;
  let best = null, bd = 1e9;
  for (const n of G.world.npcs) { const d = Math.hypot(n.rx - f.tx, n.ry - f.ty); if (d < bd) { bd = d; best = {name:n.name, npc:n}; } }
  for (const o of G.others.values()) { if (o.gone || o.done) continue; const d = Math.hypot(o.rx - f.tx, o.ry - f.ty); if (d < bd) { bd = d; best = {name:otherName(o.id), other:o}; } }
  if (best && bd < 13) {
    const cost = penalty(8);
    G.stats.hit++; G.met.add(best.name); G.me.score = Math.max(0, G.me.score - cost);
    float(f.tx, f.ty - 12, `\u2212${cost} hit their feet`, 'bad');
    feed(`You hit <b>${esc(best.name)}</b>\u2019s feet. Unforgivable.`, 'bad');
    if (best.npc) act('hit', best.npc.i);
  } else if (best && bd < 44) {
    const b = Math.round(8 + 17 * (1 - (bd - 13) / 31));
    G.me.score += b; G.stats.missed++; G.met.add(best.name);
    if (G.stats.missed >= 2) errandDone('miss2');
    float(f.tx, f.ty - 12, `+${b} missed on purpose`, 'good');
    feed(`You missed <b>${esc(best.name)}</b>\u2019s feet on purpose. +${b}`, 'good');
  } else { G.stats.littered++; float(f.tx, f.ty - 12, 'littered', 'meta'); }
}
