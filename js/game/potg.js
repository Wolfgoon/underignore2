// Pause of the Game: a picture of your longest stillness, replayed on the end screen.
import { fullName } from '../data.js';
import { $ } from '../util.js';
import { SNAP_W, SNAP_H } from '../layout.js';
import { acct } from '../account.js';
import { G } from './state.js';
import { cv } from '../render/canvas.js';
import { V, cv3 } from '../render/view3d.js';

let snapBest = document.createElement('canvas'), snapCur = document.createElement('canvas');
let potgRaf = 0;

export function resetSnaps(){ [snapBest, snapCur].forEach(c => { c.width = SNAP_W; c.height = SNAP_H; }); }

export function startStill(){ G.still.active = true; G.still.start = G.t; G.still.pending = true; }
export function endStill(){
  if (!G.still.active) return;
  const d = G.t - G.still.start;
  if (d > G.still.best) { G.still.best = d; [snapBest, snapCur] = [snapCur, snapBest]; }
  G.still.active = false;
}
// Reading back the 3D canvas is slow, so this only runs once someone has stood still for a moment.
export function captureSnap(){
  const c = snapCur.getContext('2d'); c.clearRect(0, 0, SNAP_W, SNAP_H);
  if (V.ok) c.drawImage(cv3, 0, 0, cv3.width, cv3.height, 0, 0, SNAP_W, SNAP_H);
  c.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, SNAP_W, SNAP_H);
}

export function runPotg(z){
  const pcv = $('#potg'); pcv.width = SNAP_W; pcv.height = SNAP_H;
  const pc = pcv.getContext('2d');
  pc.clearRect(0, 0, SNAP_W, SNAP_H); pc.drawImage(snapBest, 0, 0, SNAP_W, SNAP_H);
  const best = Math.max(0.1, G.still.best), speed = best > 15 ? best / 15 : 1, start = performance.now();
  $('#potgCap').textContent = `${fullName(acct.name, z)}, standing there for ${best.toFixed(1)} seconds while nothing happened.`;
  cancelAnimationFrame(potgRaf);
  const tEl = $('#potgTime'), bar = $('#potgBar');
  const tick = now => {
    const el = Math.min(best, (now - start) / 1000 * speed);
    tEl.textContent = el.toFixed(1) + 's'; bar.style.width = (el / best * 100) + '%';
    if (el < best) potgRaf = requestAnimationFrame(tick);
    else tEl.textContent = best.toFixed(1) + 's, nothing happened';
  };
  potgRaf = requestAnimationFrame(tick);
}
export const stopPotg = () => cancelAnimationFrame(potgRaf);
