'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProgressBar from './ProgressBar';

interface ReaderProps {
  pageUrls: string[];
}

interface PageState {
  imageUrl: string | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

export default function Reader({ pageUrls }: ReaderProps) {
  const [pages, setPages] = useState<PageState[]>(() =>
    pageUrls.map(() => ({ imageUrl: null, status: 'idle' }))
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const loadingSet = useRef<Set<number>>(new Set());

  // Fetch image URL for a specific page, using ref to track loading state
  const fetchPageImage = useCallback(
    async (index: number) => {
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
          body: JSON.stringify({ pageUrl: pageUrls[index] }),
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
          next[index] = { ...next[index], status: 'error' };
          return next;
        });
      }
    },
    [pageUrls]
  );

  // Set up IntersectionObserver for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(
              (entry.target as HTMLElement).dataset.pageIndex || '0'
            );
            fetchPageImage(index);
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
  }, [fetchPageImage]);

  // Set up IntersectionObserver for tracking current page
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(
              (entry.target as HTMLElement).dataset.pageIndex || '0'
            );
            setCurrentPage(index + 1);
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
  }, [pageUrls]);

  // Preload first few pages immediately
  useEffect(() => {
    const preloadCount = Math.min(5, pageUrls.length);
    for (let i = 0; i < preloadCount; i++) {
      fetchPageImage(i);
    }
  }, [fetchPageImage, pageUrls.length]);

  const retryPage = (index: number) => {
    loadingSet.current.delete(index);
    setPages((prev) => {
      const next = [...prev];
      next[index] = { imageUrl: null, status: 'idle' };
      return next;
    });
    setTimeout(() => fetchPageImage(index), 100);
  };

  return (
    <>
      <div className="reader-container">
        {pages.map((page, index) => (
          <div
            key={index}
            className="page-wrapper"
            ref={(el) => {
              pageRefs.current[index] = el;
            }}
            data-page-index={index}
          >
            {page.status === 'loaded' && page.imageUrl ? (
              <img
                src={page.imageUrl}
                alt={`Page ${index + 1}`}
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
                <span>Tải trang {index + 1} thất bại</span>
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
                    ? `Đang tải trang ${index + 1}...`
                    : `Trang ${index + 1}`}
                </span>
              </div>
            )}
          </div>
        ))}

        <div className="end-screen">
          <h2>✨ Hết truyện</h2>
          <p>Bạn đã đọc hết tất cả các trang</p>
        </div>
      </div>

      <ProgressBar currentPage={currentPage} totalPages={pageUrls.length} />
    </>
  );
}
