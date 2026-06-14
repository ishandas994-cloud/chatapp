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