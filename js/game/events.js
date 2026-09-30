// Everyone's side: hearing what the host says happened, and telling the host what you did.
import { ZEROES, LINES, NOTICE_COST } from '../data.js';
import { esc, num } from '../util.js';
import { G } from './state.js';
import { feed, toast, float, mkBubble, penalty, npcName, otherName, who } from './feedback.js';
import { errandDone } from './errands.js';
import { handleAction } from './host.js';
import { KID_COST } from './kid.js';

// Event targets are player ids, or '#3' for the computer player at index 3.
function evTargetName(id){
  if (typeof id === 'string' && id[0] === '#') return npcName(+id.slice(1));
  return id === G.myId ? 'you' : otherName(id);
}
// Errands that care about you noticing someone. key is 'n<index>' or 'p<peer id>'.
function noticedSomeone(key){
  G.stats.noticedOthers++;
  if (G.behind.has(key)) errandDone('behind');
  if (G.world.evt && G.world.evt.k === 'phone') errandDone('phonenotice');
  if (G.stats.noticedOthers >= 3) errandDone('notice3');
}
function loseScore(cost, label){
  const me = G.me;
  me.score = Math.max(0, me.score - cost);
  float(me.x, me.y - 30, `−${cost} ${label}`, 'bad');
}

export function processEvent(ev){
  if (!Array.isArray(ev)) return;
  const [, k, a, b, c, d] = ev, w = G.world, me = G.me, mine = a === G.myId, z = G.z;
  const nn = i => esc(npcName(i));
  switch (k) {
    case 'sy': { const n = w.npcs[a], L = LINES[b]; if (n && L) n.bubble = mkBubble(L[Math.abs(num(c)) % L.length]); break; }
    case 'nt':
      if (mine) {
        G.stats.noticed++; G.met.add(npcName(b));
        loseScore(penalty(10), z.penaltyMul ? 'noticed (written off)' : 'noticed');
        feed(`<b>${nn(b)}</b> noticed you.`, 'bad');
      } else if (G.mode !== 'solo') feed(`<b>${nn(b)}</b> noticed <b>${who(a)}</b>.`, '');
      break;
    case 'nv':
      if (mine) { me.score += 8; G.stats.nevermind++; errandDone('nevermind'); float(me.x, me.y - 30, '+8 escaped', 'good'); feed(`<b>${nn(b)}</b> decided not to say anything. +8`, 'good'); }
      break;
    case 'tk':
      if (mine) { G.stats.smalltalk++; feed(`Small talk occurred with <b>${nn(b)}</b>.`, 'bad'); }
      else feed(`Small talk broke out between <b>${nn(b)}</b> and <b>${who(a)}</b>.`, 'bad');
      break;
    case 'ps':
      if (mine) { me.score += 3; G.stats.ignored++; G.met.add(npcName(b)); feed(`<b>${nn(b)}</b> didn\u2019t notice you. +3`, 'good'); }
      break;
    case 'pn': {
      const n = w.npcs[b];
      if (mine) {
        G.met.add(npcName(b)); noticedSomeone('n' + b);
        if (n) float(n.rx, n.ry - 32, `${n.name} −${c || 0}`, 'good');
        if (d) { G.stats.eye++; feed(`Eye contact with <b>${nn(b)}</b>. Everybody loses.`, 'bad'); }
        else feed(`You noticed <b>${nn(b)}</b>. They lost ${c || 'nothing, they had nothing'}.`, 'good');
      } else if (G.mode !== 'solo') feed(`<b>${who(a)}</b> noticed <b>${nn(b)}</b>.`, '');
      break;
    }
    case 'pp': {
      const toMe = b === G.myId;
      if (toMe) {
        G.stats.noticed++; G.met.add(otherName(a));
        if (c) G.stats.eye++;
        loseScore(penalty(NOTICE_COST), 'noticed');
        feed(`<b>${who(a)}</b> noticed you${c ? ', and you made eye contact' : ''}.`, 'bad');
      }
      if (mine) {
        G.met.add(otherName(b)); noticedSomeone('p' + b);
        const o = G.others.get(b); if (o) float(o.rx, o.ry - 32, `${otherName(b)} −${NOTICE_COST}`, 'good');
        if (c) { G.stats.eye++; loseScore(penalty(NOTICE_COST), 'eye contact'); feed(`Eye contact with <b>${who(b)}</b>. Everybody loses.`, 'bad'); }
        else feed(`You noticed <b>${who(b)}</b>. They lost ${NOTICE_COST}.`, 'good');
      }
      if (!toMe && !mine) feed(`<b>${who(a)}</b> noticed <b>${who(b)}</b>.`, '');
      break;
    }
    case 'mv': if (me.unpT <= 0) toast('The Point moved. Please keep not being there.'); feed('The Point moved somewhere.', ''); break;
    case 'cr': feed(`A crowd is forming near <b>${nn(a)}</b>. Something might happen.`, 'bad'); break;
    case 'ig': feed(`<b>${nn(a)}</b> didn\u2019t notice <b>${nn(b)}</b>.`, ''); break;
    case 'nb': { const n = w.npcs[a]; if (n) { const nz = ZEROES[n.zid]; feed(`<b>${nn(a)}</b> used <b>${esc(nz ? nz.pen : 'Stare at nothing')}</b>.`, ''); } break; }
    case 'nn': feed(`<b>${nn(a)}</b> noticed <b>${nn(b)}</b>.`, ''); break;
    case 'es':
      if (a === 'call') {
        if (c === G.myId) { G.stats.called++; toast(`Now serving ${b}. That\u2019s your number. Pretend it isn\u2019t.`); feed(`Now serving <b>${b}</b>. That\u2019s you. Stay still and don\u2019t get noticed.`, 'bad'); }
        else { toast(`Now serving ${b}. Everyone\u2019s looking around to see who it is.`); feed(`Now serving <b>${b}</b>. Anyone moving looks suspicious.`, ''); }
      } else if (a === 'phone') { toast('Someone\u2019s phone is ringing. Everyone\u2019s looking at it.'); feed('A phone is ringing. Don\u2019t be near it.', ''); }
      else if (a === 'dark') { toast('The lights went out. Nobody can see much.'); feed('Lights out. Glances are short and Disinterest is \u00d71.5.', ''); }
      else if (a === 'kid') { toast('Someone brought their kid. Kids notice everything.'); feed('A kid is loose. Stay out of its sight, or toss it a receipt.', 'bad'); }
      break;
    case 'cs':
      if (a === G.myId) { me.score += 40; G.stats.calls++; errandDone('call'); float(me.x, me.y - 30, '+40 pretended it wasn\u2019t you', 'good'); feed(`Nobody worked out that number ${b} was you. +40`, 'good'); }
      else feed(`Nobody worked out that number ${b} was <b>${esc(evTargetName(a))}</b>.`, '');
      break;
    case 'cf':
      if (a === G.myId) { G.stats.callsFound++; loseScore(penalty(25), 'they worked it out'); feed(`Everyone worked out that number ${b} was you.`, 'bad'); }
      else feed(`Number ${b} was <b>${esc(evTargetName(a))}</b>. Everyone knows now.`, '');
      break;
    case 'ee': feed({phone:'The phone stopped ringing.', dark:'The lights came back on.', kid:'The kid got bored and was taken outside.'}[a] || '', ''); break;
    case 'kp':
      if (mine) { G.stats.pointedAt++; loseScore(penalty(KID_COST), 'a kid pointed at you'); feed('A kid pointed at you and yelled \u201cWHO\u2019S THAT?\u201d', 'bad'); }
      else feed(`The kid pointed at <b>${esc(evTargetName(a))}</b>.`, '');
      break;
  }
}
export function consumeEvents(){
  for (const ev of G.world.events) if (ev[0] > G.lastEvQ) { G.lastEvQ = ev[0]; processEvent(ev); if (G.over) return; }
}
// Something you did that the host needs to judge. Guests send it in their presence; hosts handle it now.
export function act(k, ...args){
  G.actQ++; const a = [G.actQ, k, ...args];
  if (G.mode === 'guest') { G.acts.push(a); if (G.acts.length > 10) G.acts.shift(); }
  else handleAction(G.myId, a);
}
