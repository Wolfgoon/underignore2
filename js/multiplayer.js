// Hosting and joining rooms, the room screen, and keeping an eye on the host.
import { ZEROES, jobName } from './data.js';
import { acct, saveAcct, zeroRGB, solesSVG } from './account.js';
import { $, clamp, num, cleanName } from './util.js';
import { show, activeScreen } from './screens.js';
import { inClaude, peerOptions, roomP } from './rooms.js';
import { showLobby } from './lobby.js';
import { G } from './game/state.js';
import { startGame } from './game/match.js';
import { endMatch, renderStandings } from './game/end.js';

export let MP = null;
let roomWatchTimer = 0;
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ';
const newCode = () => Array.from({length:4}, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
const roomName = code => 'ui-' + code.toLowerCase();
const mpMsg = t => { $('#mpMsg').textContent = t; };
function setMpBusy(b){ ['#btnHost', '#btnJoin'].forEach(s => { $(s).disabled = b; }); }

// Checks the two things peer-to-peer play depends on, so problems show up before anyone hosts.
let mmOk = false, mmChecking = false;
function checkMatchmaking(){
  const el = $('#mpCheck');
  if (inClaude) { el.hidden = true; return; }
  el.hidden = false;
  const say = (text, bad) => { el.textContent = text; el.classList.toggle('bad', !!bad); };
  if (mmOk) { say('Matchmaking server: reachable.'); return; }
  if (mmChecking) return;
  mmChecking = true; say('Checking the matchmaking server\u2026');
  const started = Date.now();
  const attempt = () => {
    if (typeof window.Peer !== 'function') {
      if (Date.now() - started > 8000) { mmChecking = false; say('The multiplayer library didn\u2019t load. Something may be blocking cdn.jsdelivr.net; try reloading or another network.', true); return; }
      setTimeout(attempt, 300); return;
    }
    let p, done = false, t = 0;
    const finish = (ok, text) => {
      if (done) return; done = true; clearTimeout(t); mmChecking = false; mmOk = ok;
      try { p.destroy(); } catch (e) {}
      say(text, !ok);
    };
    try { p = new Peer(peerOptions()); }
    catch (e) { mmChecking = false; say('This browser can\u2019t make direct connections to other players.', true); return; }
    const down = 'Can\u2019t reach the matchmaking server right now. PeerJS\u2019s free server may be down; try again in a while.';
    t = setTimeout(() => finish(false, down), 10000);
    p.on('open', () => finish(true, 'Matchmaking server: reachable.'));
    p.on('error', e => finish(false, e && e.type === 'browser-incompatible' ? 'This browser can\u2019t make direct connections to other players.' : down));
  };
  attempt();
}
export function openMp(){
  if (MP) { showRoom(); return; }
  const nick = $('#mpNick'); nick.value = acct.nick || ''; nick.placeholder = acct.name;
  if (!inClaude) $('#mpFine').textContent = 'Everyone needs to open this same page. The host\u2019s browser is the room, so the host should keep the tab open and visible. A few strict networks block direct connections between players; if someone can\u2019t join, try a different network.';
  mpMsg(''); setMpBusy(false); show('mp'); checkMatchmaking();
}
async function enterRoom(code, role, attempt = 0){
  acct.nick = cleanName($('#mpNick').value); saveAcct();
  setMpBusy(true); mpMsg('Connecting\u2026');
  const room = await roomP;
  if (!room) {
    setMpBusy(false);
    mpMsg('Couldn\u2019t connect to a room from here. Multiplayer only works in the published link.');
    return;
  }
  let named;
  try { named = await (inClaude ? room.join(roomName(code)) : room.join(roomName(code), role)); }
  catch (e) {
    const c = e && e.code;
    if (c === 'taken' && role === 'host' && attempt < 5) return enterRoom(newCode(), 'host', attempt + 1);
    setMpBusy(false);
    mpMsg(c === 'not_permitted' ? 'Rooms aren\u2019t available for your account here.'
      : c === 'no_host' ? `Nobody is hosting room ${code} right now. Double-check the code with your host.`
      : c === 'no_connect' ? `Found room ${code}, but couldn\u2019t connect to the host. Some networks block direct connections between players, so try a different one, like switching between Wi-Fi and mobile data.`
      : c === 'no_library' ? 'The multiplayer part didn\u2019t load. Check your connection and reload the page.'
      : c === 'limit_reached' ? (inClaude ? 'Too many rooms are open right now. Try again in a moment.' : 'That room is full.')
      : (inClaude ? 'Couldn\u2019t reach the room. Try again.' : 'Couldn\u2019t reach the matchmaking server. Try again in a moment.'));
    return;
  }
  MP = { room, named, code, role, nick:acct.nick, joinedAt:performance.now(), hostSeenAt:0, hadHost:false, checkedHost:role !== 'host', playedMid:null };
  named.onPeers(() => { if (activeScreen() === 'room') renderRoom(); }, e => roomLost(e));
  roomPresence();
  setMpBusy(false); mpMsg('');
  showRoom();
  clearInterval(roomWatchTimer); roomWatchTimer = setInterval(roomWatch, 250);
}
export function leaveRoom(){
  clearInterval(roomWatchTimer);
  if (MP) { try { MP.named.leave().catch(() => {}); } catch (e) {} }
  MP = null;
}
function roomLost(e){
  if (!MP) return;
  const hostGone = !!(e && e.code === 'host_left');
  leaveRoom();
  if (G && !G.over && G.mode !== 'solo') { endMatch(hostGone ? 'hostleft' : 'lost'); return; }
  if (activeScreen() === 'room') { openMp(); mpMsg(hostGone ? 'The host closed the room.' : 'Lost the connection to the room.'); }
}
export function roomPresence(){
  if (!MP) return;
  const pr = {v:1, role:MP.role, nick:MP.nick, nm:acct.name, z:acct.zero, fd:acct.fade, st:'room', mid:null, a:null, tz:null, sy:null, sc:null, x:null, y:null};
  if (MP.role === 'host') Object.assign(pr, {ph:'lobby', n:null, e:null, pt:null, nn:null});
  MP.named.presence(pr).catch(() => {});
}
export function myPeerId(){ if (!MP) return null; const p = MP.named.peers().find(x => x.sameTab); return p ? p.peer : null; }
export function findHostPeer(){
  if (!MP) return null;
  const hosts = MP.named.peers().filter(p => !p.sameTab && p.presence && p.presence.v === 1 && p.presence.role === 'host');
  return hosts.find(p => p.presence.ph === 'play') || hosts[0] || null;
}
export function peerLabel(pr){ return cleanName(pr.nick) || cleanName(pr.nm) || 'Someone'; }

export function showRoom(){ $('#roomCode').textContent = MP.code; $('#roomMsg').textContent = ''; renderRoom(); show('room'); }
function renderRoom(){
  if (!MP) return;
  const peers = MP.named.peers().filter(p => p.kind === 'viewer' && p.presence && p.presence.v === 1);
  const list = document.createDocumentFragment();
  const rows = peers.map(p => ({pr:p.presence, me:p.sameTab}));
  if (!rows.some(r => r.me)) rows.unshift({pr:{nick:MP.nick, nm:acct.name, z:acct.zero, fd:acct.fade, role:MP.role, st:'room'}, me:true});
  rows.sort((a, b) => (b.pr.role === 'host') - (a.pr.role === 'host') || (b.me - a.me));
  for (const r of rows) {
    const z = ZEROES[r.pr.z] || ZEROES.accountant, fd = clamp(num(r.pr.fd), 0, 1);
    const li = document.createElement('li');
    li.innerHTML = `<span class="soles">${solesSVG(zeroRGB(z, fd), fd >= 1)}</span><div><strong></strong><small></small></div>`;
    const tags = [];
    if (r.pr.role === 'host') tags.push('host');
    if (r.me) tags.push('you');
    li.querySelector('strong').textContent = peerLabel(r.pr) + (tags.length ? ` (${tags.join(', ')})` : '');
    li.querySelector('small').textContent = `${jobName(z)}, ${r.pr.st === 'play' ? 'in a match' : r.pr.st === 'end' ? 'looking at results' : 'waiting'}`;
    list.appendChild(li);
  }
  const ul = $('#roster'); ul.innerHTML = ''; ul.appendChild(list);
  const host = findHostPeer(), sub = $('#roomSub'), start = $('#btnStart');
  start.hidden = MP.role !== 'host';
  if (MP.role === 'host') sub.textContent = 'Share this code. When everyone\u2019s here, start the match. People can also join a match that\u2019s already going.';
  else if (!host) sub.textContent = MP.hadHost ? 'The host left, so this room is closed. You can leave and host your own.'
    : (performance.now() - MP.joinedAt > 5000 ? `Nobody is hosting room ${MP.code} right now. Double-check the code with your host.` : 'Looking for the host\u2026');
  else if (host.presence.ph === 'play') sub.textContent = host.presence.mid === MP.playedMid ? 'The match you left is still going. You\u2019ll join the next one.' : 'A match is starting. Joining\u2026';
  else if (host.presence.ph === 'end') sub.textContent = 'The host is looking at the results. Hang on.';
  else sub.textContent = 'Waiting for the host to start the match.';
}
function roomWatch(){
  if (!MP) return;
  const now = performance.now(), host = findHostPeer();
  if (host) { MP.hostSeenAt = now; MP.hadHost = true; }
  if (MP.role === 'host' && !MP.checkedHost && now - MP.joinedAt > 1500) {
    MP.checkedHost = true;
    if (host) { // someone else already hosts this code; pick another
      leaveRoom(); enterRoom(newCode(), 'host'); return;
    }
  }
  const scr = activeScreen();
  if (scr === 'room') {
    renderRoom();
    if (MP.role === 'guest' && host && host.presence.ph === 'play' && typeof host.presence.mid === 'number' && host.presence.mid !== MP.playedMid && !(G && !G.over)) startGame('guest');
  } else if (scr === 'end' && G && G.over && G.mode !== 'solo') {
    const w = G.world;
    for (const p of MP.named.peers()) {
      if (p.sameTab || !p.presence || p.presence.mid !== w.mid) continue;
      const o = G.others.get(p.peer); if (o) o.sc = Math.max(0, num(p.presence.sc, o.sc));
      if (G.mode === 'guest' && p.presence.role === 'host' && Array.isArray(p.presence.n))
        p.presence.n.forEach((a, i) => { if (w.npcs[i] && Array.isArray(a)) w.npcs[i].score = Math.max(0, num(a[4], w.npcs[i].score)); });
    }
    renderStandings();
    const note = $('#endNote');
    if (MP.role === 'guest' && host && host.presence.ph === 'play' && host.presence.mid !== w.mid) {
      note.textContent = 'The host started a new match.'; $('#btnAgain').textContent = 'Join the new match';
    } else if (MP.role === 'guest' && !host && MP.hadHost && now - MP.hostSeenAt > 4000) note.textContent = 'The host has left the room.';
  }
}

export function initMultiplayer(){
  $('#btnHost').addEventListener('click', () => enterRoom(newCode(), 'host'));
  $('#btnJoin').addEventListener('click', () => {
    const code = $('#mpCode').value.toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 4) { mpMsg('Room codes are four letters.'); $('#mpCode').focus(); return; }
    enterRoom(code, 'guest');
  });
  $('#mpCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnJoin').click(); });
  $('#mpCode').addEventListener('input', e => { const i = e.currentTarget; i.value = i.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('#btnMpBack').addEventListener('click', showLobby);
  $('#btnLeaveRoom').addEventListener('click', () => { leaveRoom(); showLobby(); });
  $('#btnStart').addEventListener('click', () => {
    if (!startGame('host')) $('#roomMsg').textContent = 'Still connecting to the room. Try again in a second.';
  });
}
