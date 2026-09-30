// Starting a match and running it: a fixed-rate simulation tick plus a render loop.
import { ZEROES, MAPS, MATCH_LEN } from '../data.js';
import { $, TAU, rand, pick, clamp, num, cleanName, mulberry32, isTouch } from '../util.js';
import { W, H, SPAWN, buildLayout, insideSolid } from '../layout.js';
import { acct, saveAcct, zeroRGB } from '../account.js';
import { show, onShow } from '../screens.js';
import { MP, myPeerId, findHostPeer } from '../multiplayer.js';
import { G, setGame, keys } from './state.js';
import { toast, clearFeed } from './feedback.js';
import { pickErrands, renderErrands, toggleErrands } from './errands.js';
import { makeNPC, pickCast } from './npc.js';
import { hostMovePoint, hostUpdate } from './host.js';
import { consumeEvents } from './events.js';
import { applyHostState, castFromHost, netIn, netOut } from './net.js';
import { clientUpdate } from './player.js';
import { captureSnap, resetSnaps } from './potg.js';
import { endMatch } from './end.js';
import { resize } from '../render/canvas.js';
import { hideJoystick } from '../input.js';
import { render } from '../render/draw2d.js';
import { V, initView, buildScene, render3D } from '../render/view3d.js';
import { updateHUD } from '../render/hud.js';

let raf = 0, simTimer = 0, lastTick = 0, lastMap = null;

// The host (or a solo player) picks the room and who's in it. Guests copy the host.
function chooseMatch(mode){
  if (mode === 'guest') {
    const h = findHostPeer(); if (!h) return null;
    const hp = h.presence;
    return {hp, lay:hp.lay === 'p' ? 'p' : 'l', seed:num(hp.seed, 1) | 0, mid:hp.mid, mapId:MAPS[hp.map] ? hp.map : 'dmv', cast:castFromHost(hp)};
  }
  const mapId = pick(Object.keys(MAPS).filter(k => k !== lastMap)); lastMap = mapId;
  // The computer plays the Zeroes nobody in the room has.
  let count = 7;
  const taken = [acct.zero], takenNames = [acct.name, acct.nick];
  if (mode === 'host') {
    const others = MP.named.peers().filter(p => !p.sameTab && p.presence);
    count = clamp(7 - others.filter(p => p.kind === 'viewer' && p.presence.v === 1).length, 3, 7);
    for (const p of others) {
      if (ZEROES[p.presence.z]) taken.push(p.presence.z);
      takenNames.push(cleanName(p.presence.nm), cleanName(p.presence.nick));
    }
  }
  return {hp:null, lay:innerHeight > innerWidth * 1.1 ? 'p' : 'l', seed:(Math.random() * 1e9) | 0, mid:(Math.random() * 1e9) | 0, mapId,
    cast:pickCast(count, taken, takenNames)};
}

function newGame(mode, myId, m){
  const z = ZEROES[acct.zero];
  const sx = mode === 'guest' ? SPAWN.x + rand(-15, 70) : SPAWN.x, sy = mode === 'guest' ? SPAWN.y - rand(0, 40) : SPAWN.y;
  return { mode, myId, z, t:0, over:false, paused:false, lastPub:0, lastEvQ:0, actQ:0, acts:[], lastAct:{}, hostMissingSince:0,
    me:{x:sx, y:sy, face:-Math.PI / 2, moving:false, stillT:0, step:0, blendT:0, pen:100, warm:null, tossCd:0, unpT:0, unpCd:0,
       courtesy:z.courtesyMax || 3, courtRegen:0, seated:false, rising:0, sitT:0, ghostT:0, darkEarned:0, everInPoint:false, canSit:false,
       voiceT:rand(5, 9), bubble:null, score:0, rate:0, watched:false, inPoint:false, sayQ:0, sayIdx:0, tossQ:0, lastToss:null},
    rgb:zeroRGB(z, acct.fade).join(','), outline:acct.fade >= 1,
    world:{mid:m.mid, lay:m.lay, seed:m.seed, cast:m.cast, map:m.mapId, evt:null, evtNext:rand(13, 17), lastEvt:null, callNo:30 + ((Math.random() * 40) | 0), served:0,
      npcs:[], point:null, pointT:18, left:MATCH_LEN, exc:0, ph:'play', why:'', events:[], q:0, pairCool:{}, crowd:null, crowdTick:0, crowdCool:4},
    others:new Map(), litter:[], flying:[], floats:[], flicker:0,
    stats:{noticed:0, ignored:0, missed:0, hit:0, smalltalk:0, warmups:0, littered:0, repaired:0, nevermind:0, noticedOthers:0, eye:0, called:0, calls:0, callsFound:0, errands:0, pointedAt:0, pointTime:0, stillTime:0},
    errands:pickErrands(), behind:new Set(),
    met:new Set(), still:{start:0, active:true, best:0, pending:true}, hints:[], warned10:false };
}

// Litter is placed from the shared seed, so everyone in a room sees the same mess.
function scatterLitter(seed){
  const rng = mulberry32(seed);
  for (let i = 0; i < 12; i++) {
    const l = {x:80 + rng() * (W - 160), y:120 + rng() * (H - 220), r:rng() * TAU, kind:rng() < 0.4 ? 'cup' : 'receipt'};
    if (!insideSolid(l.x, l.y, 4)) G.litter.push(l);
  }
}

function hintsFor(mode, mapId){
  const where = MAPS[mapId].name;
  const hints = mode !== 'solo'
    ? [[0.4, `Today’s waiting room is ${where}. Everyone shares the Point and the Excitement meter.`], [4.5, 'Other players can notice you, and you can notice them.']]
    : acct.matches < 2
      ? [[0.4, 'Stay out of the dashed Point. Don’t get noticed.'], [4.2, 'Stand still to double your Disinterest.'], [8.2, 'Pale wedges are where people are looking.'], [12.5, 'You can notice people too. Keep them in your glance.']]
      : [[0.4, `You’ve arrived at ${where}. You’ll leave in 90 seconds.`]];
  if (!acct.seenErrands) {
    hints.push([2.6, isTouch ? 'Your errands are under the Errands tab at the top. Each one pays extra.' : 'Your errands are under the Errands tab at the top, or press Tab. Each one pays extra.']);
    hints.sort((a, b) => a[0] - b[0]);
    acct.seenErrands = true; saveAcct();
  }
  return hints;
}

// mode is 'solo', 'host' or 'guest'. Returns false if the room isn't ready yet.
export function startGame(mode){
  const myId = mode === 'solo' ? 'me' : myPeerId();
  if (mode !== 'solo' && !myId) return false;
  const m = chooseMatch(mode);
  if (!m) return false;
  if (MP) MP.playedMid = m.mid;
  buildLayout(m.mapId, m.lay === 'p');
  resetSnaps();
  setGame(newGame(mode, myId, m));
  const w = G.world;
  if (mode === 'guest') applyHostState(m.hp, true);
  else {
    m.cast.forEach((who, i) => w.npcs.push(makeNPC(who, i)));
    if (!w.npcs.some(n => n.style === 'watcher') && w.npcs[0]) w.npcs[0].style = 'watcher';
    hostMovePoint(true);
  }
  scatterLitter(m.seed);
  G.hints = hintsFor(mode, m.mapId);

  toggleErrands(false);
  renderErrands();
  clearFeed(); $('#pauseOv').hidden = true; keys.clear(); hideJoystick();
  show('game');
  resize();
  V.ok = initView() && buildScene();
  if (!V.ok && !V.warned) { V.warned = true; setTimeout(() => toast('The 3D engine didn’t load, so this match is flat.'), 600); }
  const th = $('#touchHint'); th.classList.remove('gone'); setTimeout(() => th.classList.add('gone'), 5000);
  lastTick = performance.now();
  clearInterval(simTimer); simTimer = setInterval(tick, 16);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(frameLoop);
  return true;
}
export const stopLoop = () => clearInterval(simTimer);

function tick(){
  if (!G || G.over) { clearInterval(simTimer); return; }
  const now = performance.now();
  let el = Math.min(1.5, (now - lastTick) / 1000); lastTick = now;
  if (G.mode !== 'solo') {
    if (!MP) { endMatch('lost'); return; }
    netIn(now); if (G.over) return;
  }
  while (el > 1e-4 && !G.over) { const dt = Math.min(0.05, el); el -= dt; step(dt); }
  if (G.mode !== 'solo' && !G.over) netOut(now, false);
}
function step(dt){
  if (G.paused && G.mode === 'solo') return;
  if (G.mode !== 'guest') { hostUpdate(dt); if (G.over) return; consumeEvents(); if (G.over) return; }
  clientUpdate(dt);
  if (G.mode !== 'guest' && !G.over) consumeEvents();
}
function frameLoop(){
  raf = requestAnimationFrame(frameLoop);
  if (!G || G.over) return;
  if (V.ok) render3D();
  render();
  if (G.still.pending && G.still.active && G.t - G.still.start >= 0.8) { captureSnap(); G.still.pending = false; }
  updateHUD();
}

onShow(id => {
  if (id === 'game') requestAnimationFrame(resize);
  else { cancelAnimationFrame(raf); raf = 0; }
});
