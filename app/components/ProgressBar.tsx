'use client';

import { useState, useEffect } from 'react';

interface ProgressBarProps {
  currentPage: number;
  totalPages: number;
}

export default function ProgressBar({ currentPage, totalPages }: ProgressBarProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (totalPages === 0) return null;

  return (
    <div className="progress-container">
      <div className="progress-pill">
        <span>
          {currentPage} / {totalPages}
        </span>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <button
        className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        ↑
      </button>
    </div>
  );
}
