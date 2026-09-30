// The game canvas: fitting the room to the screen, and mapping screen points to the floor.
import { $, isTouch } from '../util.js';
import { W, H } from '../layout.js';
import { V, fitCamera } from './view3d.js';

export const cv = $('#cv'), ctx = cv.getContext('2d');
const frame = $('#frame'), stage = $('#stage');

// Room units to CSS pixels, and CSS pixels to canvas pixels.
export let scale = 1, dpr = 1;

export function resize(){
  const r = stage.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  scale = Math.max(0.2, Math.min((r.width - 16) / W, (r.height - 16) / H));
  frame.style.width = W * scale + 'px'; frame.style.height = H * scale + 'px';
  dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  if (V.engine) { V.engine.setHardwareScalingLevel(1 / dpr); V.engine.resize(); fitCamera(); }
}
new ResizeObserver(resize).observe(stage);

// Where on the floor a point on the screen is. The glass layer and the 3D room share one mapping.
export function floorAt(clientX, clientY){
  const r = cv.getBoundingClientRect();
  return {x:(clientX - r.left) / r.width * W, y:(clientY - r.top) / r.height * H};
}
