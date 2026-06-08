import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CallUI from '../components/CallUI';
import EmojiGifPicker from '../components/EmojiGifPicker';
// ── Tick component ────────────────────────────────────────────────────────────
// grey single  = sent (delivered to server)
// grey double  = delivered (other user received in their client)
// blue double  = seen (other user opened the chat)
function Ticks({ msg, currentUserId }) {
  const isOut = (msg.sender?._id || msg.sender) === currentUserId;
  if (!isOut) return null;

  const readBy   = msg.readBy || [];
  // readBy includes sender always — seen = someone OTHER than sender has read it
  const seenByOther = readBy.some(id =>
    (typeof id === 'object' ? id._id : id) !== currentUserId
  );

  // Single grey tick — just sent
  if (!msg._id || msg._pending) {
    return (
      <span style={tick.wrap} title="Sending">
        <svg style={tick.svg} viewBox="0 0 16 11">
          <path d="M1 5.5L5.5 10L15 1" style={{ ...tick.path, stroke:'#888' }} />
        </svg>
      </span>
    );
  }
  // Double blue ticks — seen
  if (seenByOther) {
    return (
      <span style={tick.wrap} title="Seen">
        <svg style={{ ...tick.svg, width:18 }} viewBox="0 0 20 11">
          <path d="M1 5.5L5.5 10L15 1"   style={{ ...tick.path, stroke:'#60a5fa' }} />
          <path d="M5 5.5L9.5 10L19 1"   style={{ ...tick.path, stroke:'#60a5fa' }} />
        </svg>
      </span>
    );
  }
   // Double grey ticks — delivered
  return (
    <span style={tick.wrap} title="Delivered">
      <svg style={{ ...tick.svg, width:18 }} viewBox="0 0 20 11">
        <path d="M1 5.5L5.5 10L15 1"  style={{ ...tick.path, stroke:'#888' }} />
        <path d="M5 5.5L9.5 10L19 1"  style={{ ...tick.path, stroke:'#888' }} />
      </svg>
    </span>
  );
}

const tick = {
  wrap: { display:'inline-flex', alignItems:'center', marginLeft:4, verticalAlign:'middle' },
  svg:  { width:16, height:11, fill:'none' },
  path: { strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' },
};
// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 44, online = false }) {
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';
  return (
    <div className="av-wrap" style={{ width:size, height:size }}>
      {user?.avatar
        ? <img className="av-img" src={user.avatar} alt={user.name} style={{ width:size, height:size }} />
        : <div className="av-placeholder" style={{ width:size, height:size, fontSize:size*0.36 }}>{initials}</div>
      }
      {online && <span className="online-dot" />}
    </div>
  );
}
// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
const fmtDay  = (d) => {
  const t = new Date(), x = new Date(d);
  const y = new Date(t); y.setDate(y.getDate()-1);
  if (x.toDateString() === t.toDateString()) return 'Today';
  if (x.toDateString() === y.toDateString()) return 'Yesterday';
  return x.toLocaleDateString([], { month:'short', day:'numeric' });
};
const chatName  = (chat, uid) =>
  chat.isGroup ? chat.name : chat.members?.find(m => m._id !== uid)?.name || 'Unknown';
const otherUser = (chat, uid) =>
  chat.isGroup ? null : chat.members?.find(m => m._id !== uid);
// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, logout } = useAuth();
  const socket           = useSocket();

  const [chats,       setChats]       = useState([]);
  const [active,      setActive]      = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [typing,      setTyping]      = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDirect,  setShowDirect]  = useState(false);
  const [showGroup,   setShowGroup]   = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [searchQ,     setSearchQ]     = useState('');
  const [searchRes,   setSearchRes]   = useState([]);
  const [groupName,   setGroupName]   = useState('');
  const [picked,      setPicked]      = useState([]);
  const [callState,   setCallState]   = useState(null);
  const [inCall,      setInCall]      = useState(null);
   const endRef      = useRef(null);
  const typingTimer = useRef(null);
  const fileRef     = useRef(null);
  const pickerRef   = useRef(null);
  const activeRef   = useRef(null); // always current active chat

  // Keep activeRef in sync
  useEffect(() => { activeRef.current = active; }, [active]);
 // ── Load chats ────────────────────────────────────────────────────────────
  const loadChats = useCallback(() =>
    axios.get('/api/chats').then(r => setChats(r.data)).catch(() => {}), []);

  useEffect(() => { loadChats(); }, [loadChats]);

  // ── Socket: incoming message ──────────────────────────────────────────────
  useEffect(() => {
    const onMsg = (msg) => {
      setMessages(prev => [...prev, msg]);
      setChats(prev =>
        prev.map(c => c._id === msg.chatId
          ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
          .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
        // If this chat is currently open → immediately mark as read
      if (activeRef.current?._id === msg.chatId) {
        socket.emitRead(msg.chatId, [msg._id]);
        axios.post(`/api/messages/read`, { chatId: msg.chatId }).catch(() => {});
      }
    };

    const onTStart = ({ userId, userName }) => {
      if (userId !== user._id) setTyping(`${userName} is typing...`);
    };
    const onTStop = () => setTyping('');

    socket.onMessage(onMsg);
    socket.onTypingStart(onTStart);
    socket.onTypingStop(onTStop);
    return () => {
      socket.offMessage(onMsg);
      socket.offTypingStart(onTStart);
      socket.offTypingStop(onTStop);
    };
  }, [socket, user._id]);
   // ── Socket: read receipts from other user ─────────────────────────────────
  useEffect(() => {
    const onRead = ({ messageIds, userId }) => {
      setMessages(prev =>
        prev.map(m =>
          messageIds.includes(m._id)
            ? { ...m, readBy: [...(m.readBy || []), userId] }
            : m
        )
      );
    };
    socket.onMessagesRead(onRead);
    return () => socket.offMessagesRead(onRead);
  }, [socket]);
  // ── Incoming call ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cb = (data) => setInCall({ ...data, type: 'incoming' });
    socket.onIncomingCall(cb);
    return () => socket.offIncomingCall(cb);
  }, [socket]);
   // ── Load messages + mark read when chat opens ─────────────────────────────
  useEffect(() => {
    if (!active) return;
    socket.joinChat(active._id);
    axios.get(`/api/messages/${active._id}`).then(r => {
      setMessages(r.data);

      // Mark all unread messages as read
      const unreadIds = r.data
        .filter(m => {
          const sid = m.sender?._id || m.sender;
          return sid !== user._id &&
            !(m.readBy || []).some(id =>
              (typeof id === 'object' ? id._id : id) === user._id
            );
        })
        .map(m => m._id);
 if (unreadIds.length > 0) {
        socket.emitRead(active._id, unreadIds);
      }
    }).catch(() => {});
  }, [active, socket, user._id]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
