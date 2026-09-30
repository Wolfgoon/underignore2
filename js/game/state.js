// The match in progress, shared by every game module. Only startGame replaces it.
//
// G.mode is 'solo', 'host' or 'guest'. The host (or a solo player) runs the waiting room in G.world
// and announces what happens as numbered events; everyone, host included, hears those events
// in processEvent and keeps their own score in G.me.
export let G = null;
export const setGame = g => { G = g; };

// Live input, read by the player update every tick.
export const keys = new Set();
export const joy = {active:false, id:null, ox:0, oy:0, x:0, y:0};
export const mouse = {in:false, x:0, y:0};
