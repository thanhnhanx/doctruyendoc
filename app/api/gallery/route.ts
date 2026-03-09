import { NextRequest, NextResponse } from 'next/server';

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

function extractGidToken(url: string): { gid: string; token: string } | null {
  // Match patterns like /g/123456/abcdef1234/
  const match = url.match(/\/g\/(\d+)\/([a-f0-9]+)/i);
  if (match) {
    return { gid: match[1], token: match[2] };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Normalize URL to e-hentai.org
    const normalizedUrl = url.replace('exhentai.org', 'e-hentai.org');

    const parsed = extractGidToken(normalizedUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid e-hentai gallery URL' }, { status: 400 });
    }

    // Fetch gallery metadata via API
    const apiResponse = await fetch('https://api.e-hentai.org/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'gdata',
        gidlist: [[parseInt(parsed.gid), parsed.token]],
        namespace: 1,
      }),
    });

    const apiData = await apiResponse.json();
    const meta = apiData.gmetadata?.[0];

    if (!meta || meta.error) {
      return NextResponse.json({ error: 'Gallery not found or invalid token' }, { status: 404 });
    }

    // Now scrape the gallery page(s) to get individual page URLs
    const pageCount = parseInt(meta.filecount);
    const pageUrls: string[] = [];

    // Gallery pages: each listing page shows ~40 thumbnails
    const listingPages = Math.ceil(pageCount / 40);

    for (let p = 0; p < listingPages; p++) {
      const listingUrl = `https://e-hentai.org/g/${parsed.gid}/${parsed.token}/?p=${p}`;
      const pageHtml = await fetch(listingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      }).then(r => r.text());

      // Extract page links from the gallery listing
      // Pattern: href="https://e-hentai.org/s/hash/gid-page"
      const linkRegex = /href="(https?:\/\/e-hentai\.org\/s\/[a-f0-9]+\/\d+-\d+)"/g;
      let match;
      while ((match = linkRegex.exec(pageHtml)) !== null) {
        if (!pageUrls.includes(match[1])) {
          pageUrls.push(match[1]);
        }
      }
    }

    // Sort page URLs by page number
    pageUrls.sort((a, b) => {
      const aNum = parseInt(a.split('-').pop() || '0');
      const bNum = parseInt(b.split('-').pop() || '0');
      return aNum - bNum;
    });

    const galleryData: GalleryData = {
      title: meta.title || '',
      titleJpn: meta.title_jpn || '',
      category: meta.category || '',
      uploader: meta.uploader || '',
      pageCount: pageCount,
      tags: meta.tags || [],
      thumbnail: meta.thumb || '',
      pageUrls: pageUrls,
    };

    return NextResponse.json(galleryData);
  } catch (error) {
    console.error('Gallery API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery data' },
      { status: 500 }
    );
  }
}
