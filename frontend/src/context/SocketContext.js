import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

const POLL_INTERVAL = 2000; // poll every 2 seconds

export function SocketProvider({ children }) {
  const { user } = useAuth();

  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  // Callbacks registered by ChatPage
  const msgCallbacks      = useRef([]);
  const typingStartCbs    = useRef([]);
  const typingStopCbs     = useRef([]);
  const readCbs           = useRef([]);
  const incomingCallCbs   = useRef([]);
  const callAnsweredCbs   = useRef([]);
  const callRejectedCbs   = useRef([]);
  const callEndedCbs      = useRef([]);
  const iceCbs            = useRef([]);

  // Polling state
  const lastMsgTime       = useRef(new Date().toISOString());
  const lastChatTime      = useRef(new Date().toISOString());
  const pollRef           = useRef(null);
  const chatPollRef       = useRef(null);
  const activeChatIdRef   = useRef(null);