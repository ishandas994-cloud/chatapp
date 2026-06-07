import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

const TENOR_KEY = process.env.REACT_APP_TENOR_API_KEY || '';

export default function EmojiGifPicker({ onEmojiSelect, onGifSelect, onStickerSelect }) {
  const [tab,        setTab]        = useState('emoji'); // emoji | gif | sticker
  const [gifSearch,  setGifSearch]  = useState('');
  const [gifs,       setGifs]       = useState([]);
  const [stickers,   setStickers]   = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const searchTimer = useRef(null);

  // Load trending GIFs on mount
  useEffect(() => {
    if (tab === 'gif')     fetchGifs('trending', false);
    if (tab === 'sticker') fetchStickers('trending');
  }, [tab]);

  const fetchGifs = async (query, isSearch = true) => {
    if (!TENOR_KEY) return;
    setGifLoading(true);
    try {
      const endpoint = isSearch
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=20&media_filter=gif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=20&media_filter=gif`;
      const res  = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch {}
    setGifLoading(false);
  };
  const fetchStickers = async (query) => {
    if (!TENOR_KEY) return;
    setGifLoading(true);
    try {
      const res  = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=20&media_filter=gif&searchfilter=sticker`
      );
      const data = await res.json();
      setStickers(data.results || []);
    } catch {}
    setGifLoading(false);
  };

  const handleGifSearch = (e) => {
    const val = e.target.value;
    setGifSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (val.trim()) fetchGifs(val.trim());
      else fetchGifs('trending', false);
    }, 400);
  };
  const getGifUrl = (result) =>
    result?.media_formats?.gif?.url ||
    result?.media_formats?.tinygif?.url || '';

  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabs}>
        {['emoji', 'gif', 'sticker'].map(t => (
          <button key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}>
            {t === 'emoji' ? '😀 Emoji' : t === 'gif' ? '🎞️ GIF' : '🎨 Sticker'}
          </button>
        ))}
      </div>

      {/* Emoji Tab */}
      {tab === 'emoji' && (
        <div style={styles.emojiWrap}>
          <EmojiPicker
            onEmojiClick={(emojiData) => onEmojiSelect(emojiData.emoji)}
            theme="dark"
            skinTonesDisabled
            searchPlaceHolder="Search emoji..."
            width="100%"
            height={380}
            previewConfig={{ showPreview: false }}
            style={{ background: 'var(--bg-elevated)', border: 'none' }}
          />
        </div>
      )}

      {/* GIF Tab */}
      {tab === 'gif' && (
        <div style={styles.mediaTab}>
          <input
            style={styles.searchInput}
            placeholder="🔍  Search GIFs..."
            value={gifSearch}
            onChange={handleGifSearch}
            autoFocus
          />
          {!TENOR_KEY && (
            <div style={styles.noKey}>
              Add REACT_APP_TENOR_API_KEY to .env to enable GIFs
            </div>
          )}
          {gifLoading ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            <div style={styles.grid}>
              {gifs.map(gif => {
                const url = getGifUrl(gif);
                return url ? (
                  <img key={gif.id} src={url} alt={gif.title}
                    style={styles.gridItem}
                    onClick={() => onGifSelect(url)}
                  />
                ) : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticker Tab */}
      {tab === 'sticker' && (
        <div style={styles.mediaTab}>
          <input
            style={styles.searchInput}
            placeholder="🔍  Search stickers..."
            onChange={(e) => {
              clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() =>
                fetchStickers(e.target.value || 'trending'), 400);
            }}
            autoFocus
          />
          {!TENOR_KEY && (
            <div style={styles.noKey}>
              Add REACT_APP_TENOR_API_KEY to .env to enable Stickers
            </div>
          )}
          {gifLoading ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            <div style={styles.grid}>
              {stickers.map(s => {
                const url = getGifUrl(s);
                return url ? (
                  <img key={s.id} src={url} alt={s.title}
                    style={{ ...styles.gridItem, background: 'transparent' }}
                    onClick={() => onStickerSelect(url)}
                  />
                ) : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const styles = {
  container: {
    position: 'absolute',
    bottom: '64px',
    left: '8px',
    width: '360px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    zIndex: 100,
    animation: 'msgPop 0.2s cubic-bezier(0.34,1.56,0.64,1)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    padding: '0.65rem 0',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
   tabActive: {
    color: 'var(--accent)',
    borderBottom: '2px solid var(--accent)',
    background: 'var(--accent-dim)',
  },
  emojiWrap: {
    padding: '0',
  },
  mediaTab: {
    padding: '0.75rem',
    height: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  searchInput: {
    width: '100%',
    padding: '0.6rem 1rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font)',
    fontSize: '0.85rem',
    outline: 'none',
    flexShrink: 0,
  },