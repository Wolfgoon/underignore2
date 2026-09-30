// The end of a match: final errands, results, rank, fading, and what to do next.
import { ZEROES, RANKS, fullName } from '../data.js';
import { $, esc, ordinal } from '../util.js';
import { acct, saveAcct, rankIndex, zeroRGB } from '../account.js';
import { show } from '../screens.js';
import { MP, leaveRoom, roomPresence, showRoom } from '../multiplayer.js';
import { renderLobby, showLobby, queue } from '../lobby.js';
import { G, keys } from './state.js';
import { errandDone } from './errands.js';
import { otherName } from './feedback.js';
import { netOut } from './net.js';
import { stopLoop } from './match.js';
import { endStill, runPotg, stopPotg } from './potg.js';

export function renderStandings(){
  if (!G) return;
  const score = Math.floor(G.me.score);
  const table = [{name:`You (${fullName(acct.name, G.z)})`, score, me:true}];
  for (const o of G.others.values()) {
    const z = ZEROES[o.z] || ZEROES.accountant;
    table.push({name:fullName(otherName(o.id), z) + (o.gone ? ', left' : ''), score:Math.floor(o.sc)});
  }
  for (const n of G.world.npcs) table.push({name:n.title ? `${n.name} ${n.title}` : n.name, score:Math.floor(n.score)});
  table.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
  const place = table.findIndex(r => r.me) + 1;
  $('#endPlace').textContent = place === 1 ? 'You were the least involved person in the room.' : `You finished ${ordinal(place)} least involved out of ${table.length}.`;
  $('#endStandings').innerHTML = table.map(r => `<li class="${r.me ? 'me' : ''}"><span>${esc(r.name)}</span><b>${r.score}</b></li>`).join('');
}
export function endMatch(reason){
  if (!G || G.over) return;
  // Errands that can only be judged at the end.
  if (reason !== 'lost') {
    const me = G.me, zz = G.z;
    if (!me.everInPoint) errandDone('nopoint', true);
    if (me.courtesy >= (zz.courtesyMax || 3)) errandDone('courtesy', true);
    const ahead = G.world.npcs.filter(n => n.score > me.score).length + [...G.others.values()].filter(o => o.sc > me.score).length;
    if (ahead < 3) errandDone('top3', true);
  }
  if (G.still.active) endStill();
  if (G.mode === 'host' && G.world.ph !== 'end') { G.world.ph = 'end'; G.world.why = reason === 'quit' ? 'hostquit' : reason; }
  G.over = true; stopLoop(); keys.clear(); $('#pauseOv').hidden = true;
  if (G.mode !== 'solo' && MP) netOut(performance.now(), true);
  const z = G.z, score = Math.floor(G.me.score), multi = G.mode !== 'solo';
  acct.errands = (acct.errands || 0) + G.stats.errands;
  const r0 = rankIndex(acct.total); acct.total += score; acct.matches += 1; const r1i = rankIndex(acct.total);
  const f0 = acct.fade; acct.fade = Math.min(1, Math.round((acct.fade + 0.08) * 100) / 100); saveAcct();
  const everyone = multi ? ' for everyone' : '';
  const T = {
    undertime:['Undertime', `Something exciting was about to happen, so the match ended early${everyone}.`],
    time:['You left', 'You left a few seconds after arriving, exactly as intended.'],
    quit:['You left early', multi && G.mode === 'host' ? 'You were hosting, so everyone left with you. Honestly, respect.' : 'You left even sooner than planned. Honestly, respect.'],
    hostquit:['Everyone left', 'The host left early, so the match quietly ended. Nobody noticed, technically.'],
    hostleft:['Everyone left', 'The host disappeared, so the match quietly ended. Nobody noticed, technically.'],
    lost:['You drifted off', 'The connection to the room dropped, so the match ended for you.']
  }[reason] || ['You left', 'You left a few seconds after arriving, exactly as intended.'];
  $('#endTitle').textContent = T[0]; $('#endSub').textContent = T[1];
  $('#endScore').textContent = score;
  const next = RANKS[r1i + 1];
  $('#endRank').innerHTML = r1i > r0
    ? `You descended from <b>${RANKS[r0][0]}</b> to <b>${RANKS[r1i][0]}</b>. Well done on getting worse.`
    : `Still <b>${RANKS[r1i][0]}</b>. ${next ? `${Math.ceil(next[1] - acct.total)} more Disinterest and you\u2019ll finally drop.` : 'There is nowhere lower to go.'}`;
  renderStandings();
  $('#endErrands').innerHTML = G.errands.map(e => `<li class="${e.done ? 'done' : ''}">${esc(e.text)} <span>${e.done ? '+' + e.reward : 'not this time'}</span></li>`).join('');
  const st = G.stats;
  const rows = [['People you noticed', st.noticedOthers], ['Eye contact incidents', st.eye], ['Times noticed', st.noticed], ['Times not noticed', st.ignored],
    ['People who decided not to say anything', st.nevermind], ['Feet missed on purpose', st.missed], ['Feet accidentally hit', st.hit],
    ['Small talk endured', st.smalltalk], ['Errands done', `${st.errands} of ${G.errands.length}`], ['Warmups where nothing happened', st.warmups], ['Times your number was called', st.called], ['Times you got away with it', st.calls], z.repairs ? ['Litter cleaned up', st.repaired] : ['Receipts littered', st.littered], ['Longest stillness', G.still.best.toFixed(1) + 's']];
  $('#endStats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const met = [...G.met];
  $('#endForgot').innerHTML = met.length
    ? `You\u2019ve already forgotten the names of ${met.map((n, i) => `<span class="forgot" style="filter:blur(${2 + i * 0.6}px)">${esc(n)}</span>`).join('')}`
    : 'You didn\u2019t meet anyone, so there\u2019s nobody to forget. Ideal.';
  const c0 = zeroRGB(z, f0).join(','), c1 = zeroRGB(z, acct.fade).join(',');
  $('#endFade').innerHTML = acct.fade >= 1
    ? `${acct.name} is now a grey outline. Every cosmetic has worn off. Peak Underignore.`
    : `${acct.name}\u2019s colour wore off a little, from <span class="swatch" style="background:rgb(${c0})"></span> to <span class="swatch" style="background:rgb(${c1})"></span>. ${Math.round((1 - acct.fade) * 100)}% remains.`;
  const inRoom = multi && MP && reason !== 'lost';
  $('#btnAgain').textContent = inRoom ? 'Back to the room' : 'Queue for nothing again';
  $('#btnLobby').textContent = inRoom ? 'Leave the room' : 'Back to lobby';
  $('#endNote').textContent = '';
  show('end');
  runPotg(z);
}

export function initEnd(){
  $('#btnAgain').addEventListener('click', () => {
    stopPotg(); renderLobby();
    if (G && G.mode !== 'solo' && MP) { roomPresence(); showRoom(); }
    else queue();
  });
  $('#btnLobby').addEventListener('click', () => { stopPotg(); if (MP) leaveRoom(); showLobby(); });
}
