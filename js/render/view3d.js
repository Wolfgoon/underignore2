// The 3D layer: everything above the glass floor, drawn with Babylon.js (loaded from a CDN).
// The camera sits under the glass, looking straight up. Screen right is +X and screen down is +Z,
// so the room lines up exactly with the 2D glass layer drawn on top of it.
import { ZEROES, WALL } from '../data.js';
import { $, clamp, rgbArr, hexRgb, mixRgb, hashStr } from '../util.js';
import { W, H, CHAIRS, OBST } from '../layout.js';
import { acct } from '../account.js';
import { col } from '../theme.js';
import { G } from '../game/state.js';
import { dpr } from './canvas.js';

export const cv3 = $('#cv3');
export const V = { engine:null, scene:null, cam:null, hemi:null, bulb:null, M:null, room:[], people:new Map(), mats:new Map(), ok:false, failed:false, warned:false, floorRgb:'212,201,174', lineRgb:'198,186,156' };
export function babylonReady(timeout){
  return new Promise(resolve => {
    const t0 = Date.now();
    const check = () => { if (window.BABYLON && BABYLON.Engine) resolve(true); else if (Date.now() - t0 > timeout) resolve(false); else setTimeout(check, 100); };
    check();
  });
}
const SKINS = ['236,204,178','224,188,156','196,148,112','158,110,78','110,76,54'];
function vMat(rgb, o = {}){
  const key = rgb + '|' + (o.alpha ?? '') + '|' + (o.emissive ?? '') + '|' + (o.cull === false ? 0 : 1);
  let m = V.mats.get(key); if (m) return m;
  const B = BABYLON, [r, g, b] = rgbArr(rgb);
  m = new B.StandardMaterial('mat' + V.mats.size, V.scene);
  m.diffuseColor = new B.Color3(r, g, b); m.specularColor = new B.Color3(0.04, 0.04, 0.04);
  if (o.emissive) m.emissiveColor = new B.Color3(r * o.emissive, g * o.emissive, b * o.emissive);
  if (o.alpha != null) m.alpha = o.alpha;
  if (o.cull === false) m.backFaceCulling = false;
  V.mats.set(key, m); return m;
}
export function initView(){
  if (V.engine) return true;
  if (!window.BABYLON || V.failed) return false;
  try {
    const B = BABYLON;
    V.engine = new B.Engine(cv3, true, {preserveDrawingBuffer:true, stencil:false, antialias:true}, false);
    V.engine.setHardwareScalingLevel(1 / dpr);
    V.scene = new B.Scene(V.engine);
    V.scene.skipPointerMovePicking = true;
    V.scene.clearColor = new B.Color4(0.16, 0.15, 0.13, 1);
    V.scene.ambientColor = new B.Color3(0.25, 0.24, 0.22);
    V.cam = new B.FreeCamera('cam', new B.Vector3(W / 2, -600, H / 2), V.scene);
    V.cam.rotation.set(-Math.PI / 2, 0, 0);   // straight up; the camera's up ends up pointing at -Z
    V.cam.fovMode = B.Camera.FOVMODE_VERTICAL_FIXED; V.cam.fov = 0.9; V.cam.minZ = 5; V.cam.maxZ = 5000;
    // Light comes from below as well as the ceiling, so the undersides you see aren't in the dark.
    V.hemi = new B.HemisphericLight('under', new B.Vector3(0, -1, 0), V.scene);
    V.hemi.diffuse = new B.Color3(1, 0.98, 0.94); V.hemi.groundColor = new B.Color3(0.5, 0.48, 0.44);
    V.bulb = new B.PointLight('tube', new B.Vector3(W / 2, 150, H / 2), V.scene);
    V.bulb.diffuse = new B.Color3(1, 0.97, 0.9); V.bulb.intensity = 0.5; V.bulb.range = 2000;
    return true;
  } catch (e) { V.failed = true; console.warn('Underignore: 3D setup failed', e); return false; }
}
export function fitCamera(){
  if (!V.cam) return;
  const d = (H / 2) / Math.tan(V.cam.fov / 2);
  V.cam.position.set(W / 2, -d, H / 2);
}
function vBox(name, w, h, d, x, y, z, mat, parent){
  const m = BABYLON.MeshBuilder.CreateBox(name, {width:w, height:h, depth:d}, V.scene);
  m.position.set(x, y, z); m.material = mat; if (parent) m.parent = parent; V.room.push(m); return m;
}
function vCyl(name, diam, h, x, y, z, mat, parent, tess = 14){
  const m = BABYLON.MeshBuilder.CreateCylinder(name, {diameter:diam, height:h, tessellation:tess}, V.scene);
  m.position.set(x, y, z); m.material = mat; if (parent) m.parent = parent; V.room.push(m); return m;
}
function addChair(ch, M){
  const node = new BABYLON.TransformNode('chair', V.scene);
  node.position.set(ch.x, 0, ch.y); node.rotation.y = Math.PI / 2 - ch.face;
  vBox('seat', 30, 4, 30, 0, 24, 0, M.chair, node);
  for (const [sx, sz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) vBox('leg', 3, 22, 3, sx, 11, sz, M.metal, node);
  vBox('back', 30, 30, 4, 0, 41, -14, M.chair, node);
  return node;
}
function addFurniture(o, M){
  const cx = o.x + o.w / 2, cz = o.y + o.h / 2;
  switch (o.kind) {
    case 'desk':
      vBox('desk', o.w, 46, o.h, cx, 23, cz, M.desk);
      vBox('monitor', 40, 28, 6, cx - 50, 60, cz, M.dark); vBox('monitor', 40, 28, 6, cx + 50, 60, cz, M.dark);
      break;
    case 'plant':
      vCyl('pot', 26, 26, cx, 13, cz, M.pot);
      vBox('stem', 4, 30, 4, cx, 40, cz, M.leaf);
      { const leaves = BABYLON.MeshBuilder.CreateSphere('leaves', {diameter:48, segments:6}, V.scene);
        leaves.position.set(cx, 66, cz); leaves.material = M.leaf; V.room.push(leaves); }
      break;
    case 'cooler':
      vBox('cooler', o.w - 6, 72, o.h - 6, cx, 36, cz, M.cooler);
      vCyl('bottle', 24, 34, cx, 90, cz, M.bottle);
      break;
    case 'kiosk':
      vBox('kiosk', o.w, 112, o.h, cx, 56, cz, M.kiosk);
      vBox('screen', o.w - 8, 26, 2, cx, 84, o.y + o.h + 1, M.screen);
      break;
    case 'tank':
      vBox('stand', o.w, 34, o.h, cx, 17, cz, M.wood);
      vBox('water', o.w - 10, 40, o.h - 10, cx, 56, cz, M.water);
      vBox('glass', o.w - 2, 50, o.h - 2, cx, 60, cz, M.glass);
      for (let k = 0; k < 3; k++) vBox('fish', 9, 5, 4, o.x + o.w * (0.25 + 0.25 * k), 52 + (k % 2) * 8, cz + (k - 1) * 4, M.fish);
      break;
    case 'row':
      vBox('bench', o.w, 5, o.h, cx, 24, cz, M.chair);
      vBox('divider', o.w, 30, 4, cx, 41, cz, M.chair);
      for (const lx of [o.x + 6, o.x + o.w - 6]) for (const lz of [o.y + 6, o.y + o.h - 6]) vBox('leg', 3, 22, 3, lx, 11, lz, M.metal);
      break;
    case 'washers': {
      const along = o.w > o.h, unit = along ? o.h : o.w, count = Math.max(1, Math.floor((along ? o.w : o.h) / unit)), step = (along ? o.w : o.h) / count;
      for (let k = 0; k < count; k++) {
        const ux = along ? o.x + k * step + step / 2 : cx, uz = along ? cz : o.y + k * step + step / 2;
        vBox('washer', along ? step - 3 : unit - 3, 84, along ? unit - 3 : step - 3, ux, 42, uz, M.washer);
        const doors = along ? [[ux, o.y - 1.5, 'z'], [ux, o.y + o.h + 1.5, 'z']] : [[W / 2 > cx ? o.x + o.w + 1.5 : o.x - 1.5, uz, 'x']];
        for (const [dx, dz, ax] of doors) {
          const door = vCyl('door', unit * 0.55, 3, dx, 50, dz, M.door);
          if (ax === 'z') door.rotation.x = Math.PI / 2; else door.rotation.z = Math.PI / 2;
        }
      }
      break;
    }
    case 'rope': {
      const n = Math.max(1, Math.round(o.w / 68));
      for (let k = 0; k <= n; k++) {
        const px = o.x + o.w * k / n;
        vCyl('base', 16, 3, px, 1.5, cz, M.metal); vCyl('post', 4, 36, px, 19, cz, M.metal); vCyl('knob', 7, 4, px, 38, cz, M.brass);
      }
      vBox('rope', o.w, 3, 3, cx, 33, cz, M.rope);
      break;
    }
    case 'poboxes':
      vBox('poboxes', o.w, 126, o.h, cx, 63, cz, M.brass);
      break;
    case 'table':
      vBox('tabletop', o.w, 3, o.h, cx, 36, cz, M.table);
      for (const lx of [o.x + 4, o.x + o.w - 4]) for (const lz of [o.y + 4, o.y + o.h - 4]) vBox('leg', 3, 34, 3, lx, 17, lz, M.metal);
      break;
  }
}
// Builds the room for this match: walls, ceiling, tube light and the furniture for whichever waiting room it is.
export function buildScene(){
  if (!V.scene) return false;
  try {
    const B = BABYLON;
    for (const m of V.room) m.dispose(); V.room = [];
    for (const P of V.people.values()) P.root.dispose(); V.people.clear();
    V.floorRgb = hexRgb(col.floor); V.lineRgb = hexRgb(col.line);
    fitCamera();
    const M = V.M = {
      wall:vMat(mixRgb(hexRgb(col.wall), '200,196,186', 0.35)), ceil:vMat('226,222,210', {cull:false}), chair:vMat('104,112,104'), metal:vMat('86,88,90'),
      desk:vMat('176,164,140'), dark:vMat('46,48,52'), leaf:vMat('84,126,80'), pot:vMat('164,98,70'), cooler:vMat('206,208,210'), bottle:vMat('120,176,226', {alpha:0.6}),
      kiosk:vMat('70,74,82'), screen:vMat('180,226,255', {emissive:0.9}), wood:vMat('132,100,74'), water:vMat('70,140,184', {alpha:0.45}),
      glass:vMat('170,215,235', {alpha:0.22, emissive:0.2}), fish:vMat('240,140,40', {emissive:0.5}), washer:vMat('226,228,224'), door:vMat('120,150,172'),
      table:vMat('194,184,164'), tube:vMat('255,250,236', {emissive:1}), rope:vMat('150,40,52'), brass:vMat('176,150,92')
    };
    M.tube.disableLighting = true;
    const WH = 140;
    vBox('wallTop', W, WH, WALL, W / 2, WH / 2, WALL / 2, M.wall);
    vBox('wallLeft', WALL, WH, H, WALL / 2, WH / 2, H / 2, M.wall);
    vBox('wallRight', WALL, WH, H, W - WALL / 2, WH / 2, H / 2, M.wall);
    vBox('wallBottomA', 70, WH, WALL, 35, WH / 2, H - WALL / 2, M.wall);
    vBox('wallBottomB', W - 140, WH, WALL, 140 + (W - 140) / 2, WH / 2, H - WALL / 2, M.wall);
    vBox('ceiling', W, 2, H, W / 2, WH + 1, H / 2, M.ceil);
    vBox('tube', 260, 5, 12, W / 2, WH - 4, H / 2 - 8, M.tube);
    V.bulb.position.set(W / 2, WH - 30, H / 2);
    const nodes = CHAIRS.map(ch => addChair(ch, M));
    for (const o of OBST) addFurniture(o, M);
    // Merge everything static by material so the room is a handful of draw calls.
    for (const m of V.room) m.computeWorldMatrix(true);
    const groups = new Map();
    for (const m of V.room) { const k = m.material ? m.material.name : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    const merged = [];
    for (const list of groups.values()) {
      if (list.length === 1) { list[0].parent = null; list[0].freezeWorldMatrix(); merged.push(list[0]); continue; }
      const mm = B.Mesh.MergeMeshes(list, true, true);
      if (mm) { mm.freezeWorldMatrix(); merged.push(mm); }
    }
    for (const n of nodes) n.dispose();
    V.room = merged;
    return true;
  } catch (e) { console.warn('Underignore: 3D room failed', e); return false; }
}
function shirtFor(zid, fade){
  const z = ZEROES[zid]; if (!z) return '128,122,112';
  return mixRgb(mixRgb(z.color.join(','), '255,255,255', 0.22), '150,146,136', clamp(fade || 0, 0, 1));
}
function npcShirt(n){ const z = ZEROES[n.zid]; return z ? mixRgb(z.color.join(','), '140,136,128', 0.4) : ['122,116,106','96,104,112','132,112,100','104,112,96'][n.i % 4]; }
function makePerson(key, shoe, shirt, skin){
  const B = BABYLON, sc = V.scene, root = new B.TransformNode(key, sc);
  const box = (n, w, h, d, mat, parent) => { const m = B.MeshBuilder.CreateBox(key + n, {width:w, height:h, depth:d}, sc); m.material = mat; m.parent = parent || root; return m; };
  const hip = side => { const h = new B.TransformNode(key + 'hip' + side, sc); h.parent = root; const leg = box('leg' + side, 7, 42, 8, vMat('60,58,56'), h); leg.position.y = -21; return {h, leg}; };
  const P = {root, sl:box('sl', 8, 5, 16, vMat(shoe)), sr:box('sr', 8, 5, 16, vMat(shoe)), hl:hip(-1), hr:hip(1),
    torso:box('torso', 26, 34, 14, vMat(shirt)), al:box('al', 6, 30, 7, vMat(shirt)), ar:box('ar', 6, 30, 7, vMat(shirt)), alpha:1, shoe};
  P.head = B.MeshBuilder.CreateSphere(key + 'head', {diameter:18, segments:6}, sc); P.head.material = vMat(skin); P.head.parent = root;
  P.meshes = [P.sl, P.sr, P.hl.leg, P.hr.leg, P.torso, P.al, P.ar, P.head];
  return P;
}
function posePerson(P, x, y, face, step, moving, seated, alpha, shoe){
  P.root.position.set(x, 0, y); P.root.rotation.y = Math.PI / 2 - face;
  const s = moving ? Math.sin(step) : 0;
  if (seated) {
    P.hl.h.position.set(-6, 28, -2); P.hr.h.position.set(6, 28, -2); P.hl.h.rotation.x = P.hr.h.rotation.x = -1.35;
    P.sl.position.set(-6, 2.5, 22); P.sr.position.set(6, 2.5, 22);
    P.torso.position.set(0, 46, -5); P.al.position.set(-16, 44, -2); P.ar.position.set(16, 44, -2); P.al.rotation.x = P.ar.rotation.x = -0.6;
    P.head.position.set(0, 73, -5);
  } else {
    P.hl.h.position.set(-6, 46, 0); P.hr.h.position.set(6, 46, 0); P.hl.h.rotation.x = s * 0.45; P.hr.h.rotation.x = -s * 0.45;
    P.sl.position.set(-6.5, 2.5, 2 - s * 7); P.sr.position.set(6.5, 2.5, 2 + s * 7);
    P.torso.position.set(0, 64, 0); P.al.position.set(-16, 62, 0); P.ar.position.set(16, 62, 0); P.al.rotation.x = -s * 0.35; P.ar.rotation.x = s * 0.35;
    P.head.position.set(0, 91, 0);
  }
  if (shoe && shoe !== P.shoe) { P.sl.material = P.sr.material = vMat(shoe); P.shoe = shoe; }
  if (P.alpha !== alpha) { for (const m of P.meshes) m.visibility = alpha; P.alpha = alpha; }
}
export function render3D(){
  const w = G.world, p = G.me, seen = new Set();
  const put = (key, make, x, y, face, step, moving, seated, alpha, shoe) => {
    let P = V.people.get(key); if (!P) { P = make(); V.people.set(key, P); }
    seen.add(key); posePerson(P, x, y, face, step, moving, seated, alpha, shoe);
  };
  for (const n of w.npcs) put('n' + n.i, () => makePerson('n' + n.i, n.rgb, npcShirt(n), SKINS[hashStr(n.name) % SKINS.length]),
    n.rx, n.ry, n.rf, n.step, n.state === 'walk', !!n.seated && n.state === 'wait', n.bl > 0 ? 0.28 : 1, n.rgb);
  for (const o of G.others.values()) if (!o.gone && !o.done) put('o' + o.id, () => makePerson('o' + o.id, o.rgb, shirtFor(o.z, o.fd), SKINS[hashStr(o.nm || o.id) % SKINS.length]),
    o.rx, o.ry, o.rf, o.step, o.mv, !!o.si, o.bl ? 0.28 : 1, o.rgb);
  put('me', () => makePerson('me', G.rgb, shirtFor(acct.zero, acct.fade), SKINS[hashStr(acct.name) % SKINS.length]),
    p.x, p.y, p.face, p.step, p.moving, !!p.seated && !(p.rising && p.rising < 0.45), p.blendT > 0 ? 0.28 : 1, G.rgb);
  const kid = w.evt && w.evt.k === 'kid' && w.evt.rx != null ? w.evt : null;
  if (kid) put('kid', () => { const P = makePerson('kid', '240,200,70', '232,96,84', SKINS[hashStr(w.mid) % SKINS.length]); P.root.scaling.setAll(0.55); return P; },
    kid.rx, kid.ry, kid.rf, kid.step || 0, true, false, 1, '240,200,70');
  for (const [k, P] of V.people) if (!seen.has(k)) { P.root.dispose(); V.people.delete(k); }
  const ev = w.evt, dark = !!(ev && ev.k === 'dark');
  const fl = dark ? 0.14 : G.flicker > 0 ? (Math.random() < 0.5 ? 0.45 : 0.8) : 1;
  V.hemi.intensity = 0.95 * fl; V.bulb.intensity = 0.5 * fl;
  if (V.M) V.M.tube.emissiveColor.copyFromFloats(fl, fl * 0.98, fl * 0.92);
  V.scene.render();
}
