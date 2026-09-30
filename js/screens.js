// Switching between the full-page screens (lobby, queue, game, end, ...).
const listeners = [];
export const onShow = fn => { listeners.push(fn); };
export const activeScreen = () => { const s = document.querySelector('.screen.active'); return s ? s.id : ''; };
export function show(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  const el = document.getElementById(id); if (el) el.scrollTop = 0;
  for (const fn of listeners) fn(id);
}
