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
// ── Reply Preview (inside bubble) ─────────────────────────────────────────────
function ReplyPreview({ replyTo, isOut }) {
  if (!replyTo?.msgId) return null;
  return (
    <div style={{
      background:   isOut ? 'rgba(0,0,0,0.2)' : 'var(--bg-hover)',
      borderLeft:   '3px solid',
      borderColor:  isOut ? 'rgba(255,255,255,0.5)' : 'var(--accent)',
      borderRadius: '6px',
      padding:      '0.35rem 0.6rem',
      marginBottom: '0.4rem',
      fontSize:     '0.78rem',
      maxWidth:     '100%',
      overflow:     'hidden',
    }}>
      <div style={{
        fontWeight: 700,
        color:      isOut ? 'rgba(255,255,255,0.8)' : 'var(--accent)',
        marginBottom: 2,
        fontSize:   '0.72rem',
      }}>
        {replyTo.senderName}
      </div>
      <div style={{
        color:        isOut ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
        whiteSpace:   'nowrap',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
      }}>
        {replyTo.type === 'text'
          ? replyTo.content
          : replyTo.type === 'image' ? '📷 Photo'
          : replyTo.type === 'video' ? '🎥 Video'
          : replyTo.type === 'audio' ? '🎵 Audio'
          : `📎 ${replyTo.content}`}
      </div>
    </div>
  );
}
// ── Reply Bar (above input) ───────────────────────────────────────────────────
function ReplyBar({ replyTo, onCancel }) {
  if (!replyTo) return null;
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '0.6rem',
      padding:      '0.5rem 1rem',
      background:   'var(--bg-elevated)',
      borderTop:    '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        flex:       1,
        borderLeft: '3px solid var(--accent)',
        paddingLeft: '0.6rem',
        minWidth:   0,
      }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--accent)' }}>
          Replying to {replyTo.senderName}
        </div>
        <div style={{
          fontSize:     '0.78rem',
          color:        'var(--text-secondary)',
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
        }}>
          {replyTo.type === 'text'
            ? replyTo.content
            : replyTo.type === 'image' ? '📷 Photo'
            : replyTo.type === 'video' ? '🎥 Video'
            : replyTo.type === 'audio' ? '🎵 Audio'
            : `📎 File`}
        </div>
      </div>
      <button onClick={onCancel} style={{
        background: 'none', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer',
        fontSize: '1.1rem', padding: '0.2rem',
        flexShrink: 0,
      }}>✕</button>
    </div>
  );
}
// ── Reaction Bar ──────────────────────────────────────────────────────────────
const EMOJIS = ['👍','❤️','😂','😮','😢','🔥'];

function ReactionBar({ onSelect }) {
  return (
    <div style={{
      position:   'absolute',
      bottom:     'calc(100% + 6px)',
      left:       '50%',
      transform:  'translateX(-50%)',
      background: 'var(--bg-elevated)',
      border:     '1px solid var(--border)',
      borderRadius: '999px',
      padding:    '0.35rem 0.6rem',
      display:    'flex',
      gap:        '0.3rem',
      zIndex:     50,
      boxShadow:  '0 8px 24px rgba(0,0,0,0.4)',
      whiteSpace: 'nowrap',
      animation:  'msgPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => onSelect(e)} style={{
          background: 'none', border: 'none',
          cursor: 'pointer', fontSize: '1.25rem',
          padding: '0.1rem 0.15rem', borderRadius: '50%',
          transition: 'transform 0.15s', lineHeight: 1,
        }}
          onMouseEnter={ev => ev.currentTarget.style.transform = 'scale(1.35)'}
          onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}>
          {e}
        </button>
      ))}
    </div>
  );
}
// ── Reactions Display ─────────────────────────────────────────────────────────
function Reactions({ reactions, currentUserId, onReact }) {
  if (!reactions || reactions.length === 0) return null;
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, names: [], mine: false };
    acc[r.emoji].count++;
    acc[r.emoji].names.push(r.name);
    if ((typeof r.userId === 'object' ? r.userId._id : r.userId) === currentUserId)
      acc[r.emoji].mine = true;
    return acc;
  }, {});
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'4px' }}>
      {Object.values(grouped).map(g => (
        <button key={g.emoji} onClick={() => onReact(g.emoji)}
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
