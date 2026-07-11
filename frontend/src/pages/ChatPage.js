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

  // ── Load messages ─────────────────────────────────────────────────────────
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
              (typeof id === 'object' ? id._id : id) === user._id);
        })
        .map(m => m._id);
      if (unreadIds.length > 0) socket.emitRead(active._id);
    }).catch(() => {});
  }, [active, socket, user._id]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Close picker + reaction bar on outside click ──────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowPicker(false);
      if (!e.target.closest('.reaction-trigger') && !e.target.closest('.reaction-bar-wrap'))
        setReactionBar(null);
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

  // ── Send text ─────────────────────────────────────────────────────────────
  const sendMsg = async () => {
    const text = input.trim();
    if (!text || !active) return;
    setInput('');
    socket.stopTyping(active._id);
    const tempId  = `temp_${Date.now()}`;
    const tempMsg = {
      _id: tempId, _pending: true,
      chatId: active._id,
      sender: { _id: user._id, name: user.name, avatar: user.avatar },
      content: text, type: 'text',
      readBy: [user._id], reactions: [],
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    try {
      const { data: msg } = await axios.post('/api/messages', {
        chatId: active._id, content: text, type: 'text',
      });
      setMessages(prev => prev.map(m => m._id === tempId ? msg : m));
      socket.sendMessage({ ...msg, chatId: active._id });
      setChats(prev =>
        prev.map(c => c._id === active._id
          ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
          .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    } catch {
      setMessages(prev => prev.filter(m => m._id !== tempId));
    }
  };

  // ── Send file ─────────────────────────────────────────────────────────────
  const sendFile = async (file) => {
    if (!file || !active) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('chatId', active._id);
    try {
      const { data: msg } = await axios.post('/api/messages/media', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages(prev => [...prev, msg]);
      socket.sendMessage({ ...msg, chatId: active._id });
    } catch {}
  };

  // ── Send GIF / Sticker ────────────────────────────────────────────────────
  const sendGifOrSticker = async (url) => {
    setShowPicker(false);
    if (!active) return;
    try {
      const { data: msg } = await axios.post('/api/messages', {
        chatId: active._id, content: url, type: 'image',
      });
      setMessages(prev => [...prev, msg]);
      socket.sendMessage({ ...msg, chatId: active._id });
      setChats(prev =>
        prev.map(c => c._id === active._id
          ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
          .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    } catch {}
  };

  // ── React to message ──────────────────────────────────────────────────────
  const handleReact = async (msgId, emoji) => {
    setReactionBar(null);
    try {
      const { data: updated } = await axios.post(
        `/api/messages/${msgId}/react`, { emoji }
      );
      setMessages(prev =>
        prev.map(m => m._id === msgId ? { ...m, reactions: updated.reactions } : m)
      );
    } catch {}
  };

  // ── Delete message ────────────────────────────────────────────────────────
  const handleDelete = (msgId) => setDeleteModal(msgId);

  const confirmDelete = async (deleteFor) => {
    const msgId = deleteModal;
    setDeleteModal(null);
    if (deleteFor === 'me') {
      setMessages(prev => prev.filter(m => m._id !== msgId));
      try { await axios.delete(`/api/messages/${msgId}`); } catch {}
    } else {
      setMessages(prev => prev.map(m =>
        m._id === msgId
          ? { ...m, content:'🚫 This message was deleted', type:'text', fileUrl:'' }
          : m
      ));
      try { await axios.delete(`/api/messages/${msgId}?everyone=true`); } catch {}
    }
  };

  const handleEmojiSelect = (emoji) => setInput(prev => prev + emoji);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    if (active) {
      socket.startTyping(active._id);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => socket.stopTyping(active._id), 1500);
    }
  };

  const openDirect = async (userId) => {
    try {
      const { data: chat } = await axios.post('/api/chats/direct', { userId });
      setChats(prev => prev.find(c => c._id === chat._id) ? prev : [chat, ...prev]);
      selectChat(chat);
      setShowDirect(false);
      setSearchQ('');
    } catch {}
  };

  const createGroup = async () => {
    if (!groupName || picked.length < 2) return;
    try {
      const { data: chat } = await axios.post('/api/chats/group', {
        name: groupName, members: picked.map(u => u._id),
      });
      setChats(prev => [chat, ...prev]);
      selectChat(chat);
      setShowGroup(false);
      setGroupName('');
      setPicked([]);
    } catch {}
  };

  const selectChat = (chat) => { setActive(chat); setSidebarOpen(false); };

  const grouped = messages.reduce((acc, msg) => {
    const day = fmtDay(msg.createdAt);
    (acc[day] = acc[day] || []).push(msg);
    return acc;
  }, {});

  const other    = active ? otherUser(active, user._id) : null;
  const isOnline = (u) => u && socket.onlineUsers.includes(u._id);

  return (
    <div className="chat-layout">

      {/* ── Sidebar ── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="mark">💬</div>
            <span>ChatApp</span>
          </div>
          <button className="icon-btn" title="New chat"  onClick={() => setShowDirect(true)}>✏️</button>
          <button className="icon-btn" title="New group" onClick={() => setShowGroup(true)}>👥</button>
          <button className="icon-btn" title="Logout"    onClick={logout}>🚪</button>
        </div>

        <div style={{
          display:'flex', alignItems:'center', gap:'0.65rem',
          padding:'0.65rem 1.1rem', borderBottom:'1px solid var(--border)'
        }}>
          <Avatar user={user} size={34} />
          <div>
            <div style={{ fontSize:'0.82rem', fontWeight:700 }}>{user.name}</div>
            <div style={{ fontSize:'0.68rem', color:'var(--green)' }}>● Online</div>
          </div>
        </div>

        <div className="search-wrap">
          <input placeholder="🔍  Search or start new chat…"
            readOnly style={{ cursor:'pointer' }}
            onClick={() => setShowDirect(true)} />
        </div>

        <div className="chat-list">
          {chats.length === 0 && (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.82rem' }}>
              No chats yet.<br />Click ✏️ to start one
            </div>
          )}
          {chats.map(chat => {
            const ou   = otherUser(chat, user._id);
            const last = chat.lastMessage;
            return (
              <div key={chat._id}
                className={`chat-item ${active?._id === chat._id ? 'active' : ''}`}
                onClick={() => selectChat(chat)}>
                <Avatar
                  user={chat.isGroup ? { name: chat.name } : ou}
                  size={44} online={isOnline(ou)} />
                <div className="chat-info">
                  <div className="chat-name">{chatName(chat, user._id)}</div>
                  <div className="chat-preview">
                    {last
                      ? (last.type === 'text' ? last.content : `📎 ${last.type}`)
                      : 'Say hello!'}
                  </div>
                </div>
                <div className="chat-meta">
                  {last && <span className="chat-time">{fmtTime(last.createdAt)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main ── */}
      <div className="chat-main">
        {!active ? (
          <>
            <div style={{
              padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)',
              background:'var(--bg-surface)', display:'flex', alignItems:'center', gap:'0.75rem'
            }}>
              <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(true)}>☰</button>
              <span style={{ fontWeight:800, fontSize:'1rem' }}>Messages</span>
            </div>
            <div className="empty-state">
              <div className="big-icon">💬</div>
              <h2>Select a conversation</h2>
              <p>Pick a chat from the sidebar or start a new one</p>
              <button className="btn btn-primary"
                style={{ width:'auto', marginTop:'0.5rem' }}
                onClick={() => setSidebarOpen(true)}>
                Open Chats
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="chat-header">
              <button className="icon-btn mobile-only"
                onClick={() => { setActive(null); setSidebarOpen(true); }}>←</button>
              <Avatar
                user={active.isGroup ? { name: active.name } : other}
                size={38} online={isOnline(other)} />
              <div className="chat-header-info">
                <div className="name">{chatName(active, user._id)}</div>
                <div className={`status ${isOnline(other) ? '' : 'offline'}`}>
                  {active.isGroup
                    ? `${active.members?.length} members`
                    : isOnline(other) ? 'Online' : 'Offline'}
                </div>
              </div>
              {!active.isGroup && (
                <div className="chat-header-actions">
                  <button className="icon-btn"
                    onClick={() => setCallState({
                      callType:'audio', targetId: other._id,
                      targetName: other.name, isCaller: true,
                    })}>📞</button>
                  <button className="icon-btn"
                    onClick={() => setCallState({
                      callType:'video', targetId: other._id,
                      targetName: other.name, isCaller: true,
                    })}>📹</button>
                </div>
              )}
            </div>

            {/* ── Messages ── */}
            <div className="messages-area">
              {Object.entries(grouped).map(([day, msgs]) => (
                <div key={day}>
                  <div className="day-divider"><span>{day}</span></div>
                  {msgs.map(msg => {
                    const isOut = (msg.sender?._id || msg.sender) === user._id;
                    const showBar = reactionBar === msg._id;
                    return (
                      <div key={msg._id}
                        className={`msg-row ${isOut ? 'out' : 'in'}`}
                        style={{ position:'relative', marginBottom:'2px' }}
                        onMouseEnter={e => {
                          const btns = e.currentTarget.querySelectorAll('.msg-action-btn');
                          btns.forEach(b => b.style.opacity = '1');
                        }}
                        onMouseLeave={e => {
                          const btns = e.currentTarget.querySelectorAll('.msg-action-btn');
                          btns.forEach(b => b.style.opacity = '0');
                        }}
                      >
                        {/* Action buttons — react + delete */}
                        <div style={{
                          position:       'absolute',
                          top:            '50%',
                          transform:      'translateY(-50%)',
                          [isOut ? 'right' : 'left']: 'calc(100% + 4px)',
                          display:        'flex',
                          flexDirection:  'column',
                          gap:            '3px',
                          zIndex:         20,
                        }}>
                          {/* Reaction trigger */}
                          <button
                            className="msg-action-btn reaction-trigger"
                            onClick={() => setReactionBar(showBar ? null : msg._id)}
                            style={{
                              background:     'var(--bg-elevated)',
                              border:         '1px solid var(--border)',
                              borderRadius:   '50%',
                              width:          26, height: 26,
                              display:        'flex',
                              alignItems:     'center',
                              justifyContent: 'center',
                              cursor:         'pointer',
                              opacity:        0,
                              transition:     'opacity 0.15s',
                              fontSize:       '0.75rem',
                            }}>
                            😊
                          </button>

                          {/* Delete (own messages only) */}
                          {isOut && (
                            <button
                              className="msg-action-btn del-btn"
                              onClick={() => handleDelete(msg._id)}
                              style={{
                                background:     'var(--bg-elevated)',
                                border:         '1px solid var(--border)',
                                borderRadius:   '50%',
                                width:          26, height: 26,
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'center',
                                cursor:         'pointer',
                                opacity:        0,
                                transition:     'opacity 0.15s',
                                fontSize:       '0.75rem',
                              }}>
                              🗑️
                            </button>
                          )}
                        </div>

                        {/* Reaction bar popup */}
                        {showBar && (
                          <div className="reaction-bar-wrap" style={{
                            position: 'absolute',
                            bottom:   'calc(100% + 4px)',
                            [isOut ? 'right' : 'left']: 0,
                            zIndex:   50,
                          }}>
                            <ReactionBar onSelect={(emoji) => handleReact(msg._id, emoji)} />
                          </div>
                        )}

                        <div className="msg-bubble">
                          {active.isGroup && !isOut && (
                            <div className="sender-name">{msg.sender?.name}</div>
                          )}

                          {msg.type === 'text' && msg.content}

                          {msg.type === 'image' && (
                            <img className="msg-image"
                              src={msg.fileUrl || msg.content} alt="img"
                              onClick={() => window.open(msg.fileUrl || msg.content, '_blank')} />
                          )}

                          {msg.type === 'video' && (
                            <video src={msg.fileUrl} controls
                              style={{ maxWidth:'100%', borderRadius:10 }} />
                          )}

                          {msg.type === 'audio' && (
                            <audio src={msg.fileUrl} controls style={{ width:'100%' }} />
                          )}

                          {msg.type === 'file' && (
                            <a href={msg.fileUrl} target="_blank"
                              rel="noreferrer" className="msg-file">
                              📎 {msg.fileName}
                            </a>
                          )}

                          {/* Reactions display */}
                          <Reactions
                            reactions={msg.reactions}
                            currentUserId={user._id}
                            onReact={(emoji) => handleReact(msg._id, emoji)}
                          />

                          {/* Time + ticks */}
                          <div style={{
                            display:'flex', alignItems:'center',
                            justifyContent:'flex-end', gap:2, marginTop:4,
                          }}>
                            <span className="msg-time">{fmtTime(msg.createdAt)}</span>
                            <Ticks msg={msg} currentUserId={user._id} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="typing-indicator">{typing}</div>

            {/* ── Input ── */}
            <div className="chat-input-area" style={{ position:'relative' }}>
              {showPicker && (
                <div ref={pickerRef}>
                  <EmojiGifPicker
                    onEmojiSelect={handleEmojiSelect}
                    onGifSelect={sendGifOrSticker}
                    onStickerSelect={sendGifOrSticker}
                  />
                </div>
              )}
              <button className="icon-btn"
                title="Emoji / GIF / Sticker"
                style={{ color: showPicker ? 'var(--accent)' : undefined }}
                onClick={() => setShowPicker(p => !p)}>
                😊
              </button>
              <button className="icon-btn" title="Attach file"
                onClick={() => fileRef.current?.click()}>📎</button>
              <input ref={fileRef} type="file" style={{ display:'none' }}
                onChange={e => { sendFile(e.target.files[0]); e.target.value=''; }} />
              <textarea rows={1} placeholder="Type a message…"
                value={input} onChange={handleInput} onKeyDown={handleKey} />
              <button className="send-btn" onClick={sendMsg} disabled={!input.trim()}>➤</button>
            </div>
          </>
        )}
      </div>

      {/* ── New Direct Modal ── */}
      {showDirect && (
        <div className="modal-overlay"
          onClick={() => { setShowDirect(false); setSearchQ(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔍 New Message</h3>
            <input className="modal-input"
              placeholder="Search by name or email…" autoFocus
              value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            {searchRes.map(u => (
              <div key={u._id} className="user-row" onClick={() => openDirect(u._id)}>
                <Avatar user={u} size={38} />
                <div>
                  <div className="uname">{u.name}</div>
                  <div className="uemail">{u.email}</div>
                </div>
              </div>
            ))}
            {searchQ && !searchRes.length && (
              <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'1rem', fontSize:'0.85rem' }}>
                No users found
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── New Group Modal ── */}
      {showGroup && (
        <div className="modal-overlay"
          onClick={() => { setShowGroup(false); setSearchQ(''); setPicked([]); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>👥 New Group</h3>
            <input className="modal-input" placeholder="Group name…" autoFocus
              value={groupName} onChange={e => setGroupName(e.target.value)} />
            <input className="modal-input" placeholder="Search members…"
              value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            {picked.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', marginBottom:'0.75rem' }}>
                {picked.map(u => (
                  <span key={u._id} className="tag">
                    {u.name}
                    <span className="remove"
                      onClick={() => setPicked(prev => prev.filter(x => x._id !== u._id))}>×</span>
                  </span>
                ))}
              </div>
            )}
            {searchRes.filter(u => !picked.find(p => p._id === u._id)).map(u => (
              <div key={u._id} className="user-row"
                onClick={() => { setPicked(prev => [...prev, u]); setSearchQ(''); }}>
                <Avatar user={u} size={36} />
                <div>
                  <div className="uname">{u.name}</div>
                  <div className="uemail">{u.email}</div>
                </div>
              </div>
            ))}
            <button className="btn btn-primary"
              style={{ marginTop:'1rem' }}
              disabled={!groupName || picked.length < 2}
              onClick={createGroup}>
              Create Group →
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}
            style={{ maxWidth:320, textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🗑️</div>
            <h3 style={{ marginBottom:'0.5rem' }}>Delete Message?</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'1.5rem' }}>
              Choose how you want to delete this message
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              <button className="btn btn-primary"
                style={{ background:'linear-gradient(135deg,var(--red),#cc0000)' }}
                onClick={() => confirmDelete('everyone')}>
                🚫 Delete for Everyone
              </button>
              <button className="btn btn-primary"
                style={{ background:'var(--bg-elevated)', color:'var(--text-primary)', border:'1px solid var(--border)' }}
                onClick={() => confirmDelete('me')}>
                🙈 Delete for Me
              </button>
              <button className="btn"
                style={{ color:'var(--text-secondary)', background:'transparent' }}
                onClick={() => setDeleteModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Call UI ── */}
      {(callState || inCall) && (
        <CallUI
          callState={callState}
          inCall={inCall}
          currentUser={user}
          socket={socket}
          onClose={() => { setCallState(null); setInCall(null); }}
        />
      )}
    </div>
  );
}