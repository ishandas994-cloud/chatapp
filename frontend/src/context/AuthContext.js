import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
axios.defaults.baseURL = BASE;

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/api/auth/me')
        .then(res => setUser(res.data))
        .catch(()  => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line
  }, []);

  const persist = (token, user) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setToken(token);
    setUser(user);
  };

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    persist(data.token, data.user);
  };

  const register = async (formData) => {
    const { data } = await axios.post('/api/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    persist(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  const updateUser = (u) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, BASE }}>
      {children}
    </AuthContext.Provider>
  );
}