// The lobby, the Zero assignment, the how-to screen and the solo queue.
import { ZEROES, NAMES, RANKS, ROLE_NOTES, fullName, jobName } from './data.js';
import { acct, saveAcct, resetAcct, rankIndex, zeroRGB, solesSVG } from './account.js';
import { $, esc, pick, reduceMotion } from './util.js';
import { show, activeScreen } from './screens.js';
import { openMp } from './multiplayer.js';
import { startGame } from './game/match.js';
import { babylonReady } from './render/view3d.js';

export function renderLobby(){
  const card = $('#acctCard');
  if (!acct.zero) {
    card.className = 'acct empty';
    card.innerHTML = `<div><span class="k">No Zero yet</span><strong>You’ll be given a random name and job</strong><span class="role">You won’t get a say in either.</span></div>`;
    return;
  }
  const z = ZEROES[acct.zero], ri = rankIndex(acct.total), next = RANKS[ri + 1];
  card.className = 'acct';
  card.innerHTML = `
    <div class="acct-zero"><span class="soles">${solesSVG(zeroRGB(z, acct.fade), acct.fade >= 1)}</span>
      <div><span class="k">Assigned to you, permanently</span><strong>${esc(fullName(acct.name, z))}</strong><span class="role">${z.role}</span><span class="passive">${z.passive}</span></div></div>
    <div class="acct-stats">
      <div><span class="k">Rank</span><strong>${RANKS[ri][0]}</strong><small>${next ? `${Math.ceil(next[1] - acct.total)} Disinterest until you drop` : 'You can’t get any lower.'}</small></div>
      <div><span class="k">Matches ignored</span><strong>${acct.matches}</strong><small>${acct.errands || 0} errands done</small></div>
      <div><span class="k">Colour left</span><strong>${Math.round((1 - acct.fade) * 100)}%</strong></div>
    </div>`;
}
export function showLobby(){ renderLobby(); show('lobby'); }

// Spins through names and jobs like a slot machine, then lands on yours for good.
let assignTimer = 0, assignNext = null;
function assignZero(next){
  assignNext = next;
  const ids = Object.keys(ZEROES), id = pick(ids), z = ZEROES[id], name = pick(NAMES);
  acct.zero = id; acct.name = name; acct.assigned = true; saveAcct();
  show('assign');
  const nameEl = $('#asName'), titleEl = $('#asTitle'), soles = $('#asSoles'), det = $('#asDetails'), accept = $('#btnAccept');
  det.hidden = true; $('#asNote').hidden = true; accept.hidden = true;
  $('#asIntro').textContent = 'Assigning you a name and a job. You don’t get a say in this.';
  const showZ = (zz, nm) => { nameEl.textContent = nm; titleEl.textContent = zz.title; soles.innerHTML = solesSVG(zz.color); };
  const reveal = () => {
    showZ(z, name);
    $('#asIntro').textContent = 'You’ve been assigned';
    det.innerHTML = `<dt>Role</dt><dd>${z.role}. <span>${ROLE_NOTES[z.role]}</span></dd>
      <dt>Passive</dt><dd>${z.passive}. <span>${z.passiveDesc}</span></dd>
      <dt>Warmup</dt><dd>${z.warm}</dd><dt>Penultimate</dt><dd>${z.pen}</dd>`;
    det.hidden = false; $('#asNote').hidden = false; accept.hidden = false; accept.focus();
  };
  clearTimeout(assignTimer);
  if (reduceMotion) { reveal(); return; }
  let i = (Math.random() * ids.length) | 0, delay = 60;
  const step = () => {
    showZ(ZEROES[ids[i++ % ids.length]], pick(NAMES));
    delay *= 1.16;
    assignTimer = setTimeout(delay < 330 ? step : reveal, delay < 330 ? delay : 420);
  };
  step();
}
const withZero = fn => { if (!acct.zero) assignZero(fn); else fn(); };

function renderZeroList(){
  $('#zeroList').innerHTML = Object.values(ZEROES).map(z =>
    `<dt><span class="dot" style="background:rgb(${z.color.join(',')})"></span>${jobName(z)}</dt><dd>${z.passive}: <span>${z.passiveDesc}</span></dd>`).join('');
}

let qTimers = [];
export function queue(){
  show('queue'); qTimers.forEach(clearTimeout); qTimers = [];
  const say = (text, sub) => { $('#qText').textContent = text; $('#qSub').textContent = sub; };
  say('Searching for 0 players', 'Estimated wait: whenever');
  qTimers.push(setTimeout(() => say('Found 0 of 0 players', 'Balancing two teams of nobody'), 1100));
  qTimers.push(setTimeout(() => say('Match found: 0v0', 'Arriving. You’ll leave shortly.'), 2100));
  qTimers.push(setTimeout(async () => {
    if (!window.BABYLON) { $('#qSub').textContent = 'Setting up the 3D waiting room…'; await babylonReady(10000); }
    if (activeScreen() === 'queue') startGame('solo');
  }, 2900));
}

export function initLobby(){
  $('#btnAccept').addEventListener('click', () => { renderLobby(); const f = assignNext; assignNext = null; (f || (() => show('lobby')))(); });
  $('#btnHow').addEventListener('click', () => { renderZeroList(); show('how'); });
  $('#btnHowBack').addEventListener('click', () => show('lobby'));
  $('#btnPlay').addEventListener('click', () => withZero(queue));
  $('#btnMulti').addEventListener('click', () => withZero(openMp));

  // Resetting takes two taps.
  const LABEL = 'Reset rank and colour';
  let forgetArmed = 0;
  $('#btnForget').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!forgetArmed) {
      b.textContent = acct.zero ? `Tap again to reset. You’ll still be ${fullName(acct.name, ZEROES[acct.zero])}, though.` : 'Tap again to reset your rank and colour.';
      forgetArmed = setTimeout(() => { forgetArmed = 0; b.textContent = LABEL; }, 4000);
      return;
    }
    clearTimeout(forgetArmed); forgetArmed = 0; b.textContent = LABEL;
    resetAcct(); renderLobby();
  });
}
