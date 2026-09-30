// Your permanent account: which Zero you were given, your rank, and how faded you are. Saved locally.
import { ZEROES, NAMES, LEGACY, RANKS } from './data.js';
import { pick, cleanName } from './util.js';

const STORE = 'underignore-account-v1';
const defAcct = () => ({zero:null, total:0, matches:0, fade:0, nick:''});

function loadAcct(){
  try { const s = localStorage.getItem(STORE); if (s) { const o = JSON.parse(s); if (o && typeof o === 'object') return Object.assign(defAcct(), o); } } catch (e) {}
  return defAcct();
}
export function saveAcct(){ try { localStorage.setItem(STORE, JSON.stringify(acct)); } catch (e) {} }

export const acct = loadAcct();
if (acct.zero && LEGACY[acct.zero]) { const [job, nm] = LEGACY[acct.zero]; acct.zero = job; if (!acct.name) acct.name = nm; saveAcct(); }
if (acct.zero && (!ZEROES[acct.zero] || !acct.assigned)) acct.zero = null;
if (acct.zero && !acct.name) { acct.name = pick(NAMES); saveAcct(); }
acct.name = cleanName(acct.name);
acct.nick = cleanName(acct.nick);

// Resetting clears your rank and colour, but never frees you from your Zero.
export function resetAcct(){
  const keep = {zero:acct.zero, name:acct.name, assigned:acct.assigned, nick:acct.nick, seenErrands:acct.seenErrands};
  for (const k of Object.keys(acct)) delete acct[k];
  Object.assign(acct, defAcct(), keep);
  saveAcct();
}

export function rankIndex(t){ let i = 0; for (let k = 0; k < RANKS.length; k++) if (t >= RANKS[k][1]) i = k; return i; }
export function zeroRGB(z, fade){ const g = [150,146,136]; return z.color.map((c, i) => Math.round(c + (g[i] - c) * fade)); }
export function solesSVG(rgb, outline){
  const c = `rgb(${rgb.join(',')})`;
  const attrs = outline ? `fill="none" stroke="${c}" stroke-width="1.6"` : `fill="${c}"`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><g ${attrs}><ellipse cx="13" cy="14" rx="5.6" ry="7.5"/><ellipse cx="13" cy="28.5" rx="4.2" ry="4.6"/><ellipse cx="27" cy="14" rx="5.6" ry="7.5"/><ellipse cx="27" cy="28.5" rx="4.2" ry="4.6"/></g></svg>`;
}
