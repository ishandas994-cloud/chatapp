import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const { user, BASE } = useAuth();
  const socketRef      = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    socketRef.current = io(BASE, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current.emit('user:online', user._id);
    socketRef.current.on('users:online', setOnlineUsers);

    return () => socketRef.current?.disconnect();
  }, [user, BASE]);

  const s = socketRef;

  const joinChat       = (id)   => s.current?.emit('chat:join', id);
  const sendMessage    = (msg)  => s.current?.emit('message:send', msg);
  const startTyping    = (cid)  => s.current?.emit('typing:start', { chatId: cid, userId: user._id, userName: user.name });
  const stopTyping     = (cid)  => s.current?.emit('typing:stop',  { chatId: cid, userId: user._id });

  const onMessage      = (cb)   => s.current?.on('message:receive', cb);
  const offMessage     = (cb)   => s.current?.off('message:receive', cb);
  const onTypingStart  = (cb)   => s.current?.on('typing:start', cb);
  const offTypingStart = (cb)   => s.current?.off('typing:start', cb);
  const onTypingStop   = (cb)   => s.current?.on('typing:stop', cb);
  const offTypingStop  = (cb)   => s.current?.off('typing:stop', cb);

  // WebRTC call events
  const initiateCall   = (d)    => s.current?.emit('call:initiate', d);
  const answerCall     = (d)    => s.current?.emit('call:answer', d);
  const rejectCall     = (d)    => s.current?.emit('call:reject', d);
  const endCall        = (d)    => s.current?.emit('call:end', d);
  const sendIce        = (d)    => s.current?.emit('call:ice-candidate', d);

  const onIncomingCall  = (cb)  => s.current?.on('call:incoming', cb);
  const offIncomingCall = (cb)  => s.current?.off('call:incoming', cb);
  const onCallAnswered  = (cb)  => s.current?.on('call:answered', cb);
  const offCallAnswered = (cb)  => s.current?.off('call:answered', cb);
  const onCallRejected  = (cb)  => s.current?.on('call:rejected', cb);
  const onCallEnded     = (cb)  => s.current?.on('call:ended', cb);
  const onIce           = (cb)  => s.current?.on('call:ice-candidate', cb);
  const offIce          = (cb)  => s.current?.off('call:ice-candidate', cb);

  return (
    <SocketContext.Provider value={{
      onlineUsers,
      joinChat, sendMessage, startTyping, stopTyping,
      onMessage, offMessage,
      onTypingStart, offTypingStart, onTypingStop, offTypingStop,
      initiateCall, answerCall, rejectCall, endCall, sendIce,
      onIncomingCall, offIncomingCall,
      onCallAnswered, offCallAnswered,
      onCallRejected, onCallEnded,
      onIce, offIce,
    }}>
      {children}
    </SocketContext.Provider>
  );
}