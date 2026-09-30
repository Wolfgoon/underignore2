// The room itself: its size, furniture, chairs and spots to stand, plus the geometry
// everyone uses for walking and glancing. Solid things block walking; tall things also block glances.
import { WALL, CONE, MAPS } from './data.js';
import { angDiff } from './util.js';

export let W = 900, H = 600, SNAP_W = 600, SNAP_H = 400;
export let MAP_ID = 'dmv';
export let CHAIRS = [], OBST = [], SPOTS = [], SEATS = [], TALL = [], INFL = [], SPAWN = {x:105, y:540};

// Glances are shorter while the lights are out.
export let lightMul = 1;
export const setDark = dark => { lightMul = dark ? 0.45 : 1; };

// Rooms are built wide on computers and tall on phones. In a shared room the host's shape wins.
export function buildLayout(mapId, portrait){
  MAP_ID = MAPS[mapId] ? mapId : 'dmv';
  W = portrait ? 600 : 900; H = portrait ? 900 : 600;
  SNAP_W = portrait ? 400 : 600; SNAP_H = portrait ? 600 : 400;
  CHAIRS = []; OBST = []; SPOTS = [];
  const ob = (kind, x, y, w, h, tall, solid = true) => OBST.push({kind, x, y, w, h, tall, solid});
  const wallChairs = sides => {
    if (sides) for (let y = 170; y <= H - 200; y += 45) CHAIRS.push({x:42, y, sx:78, sy:y, face:0});
    if (sides) for (let y = 170; y <= H - 245; y += 45) CHAIRS.push({x:W - 42, y, sx:W - 78, sy:y, face:Math.PI});
    for (let x = 250; x <= W - 120; x += 45) { if (!portrait && Math.abs(x - W / 2) < 40) continue; CHAIRS.push({x, y:H - 42, sx:x, sy:H - 78, face:-Math.PI / 2}); }
  };
  OBST.push({kind:'desk', x:W / 2 - 110, y:WALL, w:220, h:56, tall:false, solid:true});
  SPOTS.push({x:W / 2, y:104, face:-Math.PI / 2});
  if (MAP_ID === 'dmv') {
    wallChairs(true);
    ob('plant', 57, 57, 30, 30, true); ob('cooler', W - 88, 50, 40, 40, true);
    SPOTS.push({x:W - 100, y:104, face:Math.atan2(-34, 32)});
    const ky = portrait ? H * 0.55 : H * 0.6;
    for (const kx of portrait ? [W * 0.3, W * 0.7] : [W * 0.33, W * 0.67]) {
      ob('kiosk', kx - 17, ky - 17, 34, 34, true);
      SPOTS.push({x:kx, y:ky + 40, face:-Math.PI / 2});
    }
  } else if (MAP_ID === 'dentist') {
    wallChairs(true);
    ob('plant', 57, 57, 30, 30, true); ob('plant', W - 87, 57, 30, 30, true);
    if (portrait) ob('tank', W / 2 - 22, H * 0.45 - 70, 44, 140, true); else ob('tank', W / 2 - 70, H * 0.47 - 22, 140, 44, true);
    const rows = portrait ? [{x:W / 2 - 80, y:H * 0.24, w:160, h:34}, {x:W / 2 - 80, y:H * 0.66, w:160, h:34}]
                          : [{x:W * 0.14, y:H * 0.47 - 17, w:150, h:34}, {x:W * 0.86 - 150, y:H * 0.47 - 17, w:150, h:34}];
    for (const r of rows) {
      ob('row', r.x, r.y, r.w, r.h, false);
      for (let x = r.x + 20; x < r.x + r.w - 10; x += 38) { SPOTS.push({x, y:r.y - 16, face:-Math.PI / 2, seat:true}); SPOTS.push({x, y:r.y + r.h + 16, face:Math.PI / 2, seat:true}); }
    }
  } else if (MAP_ID === 'postoffice') {
    // Rope lanes zig-zag in front of the counter, and a wall of PO boxes blocks glances on the right.
    wallChairs(false);
    ob('plant', 57, 57, 30, 30, true);
    ob('poboxes', W - WALL - 34, 130, 30, H - (portrait ? 360 : 300), true);
    ob('kiosk', W * 0.25 - 17, H * 0.62 - 17, 34, 34, true);
    SPOTS.push({x:W * 0.25, y:H * 0.62 + 40, face:-Math.PI / 2});
    const lanes = [{y:185, x0:W / 2 - 200, x1:W / 2 + 140}, {y:245, x0:W / 2 - 140, x1:W / 2 + 200}];
    for (const l of lanes) ob('rope', l.x0, l.y - 3, l.x1 - l.x0, 6, false);
    // Standing in line, facing the counter.
    for (const y of [155, 215, 275]) for (let x = W / 2 - 150; x <= W / 2 + 150; x += 60) SPOTS.push({x, y, face:-Math.PI / 2});
  } else {
    wallChairs(false);
    const top = 110, bot = H - 130;
    ob('washers', WALL + 4, top, 42, bot - top, true); ob('washers', W - WALL - 46, top, 42, bot - top, true);
    for (let y = top + 21; y < bot - 10; y += 48) { SPOTS.push({x:WALL + 64, y, face:0}); SPOTS.push({x:W - WALL - 64, y, face:Math.PI}); }
    if (portrait) { ob('washers', W / 2 - 24, H * 0.5 - 120, 48, 240, true); ob('table', W * 0.22 - 18, H * 0.28, 36, 110, false); }
    else { ob('washers', W / 2 - 120, H * 0.5 - 24, 240, 48, true); ob('table', W / 2 - 80, H * 0.5 + 72, 160, 34, false); }
  }
  for (const c of CHAIRS) SPOTS.push({x:c.x, y:c.y, face:c.face, seat:true});
  SEATS = SPOTS.filter(sp => sp.seat);
  SPAWN = {x:105, y:H - 60};
  TALL = OBST.filter(o => o.tall);
  INFL = OBST.filter(o => o.solid).map(o => ({x:o.x - 10, y:o.y - 10, w:o.w + 20, h:o.h + 20}));
}
// Distance along a ray to a rectangle, or null if it misses.
export function raySlab(x, y, dx, dy, o){
  let t0 = 0, t1 = Infinity;
  if (Math.abs(dx) < 1e-9) { if (x < o.x || x > o.x + o.w) return null; }
  else { let a = (o.x - x) / dx, b = (o.x + o.w - x) / dx; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  if (Math.abs(dy) < 1e-9) { if (y < o.y || y > o.y + o.h) return null; }
  else { let a = (o.y - y) / dy, b = (o.y + o.h - y) / dy; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  return t0 <= t1 ? t0 : null;
}
export function rayHit(x, y, dx, dy, maxD){
  let best = maxD;
  for (const o of TALL) { const t = raySlab(x, y, dx, dy, o); if (t !== null && t < best) best = t; }
  return best;
}
export function blocked(x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d < 1 || !TALL.length) return false;
  return rayHit(x1, y1, dx / d, dy / d, d) < d - 1;
}
export const insideSolid = (x, y, m) => OBST.some(o => o.solid && x > o.x - m && x < o.x + o.w + m && y > o.y - m && y < o.y + o.h + m);
export function pathClear(x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  for (const o of INFL) { const t = raySlab(x1, y1, dx / d, dy / d, o); if (t !== null && t < d) return false; }
  return true;
}
export function pushOut(e, rad){
  for (const o of OBST) {
    if (!o.solid) continue;
    const x0 = o.x - rad, x1 = o.x + o.w + rad, y0 = o.y - rad, y1 = o.y + o.h + rad;
    if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) {
      const pl = e.x - x0, pr = x1 - e.x, pt = e.y - y0, pb = y1 - e.y, m = Math.min(pl, pr, pt, pb);
      if (m === pl) e.x = x0; else if (m === pr) e.x = x1; else if (m === pt) e.y = y0; else e.y = y1;
    }
  }
}
export const inRect = (r, x, y, m = 0) => !!r && x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
// Whether someone at a, facing a.face, can see the point (x, y).
export function sees(a, x, y, range){
  const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy);
  return d < range * lightMul && Math.abs(angDiff(Math.atan2(dy, dx), a.face)) < CONE && !blocked(a.x, a.y, x, y);
}

buildLayout('dmv', false);
