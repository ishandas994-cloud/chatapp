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
// ── Reaction Bar ──────────────────────────────────────────────────────────────
const EMOJIS = ['👍','❤️','😂','😮','😢','🔥'];

function ReactionBar({ onSelect }) {
  return (
    <div style={{
      position:       'absolute',
      bottom:         'calc(100% + 6px)',
      left:           '50%',
      transform:      'translateX(-50%)',
      background:     'var(--bg-elevated)',
      border:         '1px solid var(--border)',
      borderRadius:   '999px',
      padding:        '0.35rem 0.6rem',
      display:        'flex',
      gap:            '0.3rem',
      zIndex:         50,
      boxShadow:      '0 8px 24px rgba(0,0,0,0.4)',
      whiteSpace:     'nowrap',
      animation:      'msgPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      {EMOJIS.map(e => (
        <button key={e}
          onClick={() => onSelect(e)}
          style={{
            background:  'none',
            border:      'none',
            cursor:      'pointer',
            fontSize:    '1.25rem',
            padding:     '0.1rem 0.15rem',
            borderRadius:'50%',
            transition:  'transform 0.15s',
            lineHeight:  1,
          }}
          onMouseEnter={ev => ev.currentTarget.style.transform = 'scale(1.35)'}
          onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
// ── Reaction Display ──────────────────────────────────────────────────────────
function Reactions({ reactions, currentUserId, onReact }) {
  if (!reactions || reactions.length === 0) return null;

  // Group by emoji
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, names: [], mine: false };
    acc[r.emoji].count++;
    acc[r.emoji].names.push(r.name);
    if ((typeof r.userId === 'object' ? r.userId._id : r.userId) === currentUserId)
      acc[r.emoji].mine = true;
    return acc;
  }, {});

  return (
    <div style={{
      display:   'flex',
      flexWrap:  'wrap',
      gap:       '4px',
      marginTop: '4px',
    }}>
      {Object.values(grouped).map(g => (
        <button key={g.emoji}
          onClick={() => onReact(g.emoji)}
          title={g.names.join(', ')}
          style={{
            background:   g.mine ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            border:       `1px solid ${g.mine ? 'var(--border-accent)' : 'var(--border)'}`,
            borderRadius: '999px',
            padding:      '1px 7px',
            cursor:       'pointer',
            fontSize:     '0.78rem',
            display:      'flex',
            alignItems:   'center',
            gap:          '3px',
            color:        'var(--text-primary)',
            transition:   'all 0.15s',
          }}>
          <span>{g.emoji}</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:'0.72rem' }}>{g.count}</span>
        </button>
      ))}
    </div>
  );
}
// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 44, online = false }) {
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';
  return (
    <div className="av-wrap" style={{ width:size, height:size }}>
      {user?.avatar
        ? <img className="av-img" src={user.avatar} alt={user.name}
            style={{ width:size, height:size }} />
        : <div className="av-placeholder"
            style={{ width:size, height:size, fontSize:size*0.36 }}>{initials}</div>
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

  const [chats,        setChats]        = useState([]);
  const [active,       setActive]       = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [typing,       setTyping]       = useState('');
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [showDirect,   setShowDirect]   = useState(false);
  const [showGroup,    setShowGroup]    = useState(false);
  const [showPicker,   setShowPicker]   = useState(false);
  const [searchQ,      setSearchQ]      = useState('');
  const [searchRes,    setSearchRes]    = useState([]);
  const [groupName,    setGroupName]    = useState('');
  const [picked,       setPicked]       = useState([]);
  const [callState,    setCallState]    = useState(null);
  const [inCall,       setInCall]       = useState(null);
  const [deleteModal,  setDeleteModal]  = useState(null);
  const [reactionBar,  setReactionBar]  = useState(null); // msgId showing reaction bar

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
   // ── Incoming messages ─────────────────────────────────────────────────────
  useEffect(() => {
    const onMsg = (msg) => {
      if (msg._chatUpdate) return;
      setMessages(prev => [...prev, msg]);
      setChats(prev =>
        prev.map(c => c._id === msg.chatId
          ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
          .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
      if (activeRef.current?._id === msg.chatId) socket.emitRead(msg.chatId);
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