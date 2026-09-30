// The bar across the top and the ability buttons along the bottom, updated every frame.
import { $, clamp, ordinal, isTouch } from '../util.js';
import { G } from '../game/state.js';

const hud = {score:$('#hScore'), time:$('#hTime'), exc:$('#hExc'), excBar:$('#hExcBar'), rate:$('#hRate'), point:$('#hPoint'), court:$('#hCourt'),
  warmD:$('#abWarmD'), warmF:$('#abWarmF'), penD:$('#abPenD'), penF:$('#abPenF'), unpD:$('#abUnpD'), unpF:$('#abUnpF'), tossD:$('#abTossD'), tossF:$('#abTossF'), sit:$('#abSit'), sitD:$('#abSitD'), sitF:$('#abSitF'),
  warm:$('#abWarm'), pen:$('#abPen'), unp:$('#abUnp'), place:$('#hPlace'), banner:$('#evBanner')};
// Only touch the DOM when something actually changed.
function setText(el, s){ if (el._t !== s) { el.textContent = s; el._t = s; } }
function setW(el, f){ const s = (clamp(f, 0, 1) * 100).toFixed(1) + '%'; if (el._w !== s) { el.style.width = s; el._w = s; } }
function setCls(el, cls, on){ if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
export function updateHUD(){
  const p = G.me, z = G.z, w = G.world;
  setText(hud.score, String(Math.floor(p.score)));
  const s = Math.max(0, Math.ceil(w.left));
  setText(hud.time, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  setW(hud.exc, w.exc / 100);
  setCls(hud.excBar, 'hot', w.exc >= 70); setCls(hud.excBar, 'warm', w.exc >= 40 && w.exc < 70);
  const tags = [];
  if (p.called) tags.push('your number\u2019s been called');
  if (p.inPoint) tags.push('you\u2019re involved');
  else if (p.nearPhone) tags.push('next to the ringing phone');
  else if (p.kidSees) tags.push('a kid is staring at you');
  else if (p.watched) tags.push('someone\u2019s looking');
  else { if (p.stillT > 1) tags.push('still \u00d72'); if (p.unpT > 0) tags.push('unmarked \u00d71.5'); if (p.dark) tags.push('lights out \u00d71.5'); if (p.seated && !p.rising) tags.push('sitting \u00d71.25'); }
  setText(hud.rate, (p.rate > 0 ? `+${p.rate.toFixed(1)} per second` : 'Earning nothing') + (tags.length ? `, ${tags.join(', ')}` : ''));
  if (p.unpT > 0) { setText(hud.point, 'Unknown'); hud.point.className = 'v'; }
  else if (p.inPoint) { setText(hud.point, 'Held (oh no)'); hud.point.className = 'v pt-in'; }
  else { setText(hud.point, 'Released'); hud.point.className = 'v pt-out'; }
  const others = [...G.others.values()].filter(o => !o.gone);
  const ahead = w.npcs.filter(n => n.score > p.score).length + others.filter(o => o.sc > p.score).length;
  const ev = w.evt, bannerEl = hud.banner;
  if (ev) {
    const left = Math.max(0, Math.ceil(ev.t));
    setText(bannerEl, ev.k === 'call' ? (p.called ? `Now serving ${ev.no}. That\u2019s you. ${left}s` : `Now serving ${ev.no}. ${left}s`) : ev.k === 'phone' ? `Phone ringing. ${left}s` : ev.k === 'kid' ? `A kid is loose. ${left}s` : `Lights out. ${left}s`);
    bannerEl.hidden = false; setCls(bannerEl, 'mine', p.called);
  } else if (!bannerEl.hidden) bannerEl.hidden = true;
  setText(hud.place, `${ordinal(1 + ahead)} of ${w.npcs.length + others.length + 1}`);
  setText(hud.court, '\u25CF'.repeat(p.courtesy) + '\u25CB'.repeat(Math.max(0, (z.courtesyMax || 3) - p.courtesy)));
  const wt = z.warmTime || 3;
  if (p.warm) { setText(hud.warmD, `${z.warm}\u2026 ${(wt - p.warm.t).toFixed(1)}s`); setW(hud.warmF, p.warm.t / wt); }
  else { setText(hud.warmD, `${z.warm}, stand still ${wt}s`); setW(hud.warmF, 0); }
  setCls(hud.warm, 'on', !!p.warm);
  if (p.blendT > 0) setText(hud.penD, `${z.pen}, ${p.blendT.toFixed(1)}s left`);
  else setText(hud.penD, p.pen < 5 ? `${z.pen} has worn off` : `${z.pen}, ${Math.round(p.pen)}% and falling`);
  setW(hud.penF, p.pen / 100); setCls(hud.pen, 'on', p.blendT > 0); setCls(hud.pen, 'off', p.pen < 5);
  if (p.unpT > 0) setText(hud.unpD, `Unmarked for ${p.unpT.toFixed(1)}s`);
  else if (p.unpCd > 0) setText(hud.unpD, `Recharging, ${Math.ceil(p.unpCd)}s`);
  else setText(hud.unpD, 'Hide the Point, \u00d71.5');
  setW(hud.unpF, p.unpCd > 0 ? 1 - p.unpCd / (16 * (z.unpCdMul || 1)) : 1); setCls(hud.unp, 'on', p.unpT > 0); setCls(hud.unp, 'off', p.unpCd > 0 && p.unpT <= 0);
  setText(hud.tossD, isTouch ? 'Tap the right side' : 'Miss their feet on purpose');
  setW(hud.tossF, 1 - p.tossCd);
  if (p.seated) setText(hud.sitD, p.rising ? `Getting up\u2026 ${p.rising.toFixed(1)}s` : 'Sitting, \u00d71.25 and harder to notice');
  else setText(hud.sitD, p.canSit ? 'Sit down here' : 'Stand next to a free chair');
  setW(hud.sitF, p.seated ? (p.rising ? 1 - p.rising : 1) : 0);
  setCls(hud.sit, 'on', !!p.seated); setCls(hud.sit, 'off', !p.seated && !p.canSit);
}
