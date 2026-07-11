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
