import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CallUI from '../components/CallUI';

function Avatar({ user, size = 44, online = false }) {
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';
  return (
    <div className="av-wrap" style={{ width: size, height: size }}>
      {user?.avatar
        ? <img className="av-img" src={user.avatar} alt={user.name} style={{ width: size, height: size }} />
        : <div className="av-placeholder" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>
      }
      {online && <span className="online-dot" />}
    </div>
  );
}

const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
const fmtDay  = (d) => {
  const t = new Date(), x = new Date(d);
  const y = new Date(t); y.setDate(y.getDate()-1);
  if (x.toDateString() === t.toDateString()) return 'Today';
  if (x.toDateString() === y.toDateString()) return 'Yesterday';
  return x.toLocaleDateString([], { month:'short', day:'numeric' });
};

const chatName = (chat, uid) =>
  chat.isGroup ? chat.name : chat.members?.find(m => m._id !== uid)?.name || 'Unknown';

const otherUser = (chat, uid) =>
  chat.isGroup ? null : chat.members?.find(m => m._id !== uid);

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
  const [searchQ,      setSearchQ]      = useState('');
  const [searchRes,    setSearchRes]    = useState([]);
  const [groupName,    setGroupName]    = useState('');
  const [picked,       setPicked]       = useState([]);
  const [callState,    setCallState]    = useState(null);
  const [inCall,       setInCall]       = useState(null);

  const endRef      = useRef(null);
  const typingTimer = useRef(null);
  const fileRef     = useRef(null);

  // Load chats
  const loadChats = useCallback(() =>
    axios.get('/api/chats').then(r => setChats(r.data)).catch(() => {}), []);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Socket listeners
  useEffect(() => {
    const onMsg = (msg) => {
      setMessages(prev => [...prev, msg]);
      setChats(prev =>
        prev.map(c => c._id === msg.chatId ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
            .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    };
    const onTStart = ({ userId, userName }) => { if (userId !== user._id) setTyping(`${userName} is typing...`); };
    const onTStop  = () => setTyping('');

    socket.onMessage(onMsg);
    socket.onTypingStart(onTStart);
    socket.onTypingStop(onTStop);
    return () => { socket.offMessage(onMsg); socket.offTypingStart(onTStart); socket.offTypingStop(onTStop); };
  }, [socket, user._id]);

  // Incoming call
  useEffect(() => {
    const cb = (data) => setInCall({ ...data, type: 'incoming' });
    socket.onIncomingCall(cb);
    return () => socket.offIncomingCall(cb);
  }, [socket]);

  // Load messages on chat select
  useEffect(() => {
    if (!active) return;
    socket.joinChat(active._id);
    axios.get(`/api/messages/${active._id}`).then(r => setMessages(r.data)).catch(() => {});
  }, [active, socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Search users
  useEffect(() => {
    if (!searchQ) { setSearchRes([]); return; }
    const t = setTimeout(() =>
      axios.get(`/api/users/search?q=${searchQ}`).then(r => setSearchRes(r.data)).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  const selectChat = (chat) => { setActive(chat); setSidebarOpen(false); };

  const sendMsg = async () => {
    const text = input.trim();
    if (!text || !active) return;
    setInput('');
    socket.stopTyping(active._id);
    try {
      const { data: msg } = await axios.post('/api/messages', { chatId: active._id, content: text });
      setMessages(prev => [...prev, msg]);
      socket.sendMessage({ ...msg, chatId: active._id });
      setChats(prev =>
        prev.map(c => c._id === active._id ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c)
            .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    } catch {}
  };

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

  // Group messages by day
  const grouped = messages.reduce((acc, msg) => {
    const day = fmtDay(msg.createdAt);
    (acc[day] = acc[day] || []).push(msg);
    return acc;
  }, {});

  const other = active ? otherUser(active, user._id) : null;
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

        {/* Current user strip */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'0.65rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
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
                <Avatar user={chat.isGroup ? { name: chat.name } : ou} size={44} online={isOnline(ou)} />
                <div className="chat-info">
                  <div className="chat-name">{chatName(chat, user._id)}</div>
                  <div className="chat-preview">
                    {last ? (last.type === 'text' ? last.content : `📎 ${last.type}`) : 'Say hello!'}
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
            <div style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(true)}>☰</button>
              <span style={{ fontWeight:800, fontSize:'1rem' }}>Messages</span>
            </div>
            <div className="empty-state">
              <div className="big-icon">💬</div>
              <h2>Select a conversation</h2>
              <p>Pick a chat from the sidebar or start a new one</p>
              <button className="btn btn-primary" style={{ width:'auto', marginTop:'0.5rem' }}
                onClick={() => setSidebarOpen(true)}>
                Open Chats
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header">
              <button className="icon-btn mobile-only"
                onClick={() => { setActive(null); setSidebarOpen(true); }}>←</button>
              <Avatar user={active.isGroup ? { name: active.name } : other}
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
                  <button className="icon-btn" onClick={() => setCallState({ callType:'audio', targetId: other._id, targetName: other.name, isCaller: true })}>📞</button>
                  <button className="icon-btn" onClick={() => setCallState({ callType:'video', targetId: other._id, targetName: other.name, isCaller: true })}>📹</button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="messages-area">
              {Object.entries(grouped).map(([day, msgs]) => (
                <div key={day}>
                  <div className="day-divider"><span>{day}</span></div>
                  {msgs.map(msg => {
                    const isOut = (msg.sender?._id || msg.sender) === user._id;
                    return (
                      <div key={msg._id} className={`msg-row ${isOut ? 'out' : 'in'}`}>
                        <div className="msg-bubble">
                          {active.isGroup && !isOut && (
                            <div className="sender-name">{msg.sender?.name}</div>
                          )}
                          {msg.type === 'text'  && msg.content}
                          {msg.type === 'image' && <img className="msg-image" src={msg.fileUrl} alt="img" onClick={() => window.open(msg.fileUrl,'_blank')} />}
                          {msg.type === 'video' && <video src={msg.fileUrl} controls style={{ maxWidth:'100%', borderRadius:10 }} />}
                          {msg.type === 'audio' && <audio src={msg.fileUrl} controls style={{ width:'100%' }} />}
                          {msg.type === 'file'  && <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="msg-file">📎 {msg.fileName}</a>}
                          <div className="msg-time">{fmtTime(msg.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="typing-indicator">{typing}</div>

            {/* Input */}
            <div className="chat-input-area">
              <button className="icon-btn" onClick={() => fileRef.current?.click()}>📎</button>
              <input ref={fileRef} type="file" style={{ display:'none' }}
                onChange={e => { sendFile(e.target.files[0]); e.target.value=''; }} />
              <textarea rows={1} placeholder="Type a message…"
                value={input} onChange={handleInput} onKeyDown={handleKey} />
              <button className="send-btn" onClick={sendMsg} disabled={!input.trim()}>➤</button>
            </div>
          </>
        )}
      </div>

      {/* ── New Direct Chat Modal ── */}
      {showDirect && (
        <div className="modal-overlay" onClick={() => { setShowDirect(false); setSearchQ(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔍 New Message</h3>
            <input className="modal-input" placeholder="Search by name or email…" autoFocus
              value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            {searchRes.map(u => (
              <div key={u._id} className="user-row" onClick={() => openDirect(u._id)}>
                <Avatar user={u} size={38} />
                <div><div className="uname">{u.name}</div><div className="uemail">{u.email}</div></div>
              </div>
            ))}
            {searchQ && !searchRes.length && (
              <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'1rem', fontSize:'0.85rem' }}>No users found</div>
            )}
          </div>
        </div>
      )}

      {/* ── New Group Modal ── */}
      {showGroup && (
        <div className="modal-overlay" onClick={() => { setShowGroup(false); setSearchQ(''); setPicked([]); }}>
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
                    <span className="remove" onClick={() => setPicked(prev => prev.filter(x => x._id !== u._id))}>×</span>
                  </span>
                ))}
              </div>
            )}
            {searchRes.filter(u => !picked.find(p => p._id === u._id)).map(u => (
              <div key={u._id} className="user-row"
                onClick={() => { setPicked(prev => [...prev, u]); setSearchQ(''); }}>
                <Avatar user={u} size={36} />
                <div><div className="uname">{u.name}</div><div className="uemail">{u.email}</div></div>
              </div>
            ))}
            <button className="btn btn-primary" style={{ marginTop:'1rem' }}
              disabled={!groupName || picked.length < 2}
              onClick={createGroup}>
              Create Group →
            </button>
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