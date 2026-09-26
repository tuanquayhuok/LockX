const http = require('http');

let typingState = {};   // key: `from->to` => timestamp
let blockState = {};    // key: blocker => { target: boolean }
let seenState = {};     // key: `from->to` => timestamp
let presenceState = {}; // key: username => timestamp
let reactionState = {}; // key: conversationKey => { [msgId/msgText]: reactions[] }
let callState = {};     // key: conversationKey => { caller, target, active, time, reason }
let activeChatState = {}; // key: username => friendUsername they are currently chatting with
let profileState = {};    // key: username => { username, displayName, avatarType, avatarUri, avatarPresetId, avatarColor, isVerified, bio }
let chatConfigState = {}; // key: convKey => { themeId, quickEmoji, background, updatedBy, updatedAt }
let messageState = {}; // key: convKey => array of { id, sender, text, time, timestamp, reactions, replyTo, deliveryStatus }

function getConvKey(u1, u2) {
  return [u1.toLowerCase().replace(/^@/, '').trim(), u2.toLowerCase().replace(/^@/, '').trim()].sort().join('_');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');

        if (pathname === '/heartbeat') {
          const u = (data.username || '').toLowerCase().replace(/^@/, '').trim();
          if (u) {
            presenceState[u] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
          return;
        }

        if (pathname === '/profile') {
          const u = (data.username || '').toLowerCase().replace(/^@/, '').trim();
          if (u) {
            profileState[u] = {
              ...(profileState[u] || {}),
              username: u,
              displayName: data.displayName || profileState[u]?.displayName || '',
              avatarType: data.avatarType || profileState[u]?.avatarType || 'image',
              avatarUri: data.avatarUri !== undefined ? data.avatarUri : (profileState[u]?.avatarUri || ''),
              avatarPresetId: data.avatarPresetId || profileState[u]?.avatarPresetId || 'av-hacker',
              avatarColor: data.avatarColor || profileState[u]?.avatarColor || '#0A84FF',
              isVerified: typeof data.isVerified === 'boolean' ? data.isVerified : true,
              bio: data.bio !== undefined ? data.bio : (profileState[u]?.bio || ''),
              updatedAt: Date.now()
            };
            presenceState[u] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, profile: profileState[u] || null }));
          return;
        }

        if (pathname === '/typing') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            typingState[`${from}->${to}`] = Date.now();
            presenceState[from] = Date.now(); // typing also counts as heartbeat
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (pathname === '/seen') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            seenState[`${from}->${to}`] = Date.now();
            presenceState[from] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
          return;
        }

        if (pathname === '/active-chat') {
          const user = (data.user || '').toLowerCase().replace(/^@/, '').trim();
          const chattingWith = data.chattingWith ? data.chattingWith.toLowerCase().replace(/^@/, '').trim() : null;
          if (user) {
            activeChatState[user] = chattingWith;
            presenceState[user] = Date.now();
            if (chattingWith) {
              seenState[`${user}->${chattingWith}`] = Date.now();
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, activeChatState }));
          return;
        }

        if (pathname === '/block') {
          const blocker = (data.blocker || '').toLowerCase().replace(/^@/, '').trim();
          const target = (data.target || '').toLowerCase().replace(/^@/, '').trim();
          const isBlocked = !!data.isBlocked;
          if (blocker && target) {
            if (!blockState[blocker]) blockState[blocker] = {};
            blockState[blocker][target] = isBlocked;
            presenceState[blocker] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (pathname === '/reaction') {
          const u1 = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const u2 = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          const msgKey = data.msgId || data.msgText;
          const reactions = Array.isArray(data.reactions) ? data.reactions : [];
          if (u1 && u2 && msgKey) {
            const ck = getConvKey(u1, u2);
            if (!reactionState[ck]) reactionState[ck] = {};
            reactionState[ck][msgKey] = reactions;
            if (data.msgText) {
              reactionState[ck][data.msgText] = reactions;
              reactionState[ck][data.msgText.trim()] = reactions;
            }
            if (data.msgId) {
              reactionState[ck][data.msgId] = reactions;
            }
            presenceState[u1] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (pathname === '/chat-config') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            const ck = getConvKey(from, to);
            chatConfigState[ck] = {
              ...(chatConfigState[ck] || {}),
              themeId: data.themeId || chatConfigState[ck]?.themeId || 'default',
              quickEmoji: data.quickEmoji || chatConfigState[ck]?.quickEmoji || '👍',
              background: data.background || chatConfigState[ck]?.background || 'default',
              updatedBy: from,
              updatedAt: Date.now()
            };
            presenceState[from] = Date.now();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, config: chatConfigState[ck] }));
            return;
          }
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing from/to' }));
          return;
        }

        if (pathname === '/message') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          const text = data.text !== undefined ? String(data.text) : '';
          if (from && to && text) {
            const ck = getConvKey(from, to);
            if (!messageState[ck]) messageState[ck] = [];
            const clientMsgId = data.clientMsgId || data.id || `rl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const msgObj = {
              id: clientMsgId,
              clientMsgId: clientMsgId,
              sender: from,
              text: text,
              time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: Number(data.timestamp) || Date.now(),
              reactions: Array.isArray(data.reactions) ? data.reactions : [],
              replyTo: data.replyTo || undefined,
              deliveryStatus: 'delivered'
            };
            // deduplicate if same id exists
            const existingIdx = messageState[ck].findIndex(m => m.id === msgObj.id || (m.clientMsgId && m.clientMsgId === msgObj.clientMsgId));
            if (existingIdx !== -1) {
              messageState[ck][existingIdx] = msgObj;
            } else {
              messageState[ck].push(msgObj);
              if (messageState[ck].length > 200) {
                messageState[ck] = messageState[ck].slice(-200);
              }
            }
            presenceState[from] = Date.now();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: msgObj }));
            return;
          }
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing from/to/text' }));
          return;
        }

        if (pathname === '/call') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            const ck = getConvKey(from, to);
            const lastTarget = presenceState[to] || 0;
            const isTargetOnline = lastTarget > 0 && (Date.now() - lastTarget) < 75000;
            const initStatus = isTargetOnline ? 'ringing' : 'connecting';

            callState[ck] = {
              caller: from,
              callerName: data.callerName || from,
              callerAvatar: data.callerAvatar || null,
              target: to,
              active: true,
              status: initStatus, // 'ringing' | 'connecting' | 'connected' | 'ended'
              isTargetOnline,
              startTime: Date.now(),
              connectTime: null,
              endTime: null,
              reason: null,
              duration: 0,
              signals: []
            };
            presenceState[from] = Date.now();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, status: initStatus, isOnline: isTargetOnline, call: callState[ck] }));
            return;
          }
        }

        if (pathname === '/call/accept') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            const ck = getConvKey(from, to);
            if (callState[ck] && callState[ck].active) {
              callState[ck].status = 'connected';
              callState[ck].connectTime = Date.now();
              presenceState[from] = Date.now();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, call: callState[ck] }));
              return;
            }
          }
        }

        if (pathname === '/call/decline') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            const ck = getConvKey(from, to);
            if (callState[ck]) {
              callState[ck].active = false;
              callState[ck].status = 'ended';
              callState[ck].reason = 'declined';
              callState[ck].endTime = Date.now();
              presenceState[from] = Date.now();
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (pathname === '/call/signal') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          const signal = data.signal;
          if (from && to && signal) {
            const ck = getConvKey(from, to);
            if (!callState[ck]) {
              callState[ck] = { caller: from, target: to, active: true, status: 'connecting', signals: [] };
            }
            if (!callState[ck].signals) callState[ck].signals = [];
            callState[ck].signals.push({ from, to, signal, time: Date.now() });
            // keep max 50 signals
            if (callState[ck].signals.length > 50) {
              callState[ck].signals = callState[ck].signals.slice(-50);
            }
            presenceState[from] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (pathname === '/endcall') {
          const from = (data.from || '').toLowerCase().replace(/^@/, '').trim();
          const to = (data.to || '').toLowerCase().replace(/^@/, '').trim();
          if (from && to) {
            const ck = getConvKey(from, to);
            const duration = Number(data.duration) || 0;
            const reason = data.reason || 'cancelled';
            callState[ck] = {
              ...(callState[ck] || {}),
              caller: callState[ck]?.caller || from,
              target: callState[ck]?.target || to,
              active: false,
              status: 'ended',
              time: Date.now(),
              endTime: Date.now(),
              reason,
              duration
            };
            presenceState[from] = Date.now();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
    });
  } else if (req.method === 'GET') {
    if (pathname === '/presence') {
      const u = (url.searchParams.get('username') || '').toLowerCase().replace(/^@/, '').trim();
      const last = presenceState[u] || 0;
      const now = Date.now();
      // Ngưỡng 75 giây để tránh việc trình duyệt giảm tốc độ (throttle timer) khi ẩn tab/treo tab
      const isOnline = last > 0 && (now - last) < 75000;
      const diffSec = Math.floor((now - last) / 1000);
      const diffMins = Math.floor(diffSec / 60);

      let text = 'Hoạt động gần đây';
      if (isOnline) {
        text = '🟢 Đang hoạt động • E2E';
      } else if (last > 0) {
        if (diffMins < 1) {
          text = 'Hoạt động vừa xong';
        } else if (diffMins < 60) {
          text = `Hoạt động ${diffMins || 1} phút trước`;
        } else if (diffMins < 1440) {
          text = `Hoạt động ${Math.floor(diffMins / 60)} giờ trước`;
        } else {
          text = `Hoạt động ${Math.floor(diffMins / 1440)} ngày trước`;
        }
      } else {
        text = 'Hoạt động gần đây';
      }
      const viewer = (url.searchParams.get('viewer') || '').toLowerCase().replace(/^@/, '').trim();
      const isViewingChat = isOnline && viewer ? (activeChatState[u] === viewer) : false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ isOnline, lastActive: last, text, isViewingChat, activeChatWith: activeChatState[u] || null, profile: profileState[u] || null }));
    } else if (pathname === '/profile') {
      const u = (url.searchParams.get('username') || '').toLowerCase().replace(/^@/, '').trim();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, profile: profileState[u] || null }));
    } else if (pathname === '/typing') {
      const from = (url.searchParams.get('from') || '').toLowerCase().replace(/^@/, '').trim();
      const to = (url.searchParams.get('to') || '').toLowerCase().replace(/^@/, '').trim();
      const now = Date.now();
      let isTyping = false;
      if (from && to) {
        const last = typingState[`${from}->${to}`] || 0;
        isTyping = (now - last) < 3000;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ isTyping }));
    } else if (pathname === '/seen') {
      const from = (url.searchParams.get('from') || '').toLowerCase().replace(/^@/, '').trim();
      const to = (url.searchParams.get('to') || '').toLowerCase().replace(/^@/, '').trim();
      const lastSeen = seenState[`${from}->${to}`] || 0;
      const now = Date.now();
      const fromOnline = (now - (presenceState[from] || 0)) < 75000;
      const isCurrentlyActive = fromOnline && (activeChatState[from] === to);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lastSeen, isCurrentlyActive, fromOnline }));
    } else if (pathname === '/block') {
      const blocker = (url.searchParams.get('blocker') || '').toLowerCase().replace(/^@/, '').trim();
      const target = (url.searchParams.get('target') || '').toLowerCase().replace(/^@/, '').trim();
      const isBlocked = !!(blockState[blocker] && blockState[blocker][target]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ isBlocked }));
    } else if (pathname === '/reactions') {
      const u1 = (url.searchParams.get('u1') || '').toLowerCase().replace(/^@/, '').trim();
      const u2 = (url.searchParams.get('u2') || '').toLowerCase().replace(/^@/, '').trim();
      const ck = getConvKey(u1, u2);
      const reactions = reactionState[ck] || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reactions }));
    } else if (pathname === '/chat-config') {
      const u1 = (url.searchParams.get('u1') || '').toLowerCase().replace(/^@/, '').trim();
      const u2 = (url.searchParams.get('u2') || '').toLowerCase().replace(/^@/, '').trim();
      const ck = getConvKey(u1, u2);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config: chatConfigState[ck] || null }));
    } else if (pathname === '/chat-sync') {
      const target = (url.searchParams.get('target') || '').toLowerCase().replace(/^@/, '').trim();
      const me = (url.searchParams.get('me') || '').toLowerCase().replace(/^@/, '').trim();
      const ck = getConvKey(me, target);
      const now = Date.now();

      // 1. Typing
      const lastTyping = typingState[`${target}->${me}`] || 0;
      const isTyping = (now - lastTyping) < 3000;

      // 2. Seen & Presence
      const lastSeen = seenState[`${target}->${me}`] || 0;
      const targetLastOnline = presenceState[target] || 0;
      const fromOnline = (now - targetLastOnline) < 75000;
      const isCurrentlyActive = fromOnline && (activeChatState[target] === me);

      // 3. Block
      const isBlocked = !!(blockState[target] && blockState[target][me]);

      // 4. Presence Text
      let presenceText = 'Hoạt động gần đây';
      if (fromOnline) {
        presenceText = 'Đang hoạt động';
      } else if (targetLastOnline > 0) {
        const diffSec = Math.floor((now - targetLastOnline) / 1000);
        if (diffSec < 60) presenceText = 'Vừa mới online';
        else if (diffSec < 3600) presenceText = `Hoạt động ${Math.floor(diffSec / 60)} phút trước`;
        else presenceText = `Hoạt động ${Math.floor(diffSec / 3600)} giờ trước`;
      }

      const prof = profileState[target] || null;
      const reactions = (ck && reactionState[ck]) || {};
      const config = (ck && chatConfigState[ck]) || null;
      const msgs = (ck && messageState[ck]) || [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        isTyping,
        seen: { lastSeen, isCurrentlyActive, fromOnline },
        isBlocked,
        presence: { text: presenceText, isOnline: fromOnline, profile: prof },
        reactions,
        chatConfig: config,
        messages: msgs
      }));
    } else if (pathname === '/call/incoming') {
      const u = (url.searchParams.get('username') || '').toLowerCase().replace(/^@/, '').trim();
      let incomingCall = null;
      if (u) {
        const now = Date.now();
        for (const k in callState) {
          const cs = callState[k];
          if (cs && cs.target === u && cs.active && (cs.status === 'ringing' || cs.status === 'connecting')) {
            if (now - cs.startTime < 35000) {
              incomingCall = cs;
              break;
            }
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasIncoming: !!incomingCall, call: incomingCall }));
    } else if (pathname === '/call/poll') {
      const u1 = (url.searchParams.get('u1') || '').toLowerCase().replace(/^@/, '').trim();
      const u2 = (url.searchParams.get('u2') || '').toLowerCase().replace(/^@/, '').trim();
      const since = Number(url.searchParams.get('since')) || 0;
      const ck = getConvKey(u1, u2);
      const cs = callState[ck] || { active: false };
      const signals = (cs.signals || []).filter(s => s.time > since);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ call: cs, signals }));
    } else if (pathname === '/call') {
      const u1 = (url.searchParams.get('u1') || '').toLowerCase().replace(/^@/, '').trim();
      const u2 = (url.searchParams.get('u2') || '').toLowerCase().replace(/^@/, '').trim();
      const ck = getConvKey(u1, u2);
      const cs = callState[ck] || { active: false };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cs));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    }
  }
});

server.listen(8089, () => {
  console.log('Relay server running on port 8089 (http://127.0.0.1:8089 & http://localhost:8089)');
});
