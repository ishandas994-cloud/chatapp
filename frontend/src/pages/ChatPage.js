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