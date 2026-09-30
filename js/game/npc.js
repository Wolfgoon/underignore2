// The people the computer plays: who they are, and where they decide to go.
import { ZEROES, NAMES, EXTRA_JOBS, NPC_RANGE, MY_RANGE } from '../data.js';
import { rand, pick, clamp, shuffled } from '../util.js';
import { W, H, SPAWN, SPOTS, insideSolid, pathClear, inRect, sees } from '../layout.js';
import { G } from './state.js';
import { hostPlayers } from './host.js';

// Everyone the computer plays has a personality:
//  wallflowers hug the chairs, sit still for ages and slip away when watched;
//  watchers stand where they can see people and try to notice whoever is ahead;
//  drifters wander more and react more slowly.
const STYLES = ['wallflower','wallflower','watcher','watcher','drifter','drifter','wallflower'];
export function npcBase(i, who, x, y, face){
  const z = ZEROES[who.zid] || null, smart = rand(0.55, 1), opt = k => (z && z[k]) || null;
  const tint = z ? z.color.map((c, k) => Math.round(c * 0.38 + [72, 66, 58][k] * 0.62))
    : (() => { const t = rand(0.8, 1.25); return [72 * t, 66 * t, 58 * t].map(Math.round); })();
  return {i, name:who.name, title:who.title || '', zid:who.zid || '', x, y, rx:x, ry:y, face, rf:face, base:face, faceTarget:null,
    state:'wait', timer:rand(1, 4), glance:rand(0.5, 2), cool:2.5, gz:{}, passCool:{}, ngz:{}, nnCool:{}, step:0, bubble:null,
    speed:35, tx:x, ty:y, arriveFace:null, tgt:null, hunt:null, score:0, pcool:3, fluster:0, lg:0, pg:0, lpc:2, bcd:0, bl:0,
    style:who.style || pick(STYLES), smart, react:0.3 + (1 - smart) * 0.6, stillT:0, warmT:0, eyed:0, nearT:0, dodgeCd:0, pointT:0, penLeft:100,
    warmNeed:(opt('warmTime') || 3) + 0.6 + (1 - smart) * 2.5,
    gazeRange:NPC_RANGE * (opt('gazeMul') || 1), noticeNeed:0.75 * (opt('noticeMul') || 1),
    mul:opt('scoreMul') || 1, speedMul:opt('speedMul') || 1, penaltyMul:opt('penaltyMul') || 1, seenMul:opt('seenMul') || 1,
    penDrain:0.4 * (opt('penDrainMul') || 1), penCost:opt('penCost') ? opt('penCost') + 12 : 28,
    rgb:tint.join(',')};
}
export function makeNPC(who, i){
  let x, y, tries = 0;
  do { x = rand(120, W - 120); y = rand(130, H - 120); } while ((Math.hypot(x - SPAWN.x, y - SPAWN.y) < 230 || insideSolid(x, y, 20)) && ++tries < 200);
  return npcBase(i, who, x, y, rand(-Math.PI, Math.PI));
}
// The computer plays the jobs nobody in the room has, then ordinary jobs if it runs out.
export function pickCast(count, taken, takenNames){
  const jobs = shuffled(Object.keys(ZEROES).filter(id => !taken.includes(id)));
  const names = shuffled(NAMES.filter(n => !takenNames.includes(n)));
  const cast = jobs.slice(0, count).map(id => ({name:names.shift() || 'Someone', title:ZEROES[id].title, zid:id}));
  const extras = shuffled(EXTRA_JOBS);
  while (cast.length < count && extras.length) cast.push({name:names.shift() || 'Someone', title:extras.shift(), zid:''});
  return cast;
}
// Picks somewhere good to stand: out of the Point, away from crowds and people's glances,
// not too far to walk, and for watchers, within glancing distance of the players.
function pickSpot(n, avoid){
  const w = G.world, players = hostPlayers(), r = w.point;
  let best = null, bestScore = -Infinity;
  for (let k = 0; k < 14; k++) {
    const chair = Math.random() < (n.style === 'wallflower' ? 0.85 : 0.4);
    const s = chair ? pick(SPOTS) : null;
    const c = s ? {x:s.x, y:s.y, face:s.face, seat:!!s.seat} : {x:rand(110, W - 110), y:rand(130, H - 110), face:null, seat:false};
    if (insideSolid(c.x, c.y, 16) || !pathClear(n.x, n.y, c.x, c.y)) continue;
    let sc = 0;
    const ev = w.evt;
    if (ev && ev.k === 'phone' && Math.hypot(ev.x - c.x, ev.y - c.y) < 120) sc -= 400;
    if (ev && ev.k === 'kid' && Math.hypot(ev.x - c.x, ev.y - c.y) < 150) sc -= 300;
    if (inRect(r, c.x, c.y, 30)) sc -= 1000;
    for (const o of w.npcs) if (o !== n) {
      const d = Math.min(Math.hypot(o.x - c.x, o.y - c.y), Math.hypot(o.tx - c.x, o.ty - c.y));
      if (d < 70) sc -= (70 - d) * 2;
    }
    for (const p of players) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (n.style === 'watcher') sc -= Math.abs(d - 140) * 0.6;
      else if (d < 160) sc -= (160 - d) * (n.style === 'wallflower' ? 1.2 : 0.5);
      if (!p.blend && sees(p, c.x, c.y, MY_RANGE * p.gazeMul * 1.2)) sc -= 80;
    }
    if (avoid) sc += Math.min(220, Math.hypot(avoid.x - c.x, avoid.y - c.y)) * 0.9;
    sc -= Math.hypot(c.x - n.x, c.y - n.y) * (n.style === 'drifter' ? 0.05 : 0.25);
    sc += rand(0, 60) * (1.1 - n.smart);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  if (!best) return {x:n.x, y:n.y, face:null};
  if (avoid && best.face == null) best.face = Math.atan2(best.y - avoid.y, best.x - avoid.x);
  return best;
}
// A quick step sideways, out of someone's line of sight, ending up facing away from them.
export function sidestep(n, looker){
  const cx = Math.cos(looker.face), cy = Math.sin(looker.face), rx = n.x - looker.x, ry = n.y - looker.y;
  const side = (rx * -cy + ry * cx) >= 0 ? 1 : -1, dist = rand(80, 110);
  const tx = clamp(n.x - cy * side * dist, 110, W - 110), ty = clamp(n.y + cx * side * dist, 130, H - 110);
  if (insideSolid(tx, ty, 16) || !pathClear(n.x, n.y, tx, ty)) { newTarget(n, looker, true); return; }
  n.state = 'walk'; n.faceTarget = null; n.tgt = null; n.hunt = null;
  n.tx = tx; n.ty = ty; n.tseat = false; n.seated = false;
  n.speed = rand(62, 72) * n.speedMul;
  n.arriveFace = Math.atan2(n.y - looker.y, n.x - looker.x);
}
export function newTarget(n, avoid, hurry){
  n.state = 'walk'; n.faceTarget = null; n.tgt = null; n.hunt = null;
  n.speed = (hurry ? rand(52, 62) : rand(30, 44)) * n.speedMul;
  const c = pickSpot(n, avoid);
  n.tx = c.x; n.ty = c.y; n.arriveFace = c.face; n.tseat = !!c.seat; n.seated = false;
}

