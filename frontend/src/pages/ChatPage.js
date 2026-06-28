import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CallUI from '../components/CallUI';
import EmojiGifPicker from '../components/EmojiGifPicker';
// ── Ticks ─────────────────────────────────────────────────────────────────────
function Ticks({ msg, currentUserId }) {
  const isOut = (msg.sender?._id || msg.sender) === currentUserId;
  if (!isOut) return null;
  const seenByOther = (msg.readBy || []).some(id =>
    (typeof id === 'object' ? id._id : id) !== currentUserId
  );
  if (!msg._id || msg._pending) return (
    <span style={tk.wrap} title="Sending">
      <svg style={tk.svg} viewBox="0 0 16 11">
        <path d="M1 5.5L5.5 10L15 1" style={{ ...tk.path, stroke:'#888' }} />
      </svg>
    </span>
  );
  if (seenByOther) return (
    <span style={tk.wrap} title="Seen">
      <svg style={{ ...tk.svg, width:18 }} viewBox="0 0 20 11">
        <path d="M1 5.5L5.5 10L15 1" style={{ ...tk.path, stroke:'#60a5fa' }} />
        <path d="M5 5.5L9.5 10L19 1" style={{ ...tk.path, stroke:'#60a5fa' }} />
      </svg>
    </span>
  );
    return (
    <span style={tk.wrap} title="Delivered">
      <svg style={{ ...tk.svg, width:18 }} viewBox="0 0 20 11">
        <path d="M1 5.5L5.5 10L15 1" style={{ ...tk.path, stroke:'#888' }} />
        <path d="M5 5.5L9.5 10L19 1" style={{ ...tk.path, stroke:'#888' }} />
      </svg>
    </span>
  );
}
const tk = {
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
// ── Main ──────────────────────────────────────────────────────────────────────
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
  const [deleteModal, setDeleteModal] = useState(null);

  const endRef      = useRef(null);
    const typingTimer = useRef(null);
  const fileRef     = useRef(null);
  const pickerRef   = useRef(null);
  const activeRef   = useRef(null);

  useEffect(() => { activeRef.current = active; }, [active]);
 // ── Load chats ────────────────────────────────────────────────────────────
  const loadChats = useCallback(() =>
    axios.get('/api/chats').then(r => setChats(r.data)).catch(() => {}), []);

  useEffect(() => { loadChats(); }, [loadChats]);
 // ── Incoming messages (polling) ───────────────────────────────────────────
  useEffect(() => {
    const onMsg = (msg) => {
      if (msg._chatUpdate) return;
      setMessages(prev => [...prev, msg]);
      setChats(prev =>
        prev.map(c => c._id === msg.chatId
          ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
          .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
      if (activeRef.current?._id === msg.chatId) {
        socket.emitRead(msg.chatId);
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
 // ── Read receipts ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onRead = ({ messageIds, userId }) => {
      if (!messageIds) return;
      setMessages(prev =>
        prev.map(m => messageIds.includes(m._id)
          ? { ...m, readBy: [...(m.readBy || []), userId] } : m)
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
   // ── Load messages when chat opens ─────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    socket.joinChat(active._id);
    axios.get(`/api/messages/${active._id}`).then(r => {
      setMessages(r.data);
      const unreadIds = r.data
        .filter(m => {
          const sid = m.sender?._id || m.sender;
          return sid !== user._id &&
            !(m.readBy || []).some(id =>
              (typeof id === 'object' ? id._id : id) === user._id
            );
        })
        .map(m => m._id);
      if (unreadIds.length > 0) socket.emitRead(active._id);
    }).catch(() => {});
  }, [active, socket, user._id]);
 // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Close picker outside click ────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  // ── Search users ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ) { setSearchRes([]); return; }
    const t = setTimeout(() =>
      axios.get(`/api/users/search?q=${searchQ}`)
        .then(r => setSearchRes(r.data)).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [searchQ]);
