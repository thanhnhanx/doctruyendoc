'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ProgressBar from './ProgressBar';

interface PageItemProps {
  index: number;
  globalIndex: number;
  pageUrl: string;
  onVisible: (index: number) => void;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  imageUrl: string | null;
  onRetry: (index: number) => void;
  onLoadError: (index: number) => void;
  onInView: (index: number) => void;
}

function PageItem({ 
  index, 
  globalIndex, 
  pageUrl, 
  onVisible, 
  status, 
  imageUrl, 
  onRetry, 
  onLoadError,
  onInView
}: PageItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Observer for loading the image
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(index);
          // We don't disconnect immediately because we might want to re-trigger if it fails
          // But actually fetchPageImage has its own guards.
        }
      },
      { rootMargin: '1500px 0px', threshold: 0 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [index, onVisible]);

  // Observer for tracking current page location
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onInView(index);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [index, onInView]);

  return (
    <div
      ref={ref}
      className="page-wrapper"
      data-page-index={index}
    >
      {status === 'loaded' && imageUrl ? (
        <img
          src={imageUrl}
          alt={`Trang ${globalIndex + 1}`}
          className="page-image loaded"
          loading="lazy"
          onError={() => onLoadError(index)}
        />
      ) : status === 'error' ? (
        <div className="page-error">
          <span>Tải trang {globalIndex + 1} thất bại</span>
          <button
            className="retry-btn"
            onClick={() => onRetry(index)}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div className="page-skeleton">
          <div className="skeleton-pulse" />
          <span className="page-number-label">
            {status === 'loading'
              ? `Đang tải trang ${globalIndex + 1}...`
              : `Trang ${globalIndex + 1}`}
          </span>
        </div>
      )}
    </div>
  );
}

interface ReaderProps {
  pageUrls: string[];
}

const CHUNK_SIZE = 50;

export default function Reader({ pageUrls }: ReaderProps) {
  const [chunkIndex, setChunkIndex] = useState(0);
  const totalChunks = Math.ceil(pageUrls.length / CHUNK_SIZE);

  const visiblePageUrls = useMemo(() => {
    return pageUrls.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
  }, [pageUrls, chunkIndex]);

  const [pages, setPages] = useState<PageState[]>(() =>
    visiblePageUrls.map(() => ({ imageUrl: null, status: 'idle' }))
  );

  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const globalCurrentPage = (chunkIndex * CHUNK_SIZE) + localCurrentPage;

  const loadingSet = useRef<Set<number>>(new Set());

  useEffect(() => {
    loadingSet.current.clear();
    setPages(visiblePageUrls.map(() => ({ imageUrl: null, status: 'idle' })));
    setLocalCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [chunkIndex, visiblePageUrls]);

  const fetchPageImage = useCallback(
    async (index: number) => {
      // Index is relative to current chunk
      if (loadingSet.current.has(index)) return;
      
      // Safety check for out of bounds
      if (index < 0 || index >= visiblePageUrls.length) return;

      loadingSet.current.add(index);

      setPages((prev) => {
        if (!prev[index] || prev[index].status === 'loading' || prev[index].status === 'loaded') {
          return prev;
        }
        const next = [...prev];
        next[index] = { ...next[index], status: 'loading' };
        return next;
      });

      try {
        const res = await fetch('/api/page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageUrl: visiblePageUrls[index] }),
        });

        if (!res.ok) throw new Error('Failed to fetch page');
        const data = await res.json();

        const proxiedUrl = `/api/proxy?url=${encodeURIComponent(data.imageUrl)}`;

        setPages((prev) => {
          const next = [...prev];
          if (next[index]) {
            next[index] = { imageUrl: proxiedUrl, status: 'loaded' };
          }
          return next;
        });
      } catch {
        loadingSet.current.delete(index);
        setPages((prev) => {
          const next = [...prev];
          if (next[index]) {
            next[index] = { ...next[index], status: 'error' };
          }
          return next;
        });
      }
    },
    [visiblePageUrls]
  );

  const handleRetry = (index: number) => {
    loadingSet.current.delete(index);
    setPages((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { imageUrl: null, status: 'idle' };
      }
      return next;
    });
    setTimeout(() => fetchPageImage(index), 100);
  };

  const handleLoadError = (index: number) => {
    loadingSet.current.delete(index);
    setPages((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], status: 'error' };
      }
      return next;
    });
  };

  const handleInView = useCallback((index: number) => {
    setLocalCurrentPage(index + 1);
  }, []);

  // Preload first 5 images of chunk immediately
  useEffect(() => {
    const preloadCount = Math.min(5, visiblePageUrls.length);
    for (let i = 0; i < preloadCount; i++) {
        fetchPageImage(i);
    }
  }, [fetchPageImage, visiblePageUrls.length]);

  return (
    <>
      <div className="reader-container">
        {totalChunks > 1 && (
          <div className="chunk-nav top">
            <button 
              className="nav-btn" 
              onClick={() => setChunkIndex(i => Math.max(0, i - 1))}
              disabled={chunkIndex === 0}
            >
              ← Phân đoạn trước
            </button>
            <span className="chunk-info">
              Đoạn {chunkIndex + 1} / {totalChunks}
            </span>
            <button 
              className="nav-btn" 
              onClick={() => setChunkIndex(i => Math.min(totalChunks - 1, i + 1))}
              disabled={chunkIndex === totalChunks - 1}
            >
              Phân đoạn sau →
            </button>
          </div>
        )}

        {pages.map((page, index) => (
          <PageItem
            key={`${chunkIndex}-${index}`}
            index={index}
            globalIndex={chunkIndex * CHUNK_SIZE + index}
            pageUrl={visiblePageUrls[index]}
            status={page.status}
            imageUrl={page.imageUrl}
            onVisible={fetchPageImage}
            onRetry={handleRetry}
            onLoadError={handleLoadError}
            onInView={handleInView}
          />
        ))}

        {totalChunks > 1 ? (
          <div className="chunk-nav bottom">
            <button 
              className="nav-btn next-large" 
              onClick={() => setChunkIndex(i => Math.min(totalChunks - 1, i + 1))}
              disabled={chunkIndex === totalChunks - 1}
            >
              {chunkIndex === totalChunks - 1 ? 'Đã hết truyện' : 'Tiếp tục phân đoạn sau →'}
            </button>
            <div className="chunk-nav-small">
              <button 
                className="nav-btn" 
                onClick={() => setChunkIndex(i => Math.max(0, i - 1))}
                disabled={chunkIndex === 0}
              >
                ← Phân đoạn trước
              </button>
              <span className="chunk-info">
                Đoạn {chunkIndex + 1} / {totalChunks}
              </span>
            </div>
          </div>
        ) : (
          <div className="end-screen">
            <h2>✨ Hết truyện</h2>
            <p>Bạn đã đọc hết tất cả các trang</p>
          </div>
        )}
      </div>

      <ProgressBar currentPage={globalCurrentPage} totalPages={pageUrls.length} />
    </>
  );
}

interface PageState {
  imageUrl: string | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
}
