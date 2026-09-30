// How players find each other. Inside Claude, the published page gets live rooms from the host app.
// Everywhere else, players connect straight to each other (WebRTC, through PeerJS): the host's browser
// is the room, and PeerJS's free public server only introduces players to each other.
// Either way the game sees the same join / presence / peers calls, and everything travels as presence:
// each player publishes their own state, and the host also publishes the waiting room.

export const inClaude = !!(window.claude && typeof window.claude.use === 'function');
export const peerOptions = () => Object.assign({debug:0}, window.UNDERIGNORE_PEER_OPTIONS || {});

// Peer-to-peer rooms. The host claims an id built from the room code; guests connect to it, and the
// host's browser passes everyone's state along to everyone else. Same calls as the rooms Claude provides.
function peerRooms(){
  const PREFIX = 'underignore-v1-', MAX_GUESTS = 15;
  return { join(name, role){ return new Promise((resolve, reject) => {
    if (typeof window.Peer !== 'function') { reject({code:'no_library', message:'PeerJS did not load'}); return; }
    const hubId = PREFIX + name, isHub = role === 'host';
    const others = new Map(), spokes = new Map();
    let myPresence = Object.freeze({}), myId = null, peer = null, hubConn = null, closed = false, joined = false, hb = 0, snap = Object.freeze([]);
    let peerFns = [], errFns = [];
    const rebuild = () => {
      const now = Date.now();
      for (const [id, v] of others) if (now - v.seen > 10000) others.delete(id);
      snap = Object.freeze([
        Object.freeze({peer:myId || 'me', by:null, isMe:true, sameTab:true, kind:'viewer', guest:false, presence:myPresence, updatedAt:now}),
        ...[...others].map(([id, v]) => Object.freeze({peer:id, by:null, isMe:false, sameTab:false, kind:'viewer', guest:false, presence:v.presence, updatedAt:v.seen}))
      ]);
      const change = {peers:snap, joined:[], left:[], updated:[]};
      peerFns.forEach(fn => { try { fn(change); } catch (e) {} });
    };
    const sendTo = (conn, msg) => { try { if (conn && conn.open) conn.send(msg); } catch (e) {} };
    const sendPresence = () => {
      if (isHub) { for (const c of spokes.values()) sendTo(c, {t:'presence', peer:myId, presence:myPresence}); }
      else sendTo(hubConn, {t:'presence', p:myPresence});
    };
    const fail = code => {
      if (closed) return;
      closed = true; clearInterval(hb); clearTimeout(startTimer);
      try { if (peer) peer.destroy(); } catch (e) {}
      const err = {code, message:code};
      if (!joined) reject(err); else errFns.forEach(fn => { try { fn(err); } catch (e) {} });
    };
    const startTimer = setTimeout(() => { if (!joined) fail(!myId || isHub ? 'upstream_error' : (hubConn ? 'no_connect' : 'no_host')); }, 15000);
    const ready = () => { if (joined) return; joined = true; clearTimeout(startTimer); rebuild(); resolve(api); };
    const api = {
      name,
      presence(patch){
        const next = Object.assign({}, myPresence);
        for (const k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
        myPresence = Object.freeze(next); sendPresence(); rebuild();
        return Promise.resolve();
      },
      peers: () => snap,
      onPeers(fn, onErr){
        peerFns.push(fn); if (onErr) errFns.push(onErr);
        setTimeout(() => fn({peers:snap, joined:snap, left:[], updated:[]}), 0);
        return () => { peerFns = peerFns.filter(f => f !== fn); errFns = errFns.filter(f => f !== onErr); };
      },
      connected: () => !closed && !!peer && !peer.destroyed,
      onConnection: () => () => {},
      emit: () => Promise.resolve(),
      on: () => () => {},
      leave(){ closed = true; clearInterval(hb); clearTimeout(startTimer); try { if (peer) peer.destroy(); } catch (e) {} return Promise.resolve(); }
    };
    const opts = peerOptions();
    const validPresence = p => p && typeof p === 'object' && !Array.isArray(p) && JSON.stringify(p).length <= 8000;

    if (isHub) {
      peer = new Peer(hubId, opts);
      peer.on('open', id => { myId = id; ready(); });
      peer.on('connection', conn => {
        conn.on('open', () => {
          const id = conn.peer;
          if (!spokes.has(id) && spokes.size >= MAX_GUESTS) { sendTo(conn, {t:'full'}); setTimeout(() => { try { conn.close(); } catch (e) {} }, 400); return; }
          const old = spokes.get(id); if (old && old !== conn) { try { old.close(); } catch (e) {} }
          spokes.set(id, conn);
          const list = [{peer:myId, presence:myPresence}, ...[...others].filter(([p]) => p !== id).map(([p, v]) => ({peer:p, presence:v.presence}))];
          sendTo(conn, {t:'welcome', peer:id, peers:list});
          for (const [p, c] of spokes) if (p !== id) sendTo(c, {t:'join', peer:id});
          if (!others.has(id)) others.set(id, {presence:Object.freeze({}), seen:Date.now()});
          rebuild();
        });
        conn.on('data', m => {
          if (!m || typeof m !== 'object' || spokes.get(conn.peer) !== conn) return;
          if (m.t === 'presence' && validPresence(m.p)) {
            others.set(conn.peer, {presence:Object.freeze(m.p), seen:Date.now()});
            for (const [p, c] of spokes) if (p !== conn.peer) sendTo(c, {t:'presence', peer:conn.peer, presence:m.p});
            rebuild();
          }
        });
        const gone = () => {
          if (spokes.get(conn.peer) !== conn) return;
          spokes.delete(conn.peer); others.delete(conn.peer);
          for (const c of spokes.values()) sendTo(c, {t:'leave', peer:conn.peer});
          rebuild();
        };
        conn.on('close', gone); conn.on('error', gone);
      });
      peer.on('error', err => {
        const t = err && err.type;
        if (t === 'unavailable-id') fail('taken');
        else if (!joined) fail(t === 'browser-incompatible' ? 'no_library' : 'upstream_error');
      });
    } else {
      peer = new Peer(opts);
      peer.on('open', id => {
        myId = id;
        hubConn = peer.connect(hubId, {reliable:true, serialization:'json'});
        hubConn.on('data', m => {
          if (!m || typeof m !== 'object') return;
          if (m.t === 'welcome') {
            others.clear();
            for (const q of Array.isArray(m.peers) ? m.peers : []) if (q && typeof q.peer === 'string' && q.peer !== myId) others.set(q.peer, {presence:Object.freeze(validPresence(q.presence) ? q.presence : {}), seen:Date.now()});
            sendPresence(); ready();
          } else if ((m.t === 'presence' || m.t === 'join') && typeof m.peer === 'string' && m.peer !== myId) {
            const v = others.get(m.peer) || {presence:Object.freeze({}), seen:0};
            if (m.t === 'presence' && validPresence(m.presence)) v.presence = Object.freeze(m.presence);
            v.seen = Date.now(); others.set(m.peer, v);
            rebuild();
          } else if (m.t === 'leave') { others.delete(m.peer); rebuild(); }
          else if (m.t === 'full') fail('limit_reached');
        });
        // Before joining, give the server a moment to say the room doesn't exist before blaming the connection.
        const lost = () => { if (joined) fail('host_left'); else setTimeout(() => fail('no_connect'), 1500); };
        hubConn.on('close', lost); hubConn.on('error', lost);
      });
      peer.on('error', err => {
        const t = err && err.type;
        if (t === 'peer-unavailable') fail(joined ? 'host_left' : 'no_host');
        else if (!joined) fail(t === 'browser-incompatible' ? 'no_library' : 'upstream_error');
      });
    }
    // Keep the connection to PeerJS's introduction server; existing player connections survive without it.
    peer.on('disconnected', () => { if (!closed && peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) {} } });
    hb = setInterval(() => { sendPresence(); rebuild(); }, 3000);
    // Closing the tab says goodbye properly, so everyone else hears about it right away.
    addEventListener('pagehide', () => { if (!closed) api.leave(); }, {once:true});
  }); } };
}

// Resolves to the room service, or null if there isn't one here.
export const roomP = inClaude
  ? Promise.resolve().then(() => window.claude.use('room')).catch(() => null)
  : Promise.resolve(peerRooms());
