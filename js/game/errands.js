// Three optional errands each match, shown under the Errands tab.
import { ERRANDS } from '../data.js';
import { $, esc, shuffled } from '../util.js';
import { G } from './state.js';
import { feed, toast } from './feedback.js';

// At most one of the errands that can only be judged at the end.
export function pickErrands(){
  const out = []; let ends = 0;
  for (const e of shuffled(ERRANDS)) {
    if (e.end && ends) continue;
    out.push(Object.assign({done:false}, e)); if (e.end) ends++;
    if (out.length === 3) break;
  }
  return out;
}
export function errandDone(id, quiet){
  if (!G || !G.errands) return;
  const e = G.errands.find(x => x.id === id && !x.done); if (!e) return;
  e.done = true; G.me.score += e.reward; G.stats.errands++;
  const tab = $('#errToggle'); tab.classList.add('ping'); setTimeout(() => tab.classList.remove('ping'), 1800);
  if (!quiet) { toast(`Errand done: ${e.text}. +${e.reward}`); feed(`Errand done: <b>${esc(e.text)}</b>. +${e.reward}`, 'good'); }
  renderErrands();
}
export function renderErrands(){
  if (!G || !G.errands) return;
  const done = G.errands.filter(e => e.done).length;
  $('#errCount').textContent = `${done}/${G.errands.length}`;
  $('#errList').innerHTML = G.errands.map(e => `<li class="${e.done ? 'done' : ''}">${esc(e.text)} <span>+${e.reward}</span></li>`).join('');
}
export function toggleErrands(open){
  const pop = $('#errPop'), tab = $('#errToggle');
  const isOpen = typeof open === 'boolean' ? open : pop.hidden;
  pop.hidden = !isOpen; tab.setAttribute('aria-expanded', String(isOpen));
}
export function initErrands(){
  $('#errToggle').addEventListener('click', () => toggleErrands());
  $('#errPop').addEventListener('click', () => toggleErrands(false));
}
