import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageUrl } = body;

    if (!pageUrl) {
      return NextResponse.json({ error: 'pageUrl is required' }, { status: 400 });
    }

    // Fetch the individual page HTML
    const html = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://e-hentai.org/',
      },
    }).then(r => r.text());

    // Extract the full image URL from <img id="img" src="...">
    const imgMatch = html.match(/<img\s+id="img"\s+src="([^"]+)"/);
    
    if (!imgMatch) {
      // Try alternative pattern - sometimes the src comes before id
      const altMatch = html.match(/<img\s+[^>]*src="(https?:\/\/[^"]*\.(?:jpg|png|gif|webp)[^"]*)"/i);
      if (!altMatch) {
        return NextResponse.json({ error: 'Could not extract image URL' }, { status: 500 });
      }
      return NextResponse.json({ imageUrl: altMatch[1] });
    }

    return NextResponse.json({ imageUrl: imgMatch[1] });
  } catch (error) {
    console.error('Page API error:', error);
    return NextResponse.json(
      { error: 'Failed to extract image URL' },
      { status: 500 }
    );
  }
}
