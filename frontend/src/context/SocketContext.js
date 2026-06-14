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