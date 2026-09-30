// Canvas colours, read from the CSS custom properties so the game follows light and dark mode.
export const col = {};
function readColors(){
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  Object.assign(col, { floor:g('--floor'), line:g('--floor-line'), wall:g('--wall'), glow:g('--glow'), shade:g('--shade'), cone:g('--cone'),
    ink:g('--ink'), inkRgb:g('--ink-rgb'), panel:g('--panel'), danger:g('--danger'), dangerRgb:g('--danger-rgb'), calm:g('--calm'), calmRgb:g('--calm-rgb'), muted:g('--muted'), amber:g('--amber') });
}
readColors();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors); } catch (e) {}
new MutationObserver(readColors).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

// A translucent shade of the room's shadow colour.
export const sh = a => `rgba(${col.shade},${a})`;
