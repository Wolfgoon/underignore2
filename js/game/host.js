// The host's side: runs the shared waiting room (the computer players, the Point, events,
// Excitement and the clock) and turns everyone's actions into events. Solo play runs this too.
import { ZEROES, WALL, CONE, MY_RANGE, NOTICE_COST, EVENT_KINDS } from '../data.js';
import { rand, pick, rint, clamp, angDiff, normAng, r1 } from '../util.js';
import { W, H, setDark, inRect, insideSolid, blocked, pushOut, sees } from '../layout.js';
import { acct } from '../account.js';
import { G } from './state.js';
import { newTarget, sidestep } from './npc.js';
import { endMatch } from './end.js';
import { startKid, hostUpdateKid } from './kid.js';

export function hostEmit(k, ...args){ const w = G.world; w.q++; w.events.push([w.q, k, ...args]); if (w.events.length > 14) w.events.shift(); }
export function hostPlayers(){
  const me = G.me, z = G.z;
  const list = [{id:G.myId, zid:acct.zero, x:me.x, y:me.y, face:me.face, moving:me.moving, blend:me.blendT > 0,
    giveUp:!!z.giveUp, gazeMul:z.gazeMul || 1, seenMul:z.seenMul || 1, score:me.score, seated:!!(me.seated && !me.rising)}];
  for (const [id, o] of G.others) if (!o.gone && !o.done) {
    const oz = ZEROES[o.z] || {};
    list.push({id, zid:o.z, x:o.x, y:o.y, face:o.face, moving:o.mv, blend:o.bl, giveUp:!!oz.giveUp, gazeMul:oz.gazeMul || 1, seenMul:oz.seenMul || 1, score:o.sc, seated:!!o.si});
  }
  return list;
}
export function hostMovePoint(first){
  const w = G.world, players = hostPlayers(), pw = 170, ph = 120;
  for (let i = 0; i < 40; i++) {
    const r = {x:rand(WALL + 24, W - WALL - 24 - pw), y:rand(112, H - WALL - 24 - ph), w:pw, h:ph};
    if (!players.some(p => p.x > r.x - 36 && p.x < r.x + pw + 36 && p.y > r.y - 36 && p.y < r.y + ph + 36) || i === 39) { w.point = r; break; }
  }
  w.pointT = 18;
  if (!first) hostEmit('mv');
}
function hostNotice(n, p, cat){
  n.state = 'notice'; n.tgt = p.id; n.timer = p.giveUp ? 1.1 : 2.2; n.gz = {};
  hostEmit('sy', n.i, cat, rint()); hostEmit('nt', p.id, n.i);
  G.world.exc += 15;
  hostCallFound(p.id);
}
function hostNevermind(n){
  hostEmit('sy', n.i, 'V', rint()); if (n.tgt) hostEmit('nv', n.tgt, n.i);
  n.cool = 6; newTarget(n);
}

function hostStartEvent(players){
  const w = G.world, k = pick(EVENT_KINDS.filter(x => x !== w.lastEvt));
  w.lastEvt = k;
  if (k === 'call') {
    const pool = players.map(p => p.id).concat(w.npcs.filter(n => n.state === 'walk' || n.state === 'wait').map(n => '#' + n.i));
    const target = pick(pool); w.callNo++; w.served = w.callNo;
    w.evt = {k, t:7, dur:7, no:w.callNo, target};
    const n = target[0] === '#' ? w.npcs[+target.slice(1)] : null;
    if (n) { if (n.state === 'walk') { n.state = 'wait'; n.tx = n.x; n.ty = n.y; n.base = n.face; } n.timer = Math.max(n.timer, 8); }
    hostEmit('es', k, w.callNo, target);
  } else if (k === 'phone') {
    let x = W / 2, y = H / 2;
    for (let i = 0; i < 40; i++) { x = rand(90, W - 90); y = rand(130, H - 110); if (!insideSolid(x, y, 30) && !inRect(w.point, x, y, 40)) break; }
    w.evt = {k, t:5.5, dur:5.5, x, y};
    hostEmit('es', k, r1(x), r1(y));
  } else if (k === 'kid') {
    w.evt = startKid();
    hostEmit('es', k);
  } else {
    w.evt = {k, t:6, dur:6};
    hostEmit('es', k);
  }
}
function hostEndEvent(){
  const w = G.world, e = w.evt; if (!e) return;
  if (e.k === 'call') {
    if (e.target[0] === '#') { const n = w.npcs[+e.target.slice(1)]; if (n) n.score += 40; }
    hostEmit('cs', e.target, e.no);
  } else hostEmit('ee', e.k);
  w.evt = null; w.evtNext = rand(15, 22);
}
// Whoever's number was called got noticed before it ran out.
function hostCallFound(id){
  const w = G.world, e = w.evt;
  if (!e || e.k !== 'call' || e.target !== id) return;
  if (id[0] === '#') { const n = w.npcs[+id.slice(1)]; if (n) n.score = Math.max(0, n.score - 25 * n.penaltyMul); }
  w.exc += 10;
  hostEmit('cf', id, e.no);
  w.evt = null; w.evtNext = rand(15, 22);
}
function hostEnd(why){ G.world.ph = 'end'; G.world.why = why; endMatch(why); }

export function hostUpdate(dt){
  const w = G.world, players = hostPlayers(), r = w.point;
  const byId = id => players.find(p => p.id === id);
  w.left -= dt;
  w.pointT -= dt; if (w.pointT <= 0) hostMovePoint(false);
  if (w.evt) { w.evt.t -= dt; if (w.evt.t <= 0) hostEndEvent(); }
  else { w.evtNext -= dt; if (w.evtNext <= 0 && w.left > 12) hostStartEvent(players); }
  const evt = w.evt, calling = evt && evt.k === 'call' ? evt : null, ringing = evt && evt.k === 'phone' ? evt : null, dark = !!(evt && evt.k === 'dark');
  const kid = evt && evt.k === 'kid' ? evt : null;
  setDark(dark);
  if (kid) w.exc += hostUpdateKid(kid, dt, players);

  for (const n of w.npcs) {
    n.cool = Math.max(0, n.cool - dt); n.pcool = Math.max(0, n.pcool - dt); n.fluster = Math.max(0, n.fluster - dt);
    n.dodgeCd = Math.max(0, n.dodgeCd - dt); n.bl = Math.max(0, n.bl - dt);
    n.penLeft = Math.max(0, n.penLeft - n.penDrain * dt);
    for (const k in n.passCool) n.passCool[k] -= dt;
    for (const k in n.nnCool) n.nnCool[k] -= dt;
    let idle = n.state === 'walk' || n.state === 'wait';

    // Get out of the Point, a little faster the smarter they are.
    const isCalled = !!calling && calling.target === '#' + n.i;
    const byPhone = !!ringing && Math.hypot(ringing.x - n.x, ringing.y - n.y) < 95;
    const byKid = !!kid && Math.hypot(kid.x - n.x, kid.y - n.y) < 75;
    if (idle && (inRect(r, n.x, n.y, 12) || (n.state === 'walk' && inRect(r, n.tx, n.ty, 20)) || byPhone || byKid)) {
      n.pointT += dt; if (n.pointT > n.react) { n.pointT = 0; newTarget(n, byPhone ? ringing : byKid ? kid : null, true); }
    } else n.pointT = 0;

    // Being stared at. They only react if they can see the person doing it,
    // so sneaking up from behind still works.
    const lookers = n.bl > 0 ? [] : players.filter(p => !p.blend && sees(p, n.x, n.y, MY_RANGE * p.gazeMul * n.seenMul));
    const aware = idle ? lookers.find(p => Math.abs(angDiff(Math.atan2(p.y - n.y, p.x - n.x), n.face)) < 1.6) : null;
    if (aware) {
      n.eyed += dt;
      const sitting = n.state === 'wait' && n.seated;
      if (n.eyed > n.react + (sitting && n.penLeft < 15 ? 0.4 : 0)) {
        n.eyed = 0;
        // Sometimes they just miss it. Smarter people miss it less.
        if (Math.random() < 0.55 + n.smart * 0.4) {
          // Near the edge of your glance, stepping sideways gets them out in time.
          // In the middle of it, blending in is the only thing fast enough.
          const cx = Math.cos(aware.face), cy = Math.sin(aware.face), rx = n.x - aware.x, ry = n.y - aware.y;
          const lateral = Math.abs(rx * -cy + ry * cx), along = rx * cx + ry * cy;
          const nearEdge = Math.max(0, along) * Math.tan(CONE) - lateral < 35;
          const blend = () => { n.bl = 1.2 + 3.5 * n.penLeft / 100; n.penLeft = Math.max(0, n.penLeft - n.penCost); hostEmit('nb', n.i); };
          if (isCalled) { if (n.penLeft >= 10) blend(); }
          else if (sitting && n.penLeft >= 15) blend();
          else if (nearEdge && n.dodgeCd <= 0) { sidestep(n, aware); n.dodgeCd = rand(2.5, 4.5); }
          else if (n.penLeft >= 15) blend();
          else if (n.dodgeCd <= 0) { sidestep(n, aware); n.dodgeCd = rand(2.5, 4.5); }
        }
      }
    } else n.eyed = Math.max(0, n.eyed - dt * 2);

    if (n.state === 'walk') {
      const tx = n.tx - n.x, ty = n.ty - n.y, td = Math.hypot(tx, ty);
      if (td < 3) {
        n.state = 'wait';
        n.timer = n.style === 'wallflower' ? rand(9, 16) : n.style === 'watcher' ? rand(5, 10) : rand(2.5, 7);
        if (n.arriveFace != null) n.face = n.arriveFace;
        n.seated = !!n.tseat;
        n.base = n.face; n.glance = rand(0.6, 1.6); n.faceTarget = null;
      } else {
        n.face += angDiff(Math.atan2(ty, tx), n.face) * Math.min(1, dt * 8);
        n.x += tx / td * n.speed * dt; n.y += ty / td * n.speed * dt;
        n.prog = (n.prog || 0) + dt;
        if (n.prog > 1.2) { if (Math.hypot(n.x - (n.px || 0), n.y - (n.py || 0)) < 6) newTarget(n); n.prog = 0; n.px = n.x; n.py = n.y; }
      }
    } else if (n.state === 'wait') {
      n.timer -= dt; n.glance -= dt;
      if (n.glance <= 0 && calling && !isCalled) {
        // Someone's number was called. Whoever's moving is probably them.
        n.glance = rand(0.45, 0.9); n.hunt = null;
        let best = null, bd = n.gazeRange * 1.6;
        for (const p of players) if (!p.blend && p.moving) { const d = Math.hypot(p.x - n.x, p.y - n.y); if (d < bd && !blocked(n.x, n.y, p.x, p.y)) { bd = d; best = p; } }
        for (const o of w.npcs) if (o !== n && o.state === 'walk' && o.bl <= 0) { const d = Math.hypot(o.x - n.x, o.y - n.y); if (d < bd && !blocked(n.x, n.y, o.x, o.y)) { bd = d; best = o; } }
        n.faceTarget = best ? Math.atan2(best.y - n.y, best.x - n.x) : n.face + rand(-2.2, 2.2);
      } else if (n.glance <= 0) {
        n.glance = n.style === 'watcher' ? rand(0.9, 1.8) : rand(1.4, 3.2);
        n.faceTarget = n.base + rand(-1.1, 1.1); n.hunt = null;
        // Watchers, and anyone else now and then, look toward whoever is worth noticing.
        if (n.style === 'watcher' || Math.random() < 0.2) {
          let best = null, bd = n.gazeRange * 1.35;
          for (const p of players) {
            if (p.blend || p.score < n.score - 25) continue;
            const d = Math.hypot(p.x - n.x, p.y - n.y);
            if (d < bd) { bd = d; best = p; }
          }
          if (best) { n.faceTarget = Math.atan2(best.y - n.y, best.x - n.x) + rand(-0.25, 0.25) * (1.4 - n.smart); n.hunt = best.id; }
          else if (n.style === 'watcher') {
            let bo = null, bod = n.gazeRange * 1.2;
            for (const o of w.npcs) {
              if (o === n || o.bl > 0 || o.score <= n.score || (n.nnCool[o.i] || 0) > 0) continue;
              const d = Math.hypot(o.x - n.x, o.y - n.y); if (d < bod) { bod = d; bo = o; }
            }
            if (bo) n.faceTarget = Math.atan2(bo.y - n.y, bo.x - n.x) + rand(-0.2, 0.2);
          }
        }
      }
      if (n.hunt) {
        const hp = byId(n.hunt);
        if (hp && !hp.blend && Math.hypot(hp.x - n.x, hp.y - n.y) < n.gazeRange * 1.35) n.faceTarget = Math.atan2(hp.y - n.y, hp.x - n.x);
        else n.hunt = null;
      }
      // A ringing phone gets everyone's attention, which leaves their backs to the rest of the room.
      if (ringing && Math.hypot(ringing.x - n.x, ringing.y - n.y) < n.gazeRange * 2.4) { n.faceTarget = Math.atan2(ringing.y - n.y, ringing.x - n.x); n.hunt = null; }
      if (n.faceTarget != null) n.face += angDiff(n.faceTarget, n.face) * Math.min(1, dt * (calling ? 5 : 3.5));
      if (n.timer <= 0 && !isCalled) newTarget(n);
    } else if (n.state === 'notice') {
      const tp = byId(n.tgt);
      if (tp) n.face += angDiff(Math.atan2(tp.y - n.y, tp.x - n.x), n.face) * Math.min(1, dt * 6);
      n.timer -= dt;
      if (!tp || Math.hypot(tp.x - n.x, tp.y - n.y) > 150 || tp.blend) hostNevermind(n);
      else if (n.timer <= 0) {
        if (tp.giveUp) hostNevermind(n);
        else { n.state = 'chat'; n.timer = 2.6; hostEmit('sy', n.i, 'T', rint()); hostEmit('tk', n.tgt, n.i); w.exc += 30; }
      }
    } else if (n.state === 'chat') {
      const tp = byId(n.tgt);
      if (tp) n.face += angDiff(Math.atan2(tp.y - n.y, tp.x - n.x), n.face) * Math.min(1, dt * 6);
      n.timer -= dt; if (n.timer <= 0) { n.cool = 9; newTarget(n); }
    }
    n.face = normAng(n.face);
    idle = n.state === 'walk' || n.state === 'wait';

    // Noticing players, walking past them, bumping, and wallflowers edging away.
    let fired = false, near = false;
    for (const p of players) {
      const d = Math.hypot(p.x - n.x, p.y - n.y);
      const looking = idle && n.cool <= 0 && !p.blend && sees(n, p.x, p.y, n.gazeRange * p.seenMul);
      if (looking) {
        n.gz[p.id] = (n.gz[p.id] || 0) + dt;
        if (n.gz[p.id] >= n.noticeNeed * (p.seated ? 1.3 : 1) && !fired) { hostNotice(n, p, 'N'); fired = true; }
      } else n.gz[p.id] = Math.max(0, (n.gz[p.id] || 0) - dt * 1.2);
      if (idle && !fired && d < 58 && !looking && !(n.gz[p.id] > 0) && (n.passCool[p.id] || 0) <= 0) { n.passCool[p.id] = 12; hostEmit('ps', p.id, n.i); }
      if (d < 22) { const push = (22 - d) / 2, ux = d ? (n.x - p.x) / d : 1, uy = d ? (n.y - p.y) / d : 0; n.x += ux * push; n.y += uy * push; }
      if (n.style === 'wallflower' && n.state === 'wait' && d < 55 && !p.blend) {
        near = true; n.nearT += dt;
        if (n.nearT > n.react + 0.4) { n.nearT = 0; newTarget(n, p, false); }
      }
    }
    if (!near) n.nearT = 0;

    // Watchers also try to notice other people who are ahead of them.
    if (n.style === 'watcher' && n.state === 'wait' && n.cool <= 0) {
      for (const o of w.npcs) {
        if (o === n) continue;
        const ok = o.bl <= 0 && (o.state === 'walk' || o.state === 'wait') && o.score > n.score && (n.nnCool[o.i] || 0) <= 0;
        if (ok && sees(n, o.x, o.y, n.gazeRange)) {
          n.ngz[o.i] = (n.ngz[o.i] || 0) + dt;
          if (n.ngz[o.i] >= 1) {
            n.ngz[o.i] = 0; n.nnCool[o.i] = 15;
            o.score = Math.max(0, o.score - NOTICE_COST * o.penaltyMul); o.fluster = 3;
            hostEmit('nn', n.i, o.i); hostEmit('sy', o.i, 'F', rint()); newTarget(o, n, true); hostCallFound('#' + o.i);
            break;
          }
        } else n.ngz[o.i] = Math.max(0, (n.ngz[o.i] || 0) - dt);
      }
    }

    // Same scoring rules as players: out of the Point, nobody looking, double for standing still,
    // plus a Warmup whenever they've stood still long enough.
    let watched = lookers.length > 0;
    if (!watched && n.bl <= 0) for (const o of w.npcs) {
      if (o !== n && (o.state === 'walk' || o.state === 'wait') && o.cool <= 0 && sees(o, n.x, n.y, o.gazeRange)) { watched = true; break; }
    }
    n.stillT = n.state === 'wait' ? n.stillT + dt : 0;
    if (idle && !inRect(r, n.x, n.y) && !watched && n.fluster <= 0 && !byPhone) {
      let rate = 2 * n.mul; if (n.stillT > 1) rate *= 2; if (dark) rate *= 1.5; if (n.state === 'wait' && n.seated) rate *= 1.25;
      n.score += rate * dt;
      if (n.state === 'wait') { n.warmT += dt; if (n.warmT >= n.warmNeed) { n.warmT = 0; n.score += 15; } }
      else n.warmT = 0;
    } else n.warmT = 0;
  }

  // people ignoring each other
  for (const k in w.pairCool) { w.pairCool[k] -= dt; if (w.pairCool[k] <= 0) delete w.pairCool[k]; }
  for (let i = 0; i < w.npcs.length; i++) for (let j = i + 1; j < w.npcs.length; j++) {
    const a = w.npcs[i], b = w.npcs[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 22) { const push = (22 - d) / 2, ux = d ? dx / d : 1, uy = d ? dy / d : 0; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
    if (d < 52) {
      const key = i + ':' + j;
      if (!w.pairCool[key]) {
        const busy = s => s === 'notice' || s === 'chat';
        if (!busy(a.state) && !busy(b.state) && !sees(a, b.x, b.y, a.gazeRange) && !sees(b, a.x, a.y, b.gazeRange)) { hostEmit('ig', i, j); w.pairCool[key] = 14; }
        else w.pairCool[key] = 4;
      }
    }
  }
  for (const n of w.npcs) { n.x = clamp(n.x, WALL + 12, W - WALL - 12); n.y = clamp(n.y, WALL + 12, H - WALL - 12); pushOut(n, 12); }

  w.crowdTick -= dt; w.crowdCool -= dt;
  if (w.crowdTick <= 0) {
    w.crowdTick = 0.5; w.crowd = null;
    for (const a of w.npcs) {
      let k = 0; for (const b of w.npcs) if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 85) k++;
      if (k >= 2) { w.crowd = a; break; }
    }
  }
  if (w.crowd) { w.exc += 3 * dt; if (w.crowdCool <= 0) { hostEmit('cr', w.crowd.i); w.crowdCool = 15; } }

  const involved = (r ? players.filter(p => inRect(r, p.x, p.y)).length : 0) * 10
    + (ringing ? players.filter(p => Math.hypot(p.x - ringing.x, p.y - ringing.y) < 80).length * 6 : 0);
  const unimpressed = players.some(p => ZEROES[p.zid] && ZEROES[p.zid].excDecayMul) || w.npcs.some(n => ZEROES[n.zid] && ZEROES[n.zid].excDecayMul);
  if (involved) w.exc += involved * dt; else w.exc -= 4 * (unimpressed ? 1.75 : 1) * dt;
  w.exc = clamp(w.exc, 0, 100);

  if (w.exc >= 100) hostEnd('undertime');
  else if (w.left <= 0) hostEnd('time');
}

export function handleAction(pid, a){
  if (!Array.isArray(a) || G.over) return;
  const w = G.world, k = a[1], players = hostPlayers(), p = players.find(x => x.id === pid);
  if (!p) return;
  const npc = i => (Number.isInteger(i) && w.npcs[i]) || null;
  if (k === 'pn') {
    const n = npc(a[2]); if (!n || !(n.state === 'walk' || n.state === 'wait') || n.pcool > 0 || n.bl > 0) return;
    n.pcool = 8; n.fluster = 4;
    const cost = Math.round(NOTICE_COST * n.penaltyMul);
    const lost = Math.min(cost, Math.floor(n.score)); n.score = Math.max(0, n.score - cost);
    const eye = !p.blend && n.cool <= 0 && sees(n, p.x, p.y, n.gazeRange * p.seenMul) && (n.gz[pid] || 0) > 0.15;
    hostEmit('pn', pid, n.i, lost, eye ? 1 : 0);
    hostCallFound('#' + n.i);
    if (eye) { w.exc += 5; hostNotice(n, p, 'E'); } else { hostEmit('sy', n.i, 'F', rint()); newTarget(n, p, true); }
  } else if (k === 'pp') {
    const t = players.find(x => x.id === a[2]); if (!t || t.id === pid) return;
    const eye = a[3] ? 1 : 0; hostEmit('pp', pid, t.id, eye); w.exc += eye ? 20 : 10; hostCallFound(t.id);
  } else if (k === 'hit') {
    const n = npc(a[2]); if (!n) return;
    w.exc += 5; if (n.state === 'walk' || n.state === 'wait') hostNotice(n, p, 'H');
  } else if (k === 'bn') {
    const n = npc(a[2]); if (n && (n.state === 'walk' || n.state === 'wait')) hostNotice(n, p, 'X');
  } else if (k === 'bs') {
    const n = npc(a[2]); if (n) hostEmit('sy', n.i, 'S', rint());
  }
}
