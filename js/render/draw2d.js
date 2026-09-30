// The 2D layer. With 3D on, it's the glass floor you look up through plus everything drawn on it
// (the Point, glances, names, bubbles). Without 3D, it draws the whole room flat.
import { WALL, CONE, MAPS, MY_RANGE, MY_NOTICE_TIME, KID_RANGE, rangeOf } from '../data.js';
import { TAU, FONT, clamp, rand, isTouch, reduceMotion } from '../util.js';
import { W, H, MAP_ID, CHAIRS, OBST, TALL, rayHit, lightMul } from '../layout.js';
import { acct } from '../account.js';
import { col, sh } from '../theme.js';
import { MP } from '../multiplayer.js';
import { G, mouse } from '../game/state.js';
import { otherName } from '../game/feedback.js';
import { cv, ctx, scale, dpr } from './canvas.js';
import { V } from './view3d.js';

function rr(c, x, y, w, h, r){
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function mirrorText(c, text, x, y, size, alpha){
  c.save(); c.translate(x, y); c.scale(-1, 1);
  c.font = `800 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = `rgba(${col.shade},${alpha})`; c.fillText(text, 0, 0); c.restore();
}

function drawObstacle(c, o){
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, dot = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  switch (o.kind) {
    case 'desk': {
      c.fillStyle = sh(0.16); rr(c, o.x, o.y, o.w, o.h, 4); c.fill();
      c.fillStyle = sh(0.55);
      [[o.x + 6, o.y + 4], [o.x + o.w - 14, o.y + 4], [o.x + 6, o.y + o.h - 12], [o.x + o.w - 14, o.y + o.h - 12]].forEach(([x, y]) => c.fillRect(x, y, 8, 8));
      mirrorText(c, `NOW SERVING: ${G && G.world.served ? G.world.served : '\u2014'}`, cx, cy + 2, 13, G && G.world.evt && G.world.evt.k === 'call' ? 0.55 : 0.24);
      break;
    }
    case 'plant': c.fillStyle = sh(0.07); dot(cx, cy, 44); c.fillStyle = sh(0.4); dot(cx, cy, 16); break;
    case 'cooler': c.fillStyle = sh(0.1); rr(c, o.x, o.y, o.w, o.h, 6); c.fill(); c.fillStyle = sh(0.42); rr(c, o.x + 6, o.y + 6, o.w - 12, o.h - 12, 4); c.fill(); break;
    case 'kiosk':
      c.fillStyle = sh(0.12); rr(c, o.x - 5, o.y - 5, o.w + 10, o.h + 10, 7); c.fill();
      c.fillStyle = sh(0.46); rr(c, o.x, o.y, o.w, o.h, 4); c.fill();
      c.fillStyle = `rgba(${col.glow},.55)`; c.fillRect(o.x + 6, o.y + o.h - 5, o.w - 12, 3);
      break;
    case 'tank': {
      c.fillStyle = sh(0.5); [[o.x, o.y], [o.x + o.w - 8, o.y], [o.x, o.y + o.h - 8], [o.x + o.w - 8, o.y + o.h - 8]].forEach(([x, y]) => c.fillRect(x, y, 8, 8));
      c.fillStyle = 'rgba(70,140,180,.34)'; rr(c, o.x + 3, o.y + 3, o.w - 6, o.h - 6, 6); c.fill();
      c.strokeStyle = 'rgba(40,90,130,.6)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = 0; k < 6; k++) {
        const t = G ? G.t : 0, along = o.w > o.h;
        const u = ((k * 0.37 + t * 0.07) % 1), v = 0.25 + 0.5 * ((k * 0.61) % 1);
        dot(along ? o.x + 8 + u * (o.w - 16) : o.x + v * o.w, along ? o.y + v * o.h : o.y + 8 + u * (o.h - 16), 2 + (k % 3));
      }
      break;
    }
    case 'row': {
      c.fillStyle = sh(0.1); rr(c, o.x, o.y, o.w, o.h, 4); c.fill();
      c.strokeStyle = sh(0.18); c.lineWidth = 1.5; c.beginPath(); c.moveTo(o.x + 4, cy); c.lineTo(o.x + o.w - 4, cy); c.stroke();
      c.fillStyle = sh(0.5);
      for (let x = o.x + 8; x < o.x + o.w; x += 38) { dot(x, o.y + 4, 2.4); dot(x, o.y + o.h - 4, 2.4); }
      break;
    }
    case 'washers': {
      const along = o.w > o.h, unit = along ? o.h : o.w, count = Math.max(1, Math.floor((along ? o.w : o.h) / unit));
      const step = (along ? o.w : o.h) / count;
      for (let k = 0; k < count; k++) {
        const x = along ? o.x + k * step : o.x, y = along ? o.y : o.y + k * step, s = along ? step : unit, t = along ? unit : step;
        c.fillStyle = sh(0.32); rr(c, x + 2, y + 2, s - 4, t - 4, 5); c.fill();
        c.strokeStyle = sh(0.55); c.lineWidth = 2; c.beginPath(); c.arc(x + s / 2, y + t / 2, Math.min(s, t) * 0.28, 0, TAU); c.stroke();
      }
      break;
    }
    case 'rope': {
      // Seen from below: the base of each post, and the rope's shadow between them.
      const n = Math.max(1, Math.round(o.w / 68));
      c.strokeStyle = sh(0.2); c.lineWidth = 3; c.beginPath(); c.moveTo(o.x, cy); c.lineTo(o.x + o.w, cy); c.stroke();
      for (let k = 0; k <= n; k++) { c.fillStyle = sh(0.12); dot(o.x + o.w * k / n, cy, 9); c.fillStyle = sh(0.5); dot(o.x + o.w * k / n, cy, 4); }
      break;
    }
    case 'poboxes':
      c.fillStyle = sh(0.34); rr(c, o.x, o.y, o.w, o.h, 3); c.fill();
      c.strokeStyle = sh(0.5); c.lineWidth = 1; c.beginPath();
      for (let y = o.y + 14; y < o.y + o.h; y += 14) { c.moveTo(o.x + 3, y); c.lineTo(o.x + o.w - 3, y); }
      c.moveTo(cx, o.y + 3); c.lineTo(cx, o.y + o.h - 3); c.stroke();
      break;
    case 'table':
      c.fillStyle = sh(0.13); rr(c, o.x, o.y, o.w, o.h, 3); c.fill();
      c.fillStyle = sh(0.5); [[o.x + 3, o.y + 3], [o.x + o.w - 9, o.y + 3], [o.x + 3, o.y + o.h - 9], [o.x + o.w - 9, o.y + o.h - 9]].forEach(([x, y]) => c.fillRect(x, y, 6, 6));
      break;
  }
}
// With 3D on, the canvas on top is the glass floor you look up through: a light tint,
// tile seams and backwards writing. Everything standing on it is drawn by Babylon.js behind.
function drawGlass(c, fl){
  const m = MAPS[MAP_ID];
  c.fillStyle = `rgba(${V.floorRgb},0.3)`;
  c.fillRect(WALL, WALL, W - 2 * WALL, H - 2 * WALL); c.fillRect(70, H - WALL, 70, WALL);
  c.strokeStyle = `rgba(${V.lineRgb},0.55)`; c.lineWidth = 1; c.beginPath();
  for (let x = WALL; x <= W - WALL; x += 53.5) { c.moveTo(x, WALL); c.lineTo(x, H - WALL); }
  for (let y = WALL; y <= H - WALL; y += 53.5) { c.moveTo(WALL, y); c.lineTo(W - WALL, y); }
  c.stroke();
  const g = c.createRadialGradient(W / 2, H / 2 - 10, 10, W / 2, H / 2 - 10, Math.max(W, H) * 0.5);
  g.addColorStop(0, `rgba(${col.glow},${0.22 * fl})`); g.addColorStop(1, `rgba(${col.glow},0)`);
  c.fillStyle = g; c.fillRect(WALL, WALL, W - 2 * WALL, H - 2 * WALL);
  mirrorText(c, m.floor, W / 2, H * 0.36, Math.min(24, (W - 120) / (m.floor.length * 0.62)), 0.16);
  mirrorText(c, m.sign, W / 2, 140, 13, 0.22);
  c.strokeStyle = sh(0.14); c.lineWidth = 2; c.strokeRect(W / 2 - 50, 126, 100, 28);
  mirrorText(c, 'EXIT', 105, H - 102, 16, 0.2);
}
function shadowAt(c, x, y){
  const g = c.createRadialGradient(x, y, 2, x, y, 22);
  g.addColorStop(0, sh(0.22)); g.addColorStop(1, sh(0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill();
}
function drawRoom(c, fl){
  const m = MAPS[MAP_ID];
  c.fillStyle = col.floor; c.fillRect(0, 0, W, H);
  c.strokeStyle = col.line; c.lineWidth = 1; c.beginPath();
  for (let x = WALL; x <= W - WALL; x += 53.5) { c.moveTo(x, WALL); c.lineTo(x, H - WALL); }
  for (let y = WALL; y <= H - WALL; y += 53.5) { c.moveTo(WALL, y); c.lineTo(W - WALL, y); }
  c.stroke();
  const g = c.createRadialGradient(W / 2, H / 2 - 10, 10, W / 2, H / 2 - 10, Math.max(W, H) * 0.51);
  g.addColorStop(0, `rgba(${col.glow},${0.6 * fl})`); g.addColorStop(0.55, `rgba(${col.glow},${0.16 * fl})`); g.addColorStop(1, `rgba(${col.glow},0)`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.shadowColor = `rgba(${col.glow},${0.9 * fl})`; c.shadowBlur = 34; c.fillStyle = `rgba(${col.glow},${0.32 * fl})`;
  rr(c, W / 2 - 130, H / 2 - 14, 260, 12, 6); c.fill(); c.restore();
  mirrorText(c, m.floor, W / 2, H * 0.36, Math.min(24, (W - 120) / (m.floor.length * 0.62)), 0.1);
  mirrorText(c, m.sign, W / 2, 140, 13, 0.16);
  c.strokeStyle = sh(0.1); c.lineWidth = 2; c.strokeRect(W / 2 - 50, 126, 100, 28);
  mirrorText(c, 'EXIT', 105, H - 102, 16, 0.14);
  for (const ch of CHAIRS) {
    const s = 30, o = s / 2 - 4;
    c.fillStyle = sh(0.11); rr(c, ch.x - s / 2, ch.y - s / 2, s, s, 4); c.fill();
    c.fillStyle = sh(0.5);
    for (const [dx, dy] of [[-o, -o], [o, -o], [-o, o], [o, o]]) { c.beginPath(); c.arc(ch.x + dx, ch.y + dy, 2.6, 0, TAU); c.fill(); }
  }
  for (const o of OBST) drawObstacle(c, o);
}
function drawWalls(c){
  c.fillStyle = col.wall;
  c.fillRect(0, 0, W, WALL); c.fillRect(0, 0, WALL, H); c.fillRect(W - WALL, 0, WALL, H);
  c.fillRect(0, H - WALL, 70, WALL); c.fillRect(140, H - WALL, W - 140, WALL);
  c.fillStyle = sh(0.18); c.fillRect(70, H - WALL, 70, WALL);
  c.strokeStyle = sh(0.12); c.lineWidth = 6; c.strokeRect(WALL + 3, WALL + 3, W - 2 * WALL - 6, H - 2 * WALL - 6);
}
function drawPoint(c){
  const w = G.world, r = w.point; if (!r || G.me.unpT > 0) return;
  const pulse = G.me.inPoint ? 0.5 + 0.5 * Math.sin(G.t * 8) : 0;
  c.fillStyle = `rgba(${col.dangerRgb},${0.07 + pulse * 0.1})`; rr(c, r.x, r.y, r.w, r.h, 8); c.fill();
  c.setLineDash([9, 7]); c.lineDashOffset = reduceMotion ? 0 : -G.t * 12;
  c.strokeStyle = `rgba(${col.dangerRgb},.6)`; c.lineWidth = 2; rr(c, r.x, r.y, r.w, r.h, 8); c.stroke(); c.setLineDash([]);
  c.textAlign = 'left'; c.textBaseline = 'top';
  c.font = `800 12px ${FONT}`; c.fillStyle = `rgba(${col.dangerRgb},.9)`; c.fillText('The Point', r.x + 9, r.y + 8);
  c.font = `500 11px ${FONT}`; c.fillStyle = `rgba(${col.dangerRgb},.7)`; c.fillText('Please don\u2019t be here', r.x + 9, r.y + 23);
  c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(`Moves in ${Math.max(0, Math.ceil(w.pointT))}`, r.x + r.w - 9, r.y + r.h - 7);
}
function wedge(c, x, y, face, range, rgb, a0){
  range *= lightMul;
  const g = c.createRadialGradient(x, y, 8, x, y, range);
  g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.moveTo(x, y);
  const N = 20;
  for (let k = 0; k <= N; k++) {
    const a = face - CONE + 2 * CONE * k / N, dx = Math.cos(a), dy = Math.sin(a), d = TALL.length ? rayHit(x, y, dx, dy, range) : range;
    c.lineTo(x + dx * d, y + dy * d);
  }
  c.closePath(); c.fill();
}
function drawFeet(c, x, y, face, step, moving, rgb, alpha, outline, seated){
  c.save(); c.globalAlpha = alpha;
  const g = c.createRadialGradient(x, y, 2, x, y, 25);
  g.addColorStop(0, sh(0.3)); g.addColorStop(1, sh(0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, 25, 0, TAU); c.fill();
  c.translate(x, y); c.rotate(face);
  const s = moving ? Math.sin(step) * 4 : 0;
  for (const side of [-1, 1]) {
    c.save(); c.translate(side * s + (seated ? 3 : 0), side * (seated ? 4.2 : 6.5));
    c.beginPath(); c.ellipse(3, 0, 6.6, 4.3, 0, 0, TAU); c.moveTo(-2, 0); c.ellipse(-5.8, 0, 3.8, 3.5, 0, 0, TAU);
    if (outline) { c.strokeStyle = `rgb(${rgb})`; c.lineWidth = 1.4; c.stroke(); }
    else {
      c.fillStyle = `rgb(${rgb})`; c.fill();
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.8; c.beginPath();
      for (let i = -1; i <= 7; i += 2.2) { c.moveTo(i, -2.8); c.lineTo(i, 2.8); }
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}
function drawBubble(c, x, y, b, isPlayer){
  const shown = b.text.slice(0, Math.floor(b.t * 32)); if (!shown) return;
  const a = b.t > b.dur - 0.8 ? Math.max(0, (b.dur - b.t) / 0.8) : 1;
  const fs = clamp(11 / scale * 0.85, 11, 21);
  c.font = `${isPlayer ? 'italic 400' : '600'} ${fs}px ${FONT}`;
  const w = c.measureText(shown).width + fs * 1.2, h = fs * 1.9;
  const bx = clamp(x - w / 2, WALL + 2, W - WALL - 2 - w), by = Math.max(WALL + 2, y - 30 - h);
  c.save(); c.globalAlpha = a;
  c.fillStyle = col.panel; rr(c, bx, by, w, h, h / 2); c.fill();
  c.strokeStyle = sh(0.25); c.lineWidth = 1; c.stroke();
  if (isPlayer) {
    const gr = c.createLinearGradient(bx, 0, bx + w, 0);
    gr.addColorStop(0, `rgba(${col.inkRgb},1)`); gr.addColorStop(1, `rgba(${col.inkRgb},.3)`);
    c.fillStyle = gr;
  } else c.fillStyle = col.ink;
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, bx + fs * 0.6, by + h / 2 + 1);
  c.restore();
}
function ring(c, x, y, frac, rgb){
  c.strokeStyle = `rgb(${rgb})`; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, frac)); c.stroke(); c.lineCap = 'butt';
}

const GHOST = '180,172,150';   // what people look like while they're unnoticeable

function drawPhone(c, ev){
  c.fillStyle = `rgba(${col.dangerRgb},.08)`; c.beginPath(); c.arc(ev.x, ev.y, 80, 0, TAU); c.fill();
  for (let k = 0; k < 3; k++) {
    const ph = reduceMotion ? k / 3 : (G.t * 1.3 + k / 3) % 1;
    c.strokeStyle = `rgba(${col.dangerRgb},${0.55 * (1 - ph)})`; c.lineWidth = 2; c.beginPath(); c.arc(ev.x, ev.y, 10 + ph * 70, 0, TAU); c.stroke();
  }
  c.fillStyle = col.ink; rr(c, ev.x - 6, ev.y - 10, 12, 20, 3); c.fill();
}
function drawLitter(c){
  for (const l of G.litter) {
    c.save(); c.translate(l.x, l.y); c.rotate(l.r);
    if (l.kind === 'cup') { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 4.5, 0, TAU); c.stroke(); }
    else { c.fillStyle = 'rgba(255,253,246,.9)'; c.fillRect(-3.5, -5, 7, 10); c.strokeStyle = sh(0.25); c.lineWidth = 0.7; c.strokeRect(-3.5, -5, 7, 10); }
    c.restore();
  }
}
function drawGlances(c, others){
  for (const n of G.world.npcs) {
    if (n.state === 'notice' || n.state === 'chat' || n.cool > 0) continue;
    const warn = Math.min(1, n.lg / 0.75);
    if (warn > 0) wedge(c, n.rx, n.ry, n.rf, n.gazeRange, col.dangerRgb, 0.22 + warn * 0.3);
    else wedge(c, n.rx, n.ry, n.rf, n.gazeRange, col.cone, 0.42);
  }
  for (const o of others) wedge(c, o.rx, o.ry, o.rf, rangeOf(o.z), o.rgb, o.bl ? 0.1 : 0.22);
  const p = G.me, blended = p.blendT > 0;
  c.save(); c.setLineDash(blended ? [2, 5] : [5, 4]); c.lineDashOffset = reduceMotion ? 0 : G.t * 6;
  c.strokeStyle = `rgba(${G.rgb},${blended ? 0.35 : 0.75})`; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 19, 0, TAU); c.stroke(); c.restore();
  if (p.warm) { c.strokeStyle = col.amber; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 23, -Math.PI / 2, -Math.PI / 2 + TAU * p.warm.t / (G.z.warmTime || 3)); c.stroke(); }
  wedge(c, p.x, p.y, p.face, MY_RANGE * (G.z.gazeMul || 1), G.rgb, blended ? 0.18 : 0.32);
}
// Flat mode draws shoe soles; with 3D the people are real, so just their shadows on the glass.
function drawPeople(c, others, flat){
  const p = G.me, npcs = G.world.npcs, blended = p.blendT > 0;
  if (flat) {
    for (const n of npcs) drawFeet(c, n.rx, n.ry, n.rf, n.step, n.state === 'walk', n.bl > 0 ? GHOST : n.rgb, n.bl > 0 ? 0.3 : 1, false, n.seated && n.state === 'wait');
    for (const o of others) drawFeet(c, o.rx, o.ry, o.rf, o.step, o.mv, o.bl ? GHOST : o.rgb, o.bl ? 0.3 : 1, o.outline, o.si);
  } else {
    for (const n of npcs) if (n.bl <= 0) shadowAt(c, n.rx, n.ry);
    for (const o of others) if (!o.bl) shadowAt(c, o.rx, o.ry);
  }
  // Rings show how close you are to noticing each person.
  const need = MY_NOTICE_TIME * (G.z.noticeMul || 1);
  for (const n of npcs) if (n.pg > 0.02) ring(c, n.rx, n.ry, n.pg / need, G.rgb);
  for (const o of others) if (o.pg > 0.02) ring(c, o.rx, o.ry, o.pg / need, G.rgb);
  if (flat) drawFeet(c, p.x, p.y, p.face, p.step, p.moving, blended ? GHOST : G.rgb, blended ? 0.3 : 1, G.outline, p.seated);
  else if (!blended) shadowAt(c, p.x, p.y);
  if (p.rising) { c.strokeStyle = col.muted; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 23, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.rising)); c.stroke(); }
}
function drawNames(c, others){
  const p = G.me, nfs = clamp(10 / scale * 0.72, 10, 17);
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (const n of G.world.npcs) {
    c.font = `600 ${nfs}px ${FONT}`; c.fillStyle = sh(n.fluster > 0 ? 0.35 : 0.6);
    c.fillText(n.bl > 0 ? `${n.name} (unnoticeable)` : `${n.name} ${Math.floor(n.score)}`, n.rx, n.ry + 24);
    // A question mark grows while they're about to notice you.
    if (n.lg > 0.05 && n.state !== 'notice') {
      const f = Math.min(1, n.lg / 0.75);
      c.font = `900 ${12 + f * 10}px ${FONT}`; c.fillStyle = `rgba(${col.dangerRgb},${0.4 + f * 0.6})`; c.textBaseline = 'bottom';
      c.fillText('?', n.rx, n.ry - 20); c.textBaseline = 'top';
    }
  }
  for (const o of others) {
    c.font = `700 ${nfs}px ${FONT}`; c.fillStyle = `rgba(${o.rgb},.95)`;
    c.fillText(`${otherName(o.id)} ${Math.floor(o.sc)}`, o.rx, o.ry + 24);
  }
  const myName = G.mode === 'solo' ? acct.name : (MP && MP.nick) || acct.name;
  c.font = `700 ${nfs}px ${FONT}`; c.fillStyle = `rgba(${G.rgb},.9)`;
  c.fillText(p.blendT > 0 ? `${myName} (unnoticeable)` : p.called ? `${myName} (number ${G.world.evt.no})` : p.seated ? `${myName} (sitting)` : `${myName} (you)`, p.x, p.y + 24);
}
// The kid: a small, very alert pair of shoes that light up, and a glance nobody wants to be in.
function drawKid(c, kid, flat){
  if (kid.rx == null) return;
  wedge(c, kid.rx, kid.ry, kid.rf, KID_RANGE, col.dangerRgb, kid.chase ? 0.12 : 0.34);
  if (flat) {
    c.save(); c.translate(kid.rx, kid.ry); c.scale(0.6, 0.6);
    drawFeet(c, 0, 0, kid.rf, kid.step || 0, true, '240,200,70', 1, false, false);
    c.restore();
  } else shadowAt(c, kid.rx, kid.ry);
  const blink = reduceMotion || Math.sin(G.t * 14) > 0;
  if (blink) { c.fillStyle = 'rgba(255,90,60,.8)'; c.beginPath(); c.arc(kid.rx, kid.ry, 3, 0, TAU); c.fill(); }
  c.font = `700 ${clamp(10 / scale * 0.72, 10, 17)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillStyle = `rgba(${col.dangerRgb},.85)`; c.fillText(kid.chase ? 'a kid (busy)' : 'a kid', kid.rx, kid.ry + 16);
}
function drawFlying(c){
  for (const f of G.flying) {
    const u = f.t / f.dur, x = f.sx + (f.tx - f.sx) * u, y = f.sy + (f.ty - f.sy) * u, h = Math.sin(Math.PI * u), s = 1 - 0.5 * h;
    c.save(); c.translate(x, y); c.rotate(f.r + u * 6); c.scale(s, s); c.globalAlpha = 1 - 0.55 * h;
    c.fillStyle = 'rgba(255,253,246,.95)'; c.fillRect(-3.5, -5, 7, 10); c.restore();
  }
}
// The toss crosshair, and a circle around whoever you'd be aiming near.
function drawAim(c, others){
  const p = G.me;
  let dx = mouse.x - p.x, dy = mouse.y - p.y; const d = Math.hypot(dx, dy);
  if (d > 230) { dx *= 230 / d; dy *= 230 / d; }
  const ax = p.x + dx, ay = p.y + dy;
  let near = null, nd = 70;
  for (const n of G.world.npcs) { const e = Math.hypot(n.rx - ax, n.ry - ay); if (e < nd) { nd = e; near = {x:n.rx, y:n.ry}; } }
  for (const o of others) { const e = Math.hypot(o.rx - ax, o.ry - ay); if (e < nd) { nd = e; near = {x:o.rx, y:o.ry}; } }
  if (near) {
    c.save(); c.setLineDash([4, 4]); c.strokeStyle = `rgba(${col.calmRgb},.8)`; c.lineWidth = 1.5;
    c.beginPath(); c.arc(near.x, near.y, 44, 0, TAU); c.stroke(); c.setLineDash([]);
    c.fillStyle = `rgba(${col.dangerRgb},.14)`; c.beginPath(); c.arc(near.x, near.y, 13, 0, TAU); c.fill(); c.restore();
  }
  c.save(); c.globalAlpha = p.tossCd > 0 ? 0.35 : 0.8;
  c.strokeStyle = col.ink; c.lineWidth = 1.5; c.beginPath(); c.arc(ax, ay, 6, 0, TAU); c.stroke();
  c.beginPath();
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(ax + ux * 9, ay + uy * 9); c.lineTo(ax + ux * 14, ay + uy * 14); }
  c.stroke(); c.restore();
}
function drawFloats(c){
  const ffs = clamp(12 / scale * 0.8, 12, 22);
  for (const f of G.floats) {
    c.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    c.font = `800 ${ffs}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = f.kind === 'bad' ? col.danger : f.kind === 'good' ? col.calm : col.muted;
    c.fillText(f.text, f.x, f.y - f.t * 22);
  }
  c.globalAlpha = 1;
}
// Vignette, plus a red pulse at the edges when Excitement is high.
function drawVignette(c){
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.43, W / 2, H / 2, Math.max(W, H) * 0.64);
  v.addColorStop(0, sh(0)); v.addColorStop(1, sh(0.3)); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const exc = G.world.exc;
  if (exc > 70) {
    const a = (exc - 70) / 30 * (reduceMotion ? 0.7 : 0.5 + 0.5 * Math.sin(G.t * 10));
    const rv = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.62);
    rv.addColorStop(0, `rgba(${col.dangerRgb},0)`); rv.addColorStop(1, `rgba(${col.dangerRgb},${0.4 * a})`);
    c.fillStyle = rv; c.fillRect(0, 0, W, H);
  }
}

export function render(){
  const c = ctx, p = G.me, flat = !V.ok;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const ev = G.world.evt, darkNow = !!(ev && ev.k === 'dark');
  const fl = darkNow ? 0.04 : G.flicker > 0 ? (Math.random() < 0.5 ? 0.3 : 0.75) : 1;
  if (flat) drawRoom(c, fl); else drawGlass(c, fl);
  drawPoint(c);
  if (ev && ev.k === 'phone') drawPhone(c, ev);
  drawLitter(c);
  if (darkNow) { c.fillStyle = flat ? 'rgba(10,10,16,.55)' : 'rgba(10,10,16,.3)'; c.fillRect(0, 0, W, H); }
  const others = [...G.others.values()].filter(o => !o.gone && !o.done);
  drawGlances(c, others);
  drawPeople(c, others, flat);
  drawNames(c, others);
  if (ev && ev.k === 'kid') drawKid(c, ev, flat);
  drawFlying(c);
  if (mouse.in && !isTouch && !G.paused) drawAim(c, others);
  if (flat) drawWalls(c);
  for (const n of G.world.npcs) if (n.bubble) drawBubble(c, n.rx, n.ry, n.bubble, false);
  for (const o of others) if (o.bubble) drawBubble(c, o.rx, o.ry, o.bubble, true);
  if (p.bubble) drawBubble(c, p.x, p.y, p.bubble, true);
  drawFloats(c);
  drawVignette(c);
  if (G.flicker > 0 && flat) { c.fillStyle = sh(rand(0.04, 0.15)); c.fillRect(0, 0, W, H); }
}
