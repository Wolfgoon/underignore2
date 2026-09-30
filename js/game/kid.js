// Someone brought their kid. The kid wanders the room and points at anyone it can see, which is
// the most involved thing that can happen to a person. Nobody can notice a kid back.
// Kids chase litter, though, so a receipt tossed near one buys a few seconds of peace.
import { KID_RANGE } from '../data.js';
import { rand, rint, pick, clamp, angDiff, normAng } from '../util.js';
import { W, H, SPAWN, insideSolid, pushOut, sees } from '../layout.js';
import { G } from './state.js';
import { hostEmit } from './host.js';
import { newTarget } from './npc.js';

const POINT_TIME = 0.6, POINT_COOLDOWN = 5, CHASE_RADIUS = 180;
export const KID_COST = 12;

export const kidEvent = () => {
  const w = G.world;
  return w.evt && w.evt.k === 'kid' ? w.evt : null;
};

export function startKid(){
  return {k:'kid', t:13, dur:13, x:SPAWN.x, y:SPAWN.y + 20, face:-Math.PI / 2, tx:SPAWN.x, ty:SPAWN.y - 120, retarget:1.5, chase:0, gz:{}, cd:{}};
}

// Whether a receipt landing at (x, y) is close enough for the kid to go after it. Everyone can ask;
// only the host actually sends the kid running.
export function receiptTempts(x, y){
  const kid = kidEvent();
  return !!kid && Math.hypot(kid.x - x, kid.y - y) < CHASE_RADIUS;
}
export function distractKid(x, y){
  const kid = kidEvent();
  if (!kid || G.mode === 'guest' || !receiptTempts(x, y)) return;
  kid.tx = x; kid.ty = y; kid.chase = 3.5; kid.retarget = 3.5;
}

function wander(kid, players){
  // Half the time it heads straight for a stranger; otherwise anywhere at all.
  const people = players.map(p => ({x:p.x, y:p.y})).concat(G.world.npcs.map(n => ({x:n.x, y:n.y})));
  for (let i = 0; i < 20; i++) {
    const to = Math.random() < 0.5 && people.length ? pick(people) : null;
    const x = clamp(to ? to.x + rand(-50, 50) : rand(90, W - 90), 60, W - 60);
    const y = clamp(to ? to.y + rand(-50, 50) : rand(120, H - 90), 90, H - 60);
    if (!insideSolid(x, y, 14)) { kid.tx = x; kid.ty = y; break; }
  }
  kid.retarget = rand(1.8, 3.2);
}

// Host only. Returns how much Excitement the kid added this tick.
export function hostUpdateKid(kid, dt, players){
  kid.chase = Math.max(0, kid.chase - dt);
  kid.retarget -= dt;
  const dx = kid.tx - kid.x, dy = kid.ty - kid.y, d = Math.hypot(dx, dy);
  if ((d < 6 && !kid.chase) || kid.retarget <= 0) wander(kid, players);
  if (d > 3) {
    const sp = kid.chase ? 85 : 55;
    kid.x += dx / d * sp * dt; kid.y += dy / d * sp * dt;
    kid.face += angDiff(Math.atan2(dy, dx), kid.face) * Math.min(1, dt * 7);
  } else kid.face += Math.sin(G.t * 3) * dt * 2;   // looking around
  kid.face = normAng(kid.face);
  kid.x = clamp(kid.x, 40, W - 40); kid.y = clamp(kid.y, 40, H - 40); pushOut(kid, 8);
  for (const k in kid.cd) kid.cd[k] -= dt;
  if (kid.chase) return 1.2 * dt;   // too busy with the receipt to point at anyone

  let exc = 1.2 * dt;
  const look = (key, x, y, hidden, onPoint) => {
    if (!hidden && (kid.cd[key] || 0) <= 0 && sees(kid, x, y, KID_RANGE)) {
      kid.gz[key] = (kid.gz[key] || 0) + dt;
      if (kid.gz[key] >= POINT_TIME) { kid.gz[key] = 0; kid.cd[key] = POINT_COOLDOWN; onPoint(); }
    } else kid.gz[key] = Math.max(0, (kid.gz[key] || 0) - dt);
  };
  for (const p of players) look(p.id, p.x, p.y, p.blend, () => { hostEmit('kp', p.id); exc += 6; });
  for (const n of G.world.npcs) {
    const busy = n.state === 'notice' || n.state === 'chat';
    look('#' + n.i, n.x, n.y, n.bl > 0 || busy, () => {
      n.score = Math.max(0, n.score - KID_COST * n.penaltyMul); n.fluster = 2;
      hostEmit('kp', '#' + n.i); hostEmit('sy', n.i, 'F', rint()); exc += 3;
      newTarget(n, kid, true);
    });
  }
  return exc;
}

// Everyone: smooth the kid's position between host updates. Kids never stop fidgeting, so its feet always move.
export function smoothKid(kid, dt, lerp){
  kid.step = (kid.step || 0) + dt * 11;
  if (G.mode !== 'guest' || kid.rx == null || Math.hypot(kid.x - kid.rx, kid.y - kid.ry) > 80) { kid.rx = kid.x; kid.ry = kid.y; kid.rf = kid.face; return; }
  kid.rx += (kid.x - kid.rx) * lerp; kid.ry += (kid.y - kid.ry) * lerp; kid.rf += angDiff(kid.face, kid.rf) * lerp;
}
