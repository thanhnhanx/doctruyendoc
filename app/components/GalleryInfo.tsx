'use client';

interface GalleryInfoProps {
  title: string;
  titleJpn: string;
  category: string;
  uploader: string;
  pageCount: number;
  tags: string[];
  thumbnail: string;
  onBack: () => void;
}

export default function GalleryInfo({
  title,
  titleJpn,
  category,
  uploader,
  pageCount,
  tags,
  thumbnail,
  onBack,
}: GalleryInfoProps) {
  // Group tags by namespace
  const groupedTags: Record<string, string[]> = {};
  tags.forEach((tag) => {
    const [ns, name] = tag.includes(':') ? tag.split(':') : ['misc', tag];
    if (!groupedTags[ns]) groupedTags[ns] = [];
    groupedTags[ns].push(name);
  });

  const proxyThumb = thumbnail
    ? `/api/proxy?url=${encodeURIComponent(thumbnail)}`
    : '';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="gallery-header">
      <div className="gallery-header-inner">
        <button className="back-btn scroll-up-btn" onClick={scrollToTop} title="Lên đầu trang">
          ↑ Lên đầu
        </button>
        {proxyThumb && (
          <img
            src={proxyThumb}
            alt=""
            className="gallery-thumb"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="gallery-meta">
          <div className="gallery-title" title={title}>
            {title}
          </div>
          <div className="gallery-subtitle">
            {category} • {pageCount} trang • {uploader}
          </div>
          {tags.length > 0 && (
            <div className="gallery-tags">
              {Object.entries(groupedTags)
                .slice(0, 3)
                .map(([ns, names]) =>
                  names.slice(0, 5).map((name) => (
                    <span className="tag" key={`${ns}:${name}`}>
                      {name}
                    </span>
                  ))
                )}
            </div>
          )}
        </div>
        <button className="back-btn" onClick={onBack}>
          ← Quay lại
        </button>
      </div>
    </div>
  );
}
