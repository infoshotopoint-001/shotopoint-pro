'use strict';

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 12000,
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
      ['yt:videoId', 'yt:videoId']
    ]
  }
});

const TTL_MS = Math.max(60000, Number(process.env.NEWS_CACHE_TTL_MS || 180000));
const cache = new Map();

const sources = [
  {
    key: 'sun', name: 'The Sun Nigeria', defaultCategory: 'nigeria',
    enabled: process.env.SUN_RSS_ENABLED !== 'false',
    urls: [process.env.SUN_RSS_URL || 'https://thesun.ng/feed/', 'https://sunnewsonline.com/feed/']
  },
  {
    key: 'vanguard', name: 'Vanguard', defaultCategory: 'nigeria',
    enabled: process.env.VANGUARD_RSS_ENABLED !== 'false',
    urls: [process.env.VANGUARD_RSS_URL || 'https://www.vanguardngr.com/feed/']
  },
  {
    key: 'aljazeera', name: 'Al Jazeera English', defaultCategory: 'world',
    enabled: process.env.ALJAZEERA_RSS_ENABLED !== 'false',
    urls: [process.env.ALJAZEERA_RSS_URL || 'https://www.aljazeera.com/xml/rss/all.xml']
  },
  {
    key: 'bbc', name: 'BBC News', defaultCategory: 'world',
    enabled: process.env.BBC_RSS_LICENSED === 'true', licensed: process.env.BBC_RSS_LICENSED === 'true',
    note: 'Disabled until SPP confirms appropriate business-use permission/licence.',
    urls: ['https://feeds.bbci.co.uk/news/rss.xml']
  },
  {
    key: 'fox', name: 'FOX News', defaultCategory: 'world',
    enabled: process.env.FOX_RSS_LICENSED === 'true', licensed: process.env.FOX_RSS_LICENSED === 'true',
    note: 'Disabled until SPP confirms appropriate commercial-use permission/licence.',
    urls: ['https://moxie.foxnews.com/google-publisher/latest.xml']
  }
];

function safeUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function mediaUrl(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    for (const item of value) { const found = mediaUrl(item); if (found) return found; }
    return '';
  }
  if (typeof value === 'string') return safeUrl(value);
  if (typeof value === 'object') return safeUrl(value.url || value.href || (value.$ && (value.$.url || value.$.href)) || '');
  return '';
}

function findImage(item) {
  const direct = mediaUrl(item.enclosure) || mediaUrl(item.image) ||
    mediaUrl(item['media:thumbnail']) || mediaUrl(item['media:content']);
  if (direct) return direct;
  const html = String(item['content:encoded'] || item.content || item.description || '');
  const match = html.match(/<img\b[^>]*?src=["']([^"']+)["']/i);
  return match ? safeUrl(match[1]) : '';
}

const topicRules = [
  ['politics', /politic|president|governor|senate|senator|minister|election|campaign|vote|parliament|lawmakers|government|policy/],
  ['football', /football|soccer|premier league|\bepl\b|fifa|uefa|afcon|super eagles|chelsea|arsenal|liverpool|manchester|goalkeeper|striker|league match|transfer window/],
  ['movies', /movie|film|cinema|nollywood|box office|film festival|premiere|screenplay|filmmaker|director|streaming series/],
  ['actors', /actor|actress|cast member|screen star|performer|role in/],
  ['musicians', /musician|singer|songwriter|new single|album|afrobeats|rapper|music video|concert|record label|grammy|music award/],
  ['celebrities', /celebrity|showbiz|entertainment|reality star|red carpet|celebrity couple/],
  ['talents', /talent|audition|emerging artist|up-and-coming|contestant|creative talent|rising star/],
  ['media', /media|journalist|journalism|press freedom|newsroom|broadcast|television station|radio station|publisher|publishing/],
  ['tech', /technology|tech company|artificial intelligence|\bai\b|cybersecurity|software|smartphone|startup|digital platform|internet|robotics|data breach|gadget/],
  ['business', /business|economy|market|company|trade|investment|finance|bank|inflation|revenue/],
  ['world', /international|global|united states|white house|european union|middle east|united nations|world leaders|foreign affairs/]
];

function classify(title, description, itemCategories, defaultCategory) {
  const text = `${title} ${description} ${(itemCategories || []).join(' ')}`.toLowerCase();
  const result = [];
  for (const [category, pattern] of topicRules) if (pattern.test(text)) result.push(category);
  if (defaultCategory && !result.includes(defaultCategory)) result.push(defaultCategory);
  if (defaultCategory === 'nigeria' && !result.includes('nigeria')) result.push('nigeria');
  if (!result.length) result.push(defaultCategory || 'world');
  return [...new Set(result)];
}

function normalise(item, source) {
  const title = stripHtml(item.title || '').slice(0, 350);
  const description = stripHtml(item.contentSnippet || item.summary || item.content || item['content:encoded'] || item.description || '').slice(0, 350);
  const url = safeUrl(item.link || item.guid || item.id);
  if (!title || !url) return null;
  const categories = classify(title, description, item.categories, source.defaultCategory);
  const published = new Date(item.isoDate || item.pubDate || item.published || Date.now());
  return {
    id: `${source.key}-${Buffer.from(url).toString('base64url').slice(0, 18)}`,
    title, description, url, image: findImage(item), source: source.name,
    category: categories.find(c => c !== 'nigeria' && c !== 'world') || categories[0] || source.defaultCategory,
    categories,
    published_at: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
    author: stripHtml(item.creator || item.author || '').slice(0, 100)
  };
}

async function parseFeed(url) {
  const now = Date.now();
  const existing = cache.get(url);
  if (existing && existing.expires > now) return existing.promise || existing.value;

  const promise = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
      headers: {
        'user-agent': 'SPP-Newsroom/1.0 (+https://www.shotopoint.com)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
    const xml = await response.text();
    const parsed = await parser.parseString(xml);
    return { items: parsed.items || [], title: parsed.title || '' };
  })();
  cache.set(url, { expires: now + 15000, promise });
  try {
    const value = await promise;
    cache.set(url, { expires: Date.now() + TTL_MS, value });
    return value;
  } catch (error) {
    cache.delete(url);
    throw error;
  }
}

async function fetchSource(source) {
  if (!source.enabled) {
    return { items: [], status: { ok: false, items: 0, licensed: source.licensed, note: source.note || 'Disabled in environment settings.' } };
  }
  let lastError = null;
  for (const url of source.urls) {
    try {
      const feed = await parseFeed(url);
      const items = (feed.items || []).map(item => normalise(item, source)).filter(Boolean);
      return { items, status: { ok: true, items: items.length, note: `Connected${feed.title ? `: ${feed.title}` : ''}` } };
    } catch (error) { lastError = error; }
  }
  return { items: [], status: { ok: false, items: 0, note: lastError ? lastError.message : 'Feed unavailable.' } };
}

function categoryMatches(item, selected) {
  if (!selected || selected === 'all') return true;
  if (selected === 'spp') return false;
  return (item.categories || [item.category]).includes(selected);
}

async function fetchYouTubeVideos() {
  const channelId = String(process.env.SPP_YOUTUBE_CHANNEL_ID || '').trim();
  if (!channelId) return { items: [], status: { ok: false, items: 0, note: 'Set SPP_YOUTUBE_CHANNEL_ID in Vercel environment variables.' } };
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) return { items: [], status: { ok: false, items: 0, note: 'SPP_YOUTUBE_CHANNEL_ID does not look like a YouTube channel ID.' } };
  try {
    const feed = await parseFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    const items = (feed.items || []).map(item => {
      const url = safeUrl(item.link || '');
      if (!url) return null;
      const videoMatch = url.match(/[?&]v=([^&]+)/) || String(item.id || '').match(/yt:video:([^:]+):([^:]+)$/);
      const videoId = (videoMatch && (videoMatch[2] || videoMatch[1])) || '';
      const published = new Date(item.isoDate || item.pubDate || Date.now());
      return {
        id: videoId || url, title: stripHtml(item.title || 'SPP YouTube video').slice(0, 250),
        description: stripHtml(item.contentSnippet || item.description || '').slice(0, 250),
        url, image: videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : '',
        source: 'Shoto Point Production · YouTube', category: 'video', categories: ['video'],
        published_at: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString()
      };
    }).filter(Boolean).slice(0, 12);
    return { items, status: { ok: true, items: items.length, note: 'Official YouTube channel feed connected.' } };
  } catch (error) {
    return { items: [], status: { ok: false, items: 0, note: `YouTube feed: ${error.message}` } };
  }
}


async function fetchSppCmsItems(req) {
  const db = req.app && req.app.locals && req.app.locals.sppDb;
  if (!db) return [];
  const [rows] = await db.query(
    "SELECT id,title,body,media_url,link_url,settings_json,published_at,updated_at FROM cms_content_blocks WHERE section='news' AND content_type='Article' AND status='published' AND (scheduled_at IS NULL OR scheduled_at<=NOW()) ORDER BY COALESCE(published_at,updated_at) DESC LIMIT 60"
  );
  return rows.map(row => {
    let settings = {};
    try { settings = typeof row.settings_json === 'string' ? JSON.parse(row.settings_json || '{}') : (row.settings_json || {}); } catch {}
    const rawCategory = String(settings.category || 'SPP Originals');
    const categorySlug = rawCategory.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const description = String(settings.excerpt || stripHtml(row.body || '')).slice(0, 350);
    const rawImage = String(row.media_url || settings.featuredImage || settings.image || '');
    let image = rawImage.startsWith('/') ? rawImage : safeUrl(rawImage);
    if (!image) {
      const match = String(row.body || '').match(/<img\b[^>]*?src=["']([^"']+)["']/i);
      if (match) image = String(match[1]).startsWith('/') ? String(match[1]) : safeUrl(match[1]);
    }
    const published = row.published_at || row.updated_at || new Date();
    const publishedDate = new Date(published);
    return {
      id: `spp-${row.id}`,
      cms_id: Number(row.id),
      title: String(row.title || 'Shoto Point Production update'),
      description,
      url: `/news-article.html?id=${encodeURIComponent(row.id)}`,
      image,
      source: 'Shoto Point Production',
      category: rawCategory,
      categories: [categorySlug, 'spp'],
      published_at: Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString(),
      author: String(settings.author || 'Shoto Point Editorial')
    };
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const allowed = new Set(['all', 'nigeria', 'politics', 'celebrities', 'movies', 'actors', 'musicians', 'talents', 'football', 'media', 'tech', 'world', 'spp', 'business', 'entertainment']);
  const requestedCategory = String(req.query.category || 'all').toLowerCase();
  const category = allowed.has(requestedCategory) ? requestedCategory : 'all';
  const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit || '24', 10) || 24));

  try {
    const results = await Promise.all(sources.map(fetchSource));
    const sourceStatus = {};
    let allItems = [];
    for (let i = 0; i < sources.length; i++) {
      sourceStatus[sources[i].name] = results[i].status;
      allItems = allItems.concat(results[i].items);
    }

    // Handle the broad Entertainment label from older versions of the news page.
    if (category === 'entertainment') {
      allItems = allItems.filter(item => ['celebrities', 'movies', 'actors', 'musicians', 'talents'].some(c => (item.categories || []).includes(c)));
    } else {
      allItems = allItems.filter(item => categoryMatches(item, category));
    }
    const seen = new Set();
    allItems = allItems.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url); return true;
    }).sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, limit);

    const youtube = await fetchYouTubeVideos();
    sourceStatus['SPP YouTube'] = youtube.status;
    const sppItems = await fetchSppCmsItems(req);
    sourceStatus['Shoto Point Production'] = { ok: true, items: sppItems.length, note: 'Published Shoto Point CMS articles.' };

    return res.status(200).json({
      success: true,
      category,
      items: allItems,
      sppItems,
      videos: youtube.items,
      sources: sourceStatus,
      fetched_at: Math.floor(Date.now() / 1000),
      cache_ttl_seconds: Math.floor(TTL_MS / 1000),
      notes: {
        sppItems: 'Original Shoto Point stories are read from the published CMS records in MySQL.',
        licensing: 'BBC and FOX feeds stay disabled unless SPP has appropriate permission/licensing configured.'
      }
    });
  } catch (error) {
    console.error('[SPP Newsroom] API error:', error);
    return res.status(200).json({
      success: true,
      category,
      items: [],
      sppItems: [],
      videos: [],
      sources: Object.fromEntries(sources.map(source => [source.name, {
        ok: false, items: 0,
        licensed: source.licensed,
        note: source.enabled ? 'Feed request failed; check function logs and publisher availability.' : (source.note || 'Disabled in environment settings.')
      }])),
      fetched_at: Math.floor(Date.now() / 1000),
      cache_ttl_seconds: Math.floor(TTL_MS / 1000)
    });
  }
};
