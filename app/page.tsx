'use client';

import { useState } from 'react';
import GalleryInfo from './components/GalleryInfo';
import Reader from './components/Reader';

interface GalleryData {
  title: string;
  titleJpn: string;
  category: string;
  uploader: string;
  pageCount: number;
  tags: string[];
  thumbnail: string;
  pageUrls: string[];
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGallery = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setGallery(null);

    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load gallery');
      }

      const data: GalleryData = await res.json();

      if (data.pageUrls.length === 0) {
        throw new Error('No pages found in this gallery');
      }

      setGallery(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      loadGallery();
    }
  };

  const handleBack = () => {
    setGallery(null);
    window.scrollTo({ top: 0 });
  };

  // Reader mode
  if (gallery) {
    return (
      <>
        <GalleryInfo
          title={gallery.title}
          titleJpn={gallery.titleJpn}
          category={gallery.category}
          uploader={gallery.uploader}
          pageCount={gallery.pageCount}
          tags={gallery.tags}
          thumbnail={gallery.thumbnail}
          onBack={handleBack}
        />
        <Reader pageUrls={gallery.pageUrls} />
      </>
    );
  }

  // Home / Input mode
  return (
    <>
      <div className="hero">
        <h1 className="logo">Đọc Truyện Dọc <span className="version">v1.1.0</span></h1>
        <p className="subtitle">Trải nghiệm đọc truyện cuộn dọc xuyên suốt</p>

        <div className="input-container">
          <div className="input-wrapper">
            <input
              type="url"
              className="url-input"
              placeholder="Dán link gallery vào đây..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
            />
            <button
              className="load-btn"
              onClick={loadGallery}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Đang tải...
                </>
              ) : (
                'Đọc →'
              )}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Đang tải dữ liệu truyện...</div>
          <div className="loading-progress">
            Có thể mất chút thời gian với truyện dài
          </div>
        </div>
      )}
    </>
  );
}
