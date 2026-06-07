import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CallUI from '../components/CallUI';
import EmojiGifPicker from '../components/EmojiGifPicker';

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
const chatName  = (chat, uid) =>
  chat.isGroup ? chat.name : chat.members?.find(m => m._id !== uid)?.name || 'Unknown';

const otherUser = (chat, uid) =>
  chat.isGroup ? null : chat.members?.find(m => m._id !== uid);

export default function ChatPage() {
  const { user, logout }  = useAuth();
  const socket            = useSocket();

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
  