// Small helpers shared by everything.
export const $ = s => document.querySelector(s);
export const TAU = Math.PI * 2;
export const FONT = '"Public Sans","Helvetica Neue",Arial,sans-serif';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[(Math.random() * a.length) | 0];
export const shuffled = a => [...a].sort(() => Math.random() - 0.5);
export const rint = () => (Math.random() * 1000) | 0;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const num = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : d;
export const r1 = v => Math.round(v * 10) / 10;
export const r2 = v => Math.round(v * 100) / 100;
export const normAng = a => Math.atan2(Math.sin(a), Math.cos(a));
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const ordinal = n => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const hashStr = str => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanName = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 16);
export const cleanTitle = s => String(s == null ? '' : s).replace(/[^\p{L}\p{N} '\-.]/gu, '').trim().slice(0, 30);

export function mulberry32(a){
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// "r,g,b" strings, used by both renderers.
export const rgbArr = s => String(s).split(',').map(v => clamp(+v || 0, 0, 255) / 255);
export function hexRgb(h){
  h = String(h).trim();
  if (h.includes(',')) return h;
  h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16); return isNaN(n) ? '200,190,170' : [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}
export function mixRgb(a, b, t){
  const A = String(a).split(',').map(Number), B = String(b).split(',').map(Number);
  return A.map((v, i) => Math.round(v + ((B[i] || 0) - v) * t)).join(',');
}

export const isTouch = matchMedia('(pointer: coarse)').matches;
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
