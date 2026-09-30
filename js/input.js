// Keyboard, mouse, touch joystick and the ability buttons.
import { $ } from './util.js';
import { G, keys, joy, mouse } from './game/state.js';
import { doWarm, doPen, doUnping, doSit, doToss } from './game/abilities.js';
import { toggleErrands } from './game/errands.js';
import { endMatch } from './game/end.js';
import { cv, floorAt } from './render/canvas.js';

const joyEl = $('#joy'), knob = joyEl.querySelector('i');
export function hideJoystick(){ joy.active = false; joy.x = joy.y = 0; joyEl.classList.remove('on'); }

const inGame = () => G && !G.over && $('#game').classList.contains('active');
function togglePause(force){
  if (!inGame()) return;
  G.paused = force === true ? true : !G.paused;
  $('#pauseText').textContent = G.mode === 'solo' ? 'Honestly, it\u2019s hard to tell the difference.' : 'The room carries on without you. You\u2019re standing very still, at least.';
  $('#pauseOv').hidden = !G.paused; keys.clear();
  if (G.paused) $('#btnResume').focus();
}
function bindAb(sel, fn){
  const b = $(sel);
  // Some touch browsers follow a tap with a click as well; only count the click when no tap just happened.
  b.addEventListener('pointerdown', e => { e.preventDefault(); b._pd = performance.now(); if (inGame() && !G.paused) fn(); });
  b.addEventListener('click', e => { if (e.detail === 0 && performance.now() - (b._pd || 0) > 600 && inGame() && !G.paused) fn(); });
}

export function initInput(){
  addEventListener('keydown', e => {
    if (!inGame()) return;
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k)) e.preventDefault();
    keys.add(k);
    if (e.repeat) return;
    if (k === 'Tab') { e.preventDefault(); toggleErrands(); return; }
    if (k === 'Escape' || k === 'KeyP') { togglePause(); return; }
    if (G.paused) return;
    if (k === 'Space') doWarm(); else if (k === 'KeyE') doPen(); else if (k === 'KeyQ') doUnping(); else if (k === 'KeyF') doSit();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden && inGame() && G.mode === 'solo' && !G.paused) togglePause(true); });
  bindAb('#abWarm', doWarm); bindAb('#abPen', doPen); bindAb('#abUnp', doUnping); bindAb('#abSit', doSit);
  $('#btnPause').addEventListener('click', () => togglePause());
  $('#btnResume').addEventListener('click', () => togglePause());
  $('#btnQuit').addEventListener('click', () => { if (G && !G.over) endMatch('quit'); });

  cv.addEventListener('pointerdown', e => {
    if (!inGame() || G.paused) return;
    const r = cv.getBoundingClientRect(), lx = e.clientX - r.left, ly = e.clientY - r.top;
    e.preventDefault();
    if (e.pointerType !== 'mouse' && lx < r.width * 0.45) {
      if (joy.active) return;
      joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      joyEl.style.left = (lx - 45) + 'px'; joyEl.style.top = (ly - 45) + 'px'; knob.style.transform = ''; joyEl.classList.add('on');
      return;
    }
    const f = floorAt(e.clientX, e.clientY); doToss(f.x, f.y);
  });
  cv.addEventListener('pointermove', e => {
    if (joy.active && e.pointerId === joy.id) {
      let dx = (e.clientX - joy.ox) / 38, dy = (e.clientY - joy.oy) / 38; const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 28}px,${dy * 28}px)`;
      return;
    }
    if (e.pointerType === 'mouse') { const f = floorAt(e.clientX, e.clientY); mouse.in = true; mouse.x = f.x; mouse.y = f.y; }
  });
  const endJoy = e => { if (joy.active && e.pointerId === joy.id) hideJoystick(); };
  cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse.in = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
