'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ProgressBar from './ProgressBar';

interface ReaderProps {
  pageUrls: string[];
}

interface PageState {
  imageUrl: string | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

const CHUNK_SIZE = 50;

export default function Reader({ pageUrls }: ReaderProps) {
  const [chunkIndex, setChunkIndex] = useState(0);
  const totalChunks = Math.ceil(pageUrls.length / CHUNK_SIZE);

  // Get current chunk of URLs
  const visiblePageUrls = useMemo(() => {
    return pageUrls.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
  }, [pageUrls, chunkIndex]);

  const [pages, setPages] = useState<PageState[]>(() =>
    visiblePageUrls.map(() => ({ imageUrl: null, status: 'idle' }))
  );

  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const globalCurrentPage = (chunkIndex * CHUNK_SIZE) + localCurrentPage;

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const loadingSet = useRef<Set<number>>(new Set());

  // Reset pages state and refs when chunk changes
  useEffect(() => {
    loadingSet.current.clear();
    setPages(visiblePageUrls.map(() => ({ imageUrl: null, status: 'idle' })));
    setLocalCurrentPage(1);
    pageRefs.current = [];
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [chunkIndex, visiblePageUrls]);

  // Fetch image URL for a specific page within the current chunk
  const fetchPageImage = useCallback(
    async (index: number) => {
      // Index is relative to current chunk
      if (loadingSet.current.has(index)) return;
      loadingSet.current.add(index);

      setPages((prev) => {
        if (prev[index]?.status === 'loading' || prev[index]?.status === 'loaded') {
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
          next[index] = { imageUrl: proxiedUrl, status: 'loaded' };
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

  // Set up IntersectionObserver for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = (entry.target as HTMLElement).dataset.pageIndex;
            if (indexStr !== undefined) {
              const index = parseInt(indexStr);
              fetchPageImage(index);
            }
          }
        });
      },
      {
        rootMargin: '1200px 0px',
        threshold: 0,
      }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [fetchPageImage, pages.length]); // pages.length to re-observe when chunk changes

  // Set up IntersectionObserver for tracking current page within chunk
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = (entry.target as HTMLElement).dataset.pageIndex;
            if (indexStr !== undefined) {
              const index = parseInt(indexStr);
              setLocalCurrentPage(index + 1);
            }
          }
        });
      },
      {
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0,
      }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [visiblePageUrls, pages.length]);

  // Preload first few pages of the current chunk
  useEffect(() => {
    const preloadCount = Math.min(5, visiblePageUrls.length);
    for (let i = 0; i < preloadCount; i++) {
      fetchPageImage(i);
    }
  }, [fetchPageImage, visiblePageUrls.length]);

  const retryPage = (index: number) => {
    loadingSet.current.delete(index);
    setPages((prev) => {
      const next = [...prev];
      next[index] = { imageUrl: null, status: 'idle' };
      return next;
    });
    setTimeout(() => fetchPageImage(index), 100);
  };

  const goToNextChunk = () => {
    if (chunkIndex < totalChunks - 1) {
      setChunkIndex(prev => prev + 1);
    }
  };

  const goToPrevChunk = () => {
    if (chunkIndex > 0) {
      setChunkIndex(prev => prev - 1);
    }
  };

  return (
    <>
      <div className="reader-container">
        {totalChunks > 1 && (
          <div className="chunk-nav top">
            <button 
              className="nav-btn" 
              onClick={goToPrevChunk} 
              disabled={chunkIndex === 0}
            >
              ← Phân đoạn trước
            </button>
            <span className="chunk-info">
              Đoạn {chunkIndex + 1} / {totalChunks}
            </span>
            <button 
              className="nav-btn" 
              onClick={goToNextChunk} 
              disabled={chunkIndex === totalChunks - 1}
            >
              Phân đoạn sau →
            </button>
          </div>
        )}

        {pages.map((page, index) => (
          <div
            key={`${chunkIndex}-${index}`}
            className="page-wrapper"
            ref={(el) => {
              pageRefs.current[index] = el;
            }}
            data-page-index={index}
          >
            {page.status === 'loaded' && page.imageUrl ? (
              <img
                src={page.imageUrl}
                alt={`Trang ${chunkIndex * CHUNK_SIZE + index + 1}`}
                className="page-image loaded"
                loading="lazy"
                onError={() => {
                  loadingSet.current.delete(index);
                  setPages((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], status: 'error' };
                    return next;
                  });
                }}
              />
            ) : page.status === 'error' ? (
              <div className="page-error">
                <span>Tải trang {chunkIndex * CHUNK_SIZE + index + 1} thất bại</span>
                <button
                  className="retry-btn"
                  onClick={() => retryPage(index)}
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <div className="page-skeleton">
                <div className="skeleton-pulse" />
                <span className="page-number-label">
                  {page.status === 'loading'
                    ? `Đang tải trang ${chunkIndex * CHUNK_SIZE + index + 1}...`
                    : `Trang ${chunkIndex * CHUNK_SIZE + index + 1}`}
                </span>
              </div>
            )}
          </div>
        ))}

        {totalChunks > 1 ? (
          <div className="chunk-nav bottom">
            <button 
              className="nav-btn next-large" 
              onClick={goToNextChunk} 
              disabled={chunkIndex === totalChunks - 1}
            >
              {chunkIndex === totalChunks - 1 ? 'Đã hết truyện' : 'Tiếp tục phân đoạn sau →'}
            </button>
            <div className="chunk-nav-small">
              <button 
                className="nav-btn" 
                onClick={goToPrevChunk} 
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
