import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

const POLL_INTERVAL = 2000; // poll every 2 seconds

export function SocketProvider({ children }) {
  const { user } = useAuth();

  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  // Callbacks registered by ChatPage
  const msgCallbacks      = useRef([]);
  const typingStartCbs    = useRef([]);
  const typingStopCbs     = useRef([]);
  const readCbs           = useRef([]);
  const incomingCallCbs   = useRef([]);
  const callAnsweredCbs   = useRef([]);
  const callRejectedCbs   = useRef([]);
  const callEndedCbs      = useRef([]);
  const iceCbs            = useRef([]);

  // Polling state
  const lastMsgTime       = useRef(new Date().toISOString());
  const lastChatTime      = useRef(new Date().toISOString());
  const pollRef           = useRef(null);
  const chatPollRef       = useRef(null);
  const activeChatIdRef   = useRef(null);
   // WebRTC signaling via API (stored in DB temporarily)
  const pendingSignals    = useRef(new Set());

  // ── Online users poll (every 10s) ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const pingOnline = () =>
      axios.post('/api/users/online', { userId: user._id }).catch(() => {});

    const fetchOnline = () =>
      axios.get('/api/users/online').then(r => setOnlineUsers(r.data)).catch(() => {});

    pingOnline();
    fetchOnline();
     const t1 = setInterval(pingOnline,    10000);
    const t2 = setInterval(fetchOnline,   10000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [user]);

  // ── Message polling for active chat ──────────────────────────────────────
  const startPolling = useCallback((chatId) => {
    clearInterval(pollRef.current);
    activeChatIdRef.current = chatId;
    lastMsgTime.current = new Date().toISOString();

    pollRef.current = setInterval(async () => {
      try {
        const { data: newMsgs } = await axios.get(
          `/api/messages/${chatId}/poll?since=${lastMsgTime.current}`
        );
        if (newMsgs.length > 0) {
          lastMsgTime.current = newMsgs[newMsgs.length - 1].createdAt;
          // Only fire for messages NOT from current user
          const incoming = newMsgs.filter(m =>
            (m.sender?._id || m.sender) !== user._id
          );
           incoming.forEach(msg =>
            msgCallbacks.current.forEach(cb => cb(msg))
          );
          // Fire read updates for own messages
          const readUpdates = newMsgs.filter(m =>
            (m.sender?._id || m.sender) === user._id
          );
          readUpdates.forEach(msg => {
            readCbs.current.forEach(cb =>
              cb({ messageIds: [msg._id], userId: msg.readBy?.[msg.readBy.length - 1] })
            );
          });
        }
      } catch {}
    }, POLL_INTERVAL);
  }, [user._id]);
   // ── Chat list polling (sidebar updates) ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    lastChatTime.current = new Date().toISOString();

    chatPollRef.current = setInterval(async () => {
      try {
        const { data: updatedChats } = await axios.get(
          `/api/messages/chats/poll?since=${lastChatTime.current}`
        );
        if (updatedChats.length > 0) {
          lastChatTime.current = new Date().toISOString();
          // Notify ChatPage via a special message event carrying chat updates
          updatedChats.forEach(chat => {
            if (chat.lastMessage &&
              (chat.lastMessage.sender?._id || chat.lastMessage.sender) !== user._id &&
              activeChatIdRef.current !== chat._id
            ) {
               msgCallbacks.current.forEach(cb => cb({
                ...chat.lastMessage,
                chatId: chat._id,
                _chatUpdate: true,
              }));
            }
          });
        }
      } catch {}
    }, POLL_INTERVAL * 2);

    return () => clearInterval(chatPollRef.current);
  }, [user]);
// ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearInterval(chatPollRef.current);
    };
  }, []);

  // ── Public API (same interface as Socket.IO version) ──────────────────────
  const joinChat = (chatId) => {
    setActiveChatId(chatId);
    startPolling(chatId);
  };
   const sendMessage    = () => {};   // no-op — REST handles delivery
  const startTyping    = () => {};   // typing indicators need sockets; skip for now
  const stopTyping     = () => {};
  const emitRead       = async (chatId) => {
    try { await axios.post('/api/messages/read', { chatId }); } catch {}
  };

  // ── Callback registration ─────────────────────────────────────────────────
  const onMessage       = (cb) => { msgCallbacks.current.push(cb); };
  const offMessage      = (cb) => { msgCallbacks.current = msgCallbacks.current.filter(f => f !== cb); };
  const onTypingStart   = (cb) => { typingStartCbs.current.push(cb); };
  const offTypingStart  = (cb) => { typingStartCbs.current = typingStartCbs.current.filter(f => f !== cb); };
  const onTypingStop    = (cb) => { typingStopCbs.current.push(cb); };
  const offTypingStop   = (cb) => { typingStopCbs.current = typingStopCbs.current.filter(f => f !== cb); };
  const onMessagesRead  = (cb) => { readCbs.current.push(cb); };
  const offMessagesRead = (cb) => { readCbs.current = readCbs.current.filter(f => f !== cb); };
 // ── WebRTC — signal via REST ──────────────────────────────────────────────
  const initiateCall = async ({ to, from, callType, offer }) => {
    try {
      await axios.post('/api/calls/signal', { to, from, callType, offer, type: 'call:incoming' });
    } catch {}
  };

  const answerCall = async ({ to, answer }) => {
    try {
      await axios.post('/api/calls/signal', { to, answer, type: 'call:answered' });
    } catch {}
  };

  const rejectCall = async ({ to }) => {
    try {
      await axios.post('/api/calls/signal', { to, type: 'call:rejected' });
    } catch {}
  };
   const endCall = async ({ to }) => {
    try {
      await axios.post('/api/calls/signal', { to, type: 'call:ended' });
    } catch {}
  };

  const sendIce = async ({ to, candidate }) => {
    try {
      await axios.post('/api/calls/signal', { to, candidate, type: 'call:ice-candidate' });
    } catch {}
  };
// Poll for call signals
  useEffect(() => {
    if (!user) return;
    const t = setInterval(async () => {
      try {
        const { data: signals } = await axios.get(`/api/calls/signal?userId=${user._id}`);
        signals.forEach(sig => {
          if (pendingSignals.current.has(sig._id)) return;
          pendingSignals.current.add(sig._id);

          if (sig.type === 'call:incoming')    incomingCallCbs.current.forEach(cb => cb(sig));
          if (sig.type === 'call:answered')    callAnsweredCbs.current.forEach(cb => cb(sig));
          if (sig.type === 'call:rejected')    callRejectedCbs.current.forEach(cb => cb(sig));
          if (sig.type === 'call:ended')       callEndedCbs.current.forEach(cb => cb(sig));
          if (sig.type === 'call:ice-candidate') iceCbs.current.forEach(cb => cb(sig));
        });
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [user]);