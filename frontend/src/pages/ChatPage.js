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
