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
