import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [form,    setForm]    = useState({ name: '', email: '', password: '' });
  const [avatar,  setAvatar]  = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate     = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name',     form.name);
      fd.append('email',    form.email);
      fd.append('password', form.password);
      if (avatar) fd.append('avatar', avatar);
      await register(fd);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">💬</div>
          <h1>ChatApp</h1>
          <p>Create your account</p>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" placeholder="Your name" required autoFocus
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="you@example.com" required
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Min 6 characters" required
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Profile photo (optional)</label>
            <input type="file" accept="image/*"
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}
              onChange={e => setAvatar(e.target.files[0])} />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>
        <div className="auth-switch">
          Already have one? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}