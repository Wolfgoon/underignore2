// The feed, toasts, floating numbers and speech bubbles, plus how to name people in them.
import { $, esc } from '../util.js';
import { G } from './state.js';

const feedEl = $('#feed'), toastEl = $('#toast');

export function feed(html, kind){
  const el = document.createElement('div'); el.className = 'fi ' + (kind || ''); el.innerHTML = html;
  feedEl.prepend(el);
  while (feedEl.children.length > 5) feedEl.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 5200);
}
export const clearFeed = () => { feedEl.innerHTML = ''; };
export function toast(msg){ toastEl.textContent = msg; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }
export function float(x, y, text, kind){ G.floats.push({x, y, text, kind, t:0}); }
export const mkBubble = text => ({text, t:0, dur:1.5 + text.length * 0.05});

// Your score changes, scaled for jobs that take less of a hit (the Accountant).
export const penalty = base => Math.round(base * (G.z.penaltyMul || 1));

export const npcName = i => { const n = G.world.npcs[i]; return n ? n.name : 'Someone'; };
export function otherName(id){ const o = G.others.get(id); return o ? (o.nick || o.nm || 'Someone') : 'Someone'; }
// For feed messages: "you", or someone's name, escaped.
export const who = id => id === G.myId ? 'you' : esc(otherName(id));
