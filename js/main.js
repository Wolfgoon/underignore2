// Underignore: the exact opposite of Overwatch. Entry point.
//
// js/            lobby, multiplayer rooms, account, room layout, game data
// js/game/       the match: host simulation, your player, events, networking, end screen
// js/render/     the 2D glass layer, the 3D room (Babylon.js), the HUD
import { initLobby, showLobby } from './lobby.js';
import { initMultiplayer } from './multiplayer.js';
import { initErrands } from './game/errands.js';
import { initEnd } from './game/end.js';
import { initInput } from './input.js';
import { G } from './game/state.js';

initLobby();
initMultiplayer();
initErrands();
initEnd();
initInput();

// Test hook: only exists if the page is opened with UNDERIGNORE_DEBUG set beforehand.
if (window.UNDERIGNORE_DEBUG) window.__underignore = { get G(){ return G; } };

showLobby();
