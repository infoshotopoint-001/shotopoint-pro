'use strict';

/**
 * SPP Newsroom aggregator router.
 * Mount with: app.use('/api', createNewsroomRouter({ requireAdmin }));
 * Dependencies: express, rss-parser (npm install rss-parser)
 *
 * It imports short metadata/headlines from RSS feeds, labels the source and links
 * directly to the publisher. Do not republish full article text or assets without
 * appropriate permission. BBC/FOX feeds are disabled unless their rights flags are set.
 */
const express = require('express');
const Parser = require('rss-parser');
const fs = require('node:fs/promises');
const path = require('node:path');

const routerFactory = ({ requireAdmin } = {}) => {
  const router = express.Router();
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

  const CACHE_TTL_MS = Math.max(60000, Number(process.env.NEWS_CACHE_TTL_MS || 180000));
  const SPP_NEWS_FILE = process.env.SPP_NEWS_FILE || path.join(process.cwd(), 'data', 'spp-news.json');
  const feedCache = new Map();
  let youtubeCache = { expires: 0, items: [], ok: false, note: 'SPP YouTube channel is not configured.' };

  const publisherFeeds = {
    sun: {
      name: 'The Sun Nigeria',
      enabled: process.env.SUN_RSS_ENABLED !== 'false',
      urls: [process.env.SUN_RSS_URL || 'https://sunnewsonline.com/feed/', 'https://thesun.ng/feed/'],
      defaultCategory: 'nigeria'
    },
    vanguard: {
      name: 'Vanguard',
      enabled: process.env.VANGUARD_RSS_ENABLED !== 'false',
      urls: [process.env.VANGUARD_RSS_URL || 'https://www.vanguardngr.com/feed/'],
      defaultCategory: 'nigeria'
    },
    bbc: {
      name: 'BBC News',
      enabled: process.env.BBC_RSS_LICENSED === 'true',
      licensed: process.env.BBC_RSS_LICENSED === 'true',
      urls: ['https://feeds.bbci.co.uk/news/rss.xml'],
      defaultCategory: 'world',
      note: 'Business use requires the appropriate permission/licence.'
    },
    fox: {
      name: 'FOX News',
      enabled: process.env.FOX_RSS_LICENSED === 'true',
      licensed: process.env.FOX_RSS_LICENSED === 'true',
      urls: ['https://moxie.foxnews.com/google-publisher/latest.xml'],
      defaultCategory: 'world',
      note: 'FOX RSS terms describe free headline use as personal/non-commercial; obtain permission before business use.'
    },
    aljazeera: {
      name: 'Al Jazeera English',
      enabled: process.env.ALJAZEERA_RSS_ENABLED !== 'false',
      urls: [process.env.ALJAZEERA_RSS_URL || 'https://www.aljazeera.com/xml/rss/all.xml'],
      defaultCategory: 'world',
      note: 'Show only limited metadata/excerpts with prominent attribution and direct source links; verify current reuse terms.'
    }
  };

  const feedByTopic = {
    politics: {
      bbc: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/politics.xml'
    },
    tech: {
      bbc: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/tech.xml'
    },
    football: {
      bbc: 'https://feeds.bbci.co.uk/sport/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/sports.xml'
    },
    movies: {
      bbc: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/entertainment.xml'
    },
    celebrities: {
      bbc: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/entertainment.xml'
    },
    actors: {
      bbc: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/entertainment.xml'
    },
    musicians: {
      bbc: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/entertainment.xml'
    },
    media: {
      bbc: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'
    },
    world: {
      bbc: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      fox: 'https://moxie.foxnews.com/google-publisher/world.xml'
    }
  };

  const stripHtml = value => String(value || '')
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

  const safeHttpUrl = value => {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  function firstMediaUrl(value) {
    if (!value) return '';
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = firstMediaUrl(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof value === 'string') return safeHttpUrl(value);
    if (typeof value === 'object') return safeHttpUrl(value.url || value.href || value.$ && (value.$.url || value.$.href));
    return '';
  }

  function imageFrom(item) {
    const direct = firstMediaUrl(item.image) || firstMediaUrl(item.enclosure) ||
      firstMediaUrl(item['media:thumbnail']) || firstMediaUrl(item['media:content']);
    if (direct && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(direct)) return direct;
    const html = String(item['content:encoded'] || item.content || item.description || '');
    const match = html.match(/<img\b[^>]*?src=["']([^"']+)["']/i);
    return match ? safeHttpUrl(match[1]) : '';
  }

  function getCategories(title, description, feedCategories, defaultCategory) {
    const text = `${title} ${description} ${(feedCategories || []).join(' ')}`.toLowerCase();
    const cats = new Set();
    const add = (category, pattern) => { if (pattern.test(text)) cats.add(category); };
    add('politics', /politic|president|governor|senate|senator|minister|election|campaign|vote|parliament|lawmakers|tinubu|atiku|government/);
    add('football', /football|soccer|premier league|\bepl\b|fifa|uefa|afcon|super eagles|chelsea|arsenal|liverpool|manchester|goalkeeper|striker|league match|coach|transfer window/);
    add('movies', /movie|film|cinema|nollywood|box office|film festival|premiere|screenplay|film-maker|filmmaker/);
    add('actors', /actor|actress|cast member|screen star|role in|stars in|performer/);
    add('musicians', /musician|singer|songwriter|new single|album|afrobeats|rapper|music video|concert|record label|grammy|music award/);
    add('celebrities', /celebrity|celebrity|showbiz|entertainment|famous|reality star|red carpet|celebrity couple/);
    add('talents', /talent|audition|emerging artist|up-and-coming|contestant|reality show|creative talent|rising star/);
    add('media', /media|journalist|journalism|press freedom|newsroom|broadcast|television station|radio station|publisher|publishing/);
    add('tech', /technology|tech company|artificial intelligence|\bai\b|cybersecurity|software|smartphone|startup|digital platform|internet|robotics|data breach|gadget/);
    add('business', /business|economy|market|company|trade|investment|finance|bank|inflation|revenue/);
    add('world', /international|global|united states|white house|european union|middle east|united nations|world leaders|foreign affairs/);
    if (defaultCategory) cats.add(defaultCategory);
    if (!cats.size) cats.add(defaultCategory || 'world');
    return [...cats];
  }

  function normaliseItem(item, source, defaultCategory) {
    const title = stripHtml(item.title || 'Untitled report').slice(0, 350);
    const description = stripHtml(item.contentSnippet || item.summary || item.content || item['content:encoded'] || item.description || '').slice(0, 350);
    const url = safeHttpUrl(item.link || item.guid || item.id);
    if (!url || !title || title === 'Untitled report') return null;
    const categories = getCategories(title, description, item.categories, defaultCategory);
    const published = new Date(item.isoDate || item.pubDate || item.published || Date.now());
    return {
      id: `${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Buffer.from(url).toString('base64url').slice(0, 18)}`,
      title,
      description,
      url,
      image: imageFrom(item),
      source,
      category: categories.find(x => x !== 'nigeria' && x !== 'world') || categories[0] || defaultCategory || 'world',
      categories,
      published_at: isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
      author: stripHtml(item.creator || item.author || '').slice(0, 100)
    };
  }

  async function readFeed(url) {
    const now = Date.now();
    const cached = feedCache.get(url);
    if (cached && cached.expires > now) {
      if (cached.promise) return cached.promise;
      if (cached.error) throw new Error(cached.error);
      return cached;
    }
    const promise = (async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: { 'user-agent': 'SPP-Newsroom/1.0 (+https://www.shotopoint.com)', 'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
      const xml = await response.text();
      const parsed = await parser.parseString(xml);
      return { expires: Date.now() + CACHE_TTL_MS, items: parsed.items || [], ok: true, title: parsed.title || '' };
    })();
    feedCache.set(url, { expires: now + 10000, promise, items: [], ok: false });
    try {
      const result = await promise;
      feedCache.set(url, result);
      return result;
    } catch (error) {
      feedCache.set(url, { expires: Date.now() + 30000, items: [], ok: false, error: error.message });
      throw error;
    }
  }

  function urlsFor(key, category) {
    const config = publisherFeeds[key];
    if (!config) return [];
    if ((key === 'bbc' || key === 'fox') && category && feedByTopic[category] && feedByTopic[category][key]) return [feedByTopic[category][key]];
    return config.urls;
  }

  async function fetchPublisher(key, category) {
    const config = publisherFeeds[key];
    if (!config.enabled) {
      return { items: [], status: { ok: false, licensed: config.licensed === false ? false : undefined, items: 0, note: config.note || 'Disabled in server configuration.' } };
    }
    const urls = urlsFor(key, category);
    let lastError = 'No feed URL configured';
    for (const url of urls) {
      try {
        const feed = await readFeed(url);
        const items = (feed.items || []).map(item => normaliseItem(item, config.name, config.defaultCategory)).filter(Boolean);
        return { items, status: { ok: true, licensed: config.licensed, items: items.length, note: config.note || 'RSS headlines with attribution and direct links.' } };
      } catch (error) { lastError = error.message; }
    }
    return { items: [], status: { ok: false, licensed: config.licensed, items: 0, note: lastError } };
  }

  async function readSppNews() {
    try {
      const raw = await fs.readFile(SPP_NEWS_FILE, 'utf8');
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) return [];
      return items.map((item, index) => {
        const title = String(item.title || '').trim().slice(0, 300);
        const url = safeHttpUrl(item.url || '');
        if (!title || !url) return null;
        const category = String(item.category || 'spp').toLowerCase();
        const categories = [...new Set(['spp', category, ...getCategories(title, item.description, [], category)])];
        return {
          id: String(item.id || `spp-${index}`), title,
          description: stripHtml(item.description || item.summary || '').slice(0, 350),
          url, image: safeHttpUrl(item.image || ''), source: 'Shoto Point Production', category,
          categories, published_at: item.published_at || new Date().toISOString(), author: stripHtml(item.author || '').slice(0,100)
        };
      }).filter(Boolean);
    } catch { return []; }
  }

  async function readYouTube() {
    const channelId = String(process.env.SPP_YOUTUBE_CHANNEL_ID || '').trim();
    if (!channelId) return { items: [], status: { ok: false, items: 0, note: 'Set SPP_YOUTUBE_CHANNEL_ID to enable automatic SPP uploads.' } };
    if (youtubeCache.expires > Date.now()) return youtubeCache;
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    try {
      const feed = await readFeed(url);
      const items = (feed.items || []).map(item => {
        const videoUrl = safeHttpUrl(item.link);
        const videoIdMatch = videoUrl.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
        const id = videoIdMatch ? videoIdMatch[1] : String(item.id || '').split(':').pop();
        if (!videoUrl || !id) return null;
        return { id, title: stripHtml(item.title || 'SPP YouTube video'), description: stripHtml(item.contentSnippet || item.content || '').slice(0,250), url: videoUrl, image: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`, source: 'SPP YouTube', category: 'media', categories: ['media','spp'], published_at: item.isoDate || item.pubDate || new Date().toISOString() };
      }).filter(Boolean).sort((a,b)=>new Date(b.published_at)-new Date(a.published_at)).slice(0,8);
      youtubeCache = { expires: Date.now() + CACHE_TTL_MS, items, ok: true, status: { ok: true, items: items.length, note: 'Latest SPP channel uploads.' } };
      return youtubeCache;
    } catch (error) {
      youtubeCache = { expires: Date.now() + 30000, items: [], ok: false, status: { ok: false, items: 0, note: error.message } };
      return youtubeCache;
    }
  }

  function matchesCategory(item, category) {
    if (!category || category === 'all') return true;
    return (item.categories || [item.category]).includes(category) || item.category === category;
  }

  router.get('/public/newsroom', async (req, res) => {
    const allowed = new Set(['all','nigeria','politics','celebrities','movies','actors','musicians','talents','football','media','tech','world','spp','business']);
    const requested = String(req.query.category || 'all').toLowerCase();
    const category = allowed.has(requested) ? requested : 'all';
    const limit = Math.min(40, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    try {
      const keys = category === 'spp' ? [] : Object.keys(publisherFeeds);
      const publisherResults = await Promise.all(keys.map(key => fetchPublisher(key, category)));
      const sources = {};
      publisherResults.forEach((result, i) => { sources[publisherFeeds[keys[i]].name] = result.status; });
      const ownItems = (await readSppNews()).sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
      sources['Shoto Point Production'] = { ok: true, items: ownItems.length, note: 'Original SPP updates loaded from the configured newsroom store.' };
      const youtube = await readYouTube();
      sources['SPP YouTube'] = youtube.status || { ok: false, items: 0, note: 'Video feed unavailable.' };
      let externalItems = publisherResults.flatMap(x=>x.items);
      const uniqueExternal = new Map();
      for (const item of externalItems) {
        if (!uniqueExternal.has(item.url)) uniqueExternal.set(item.url, item);
      }
      const merged = [...uniqueExternal.values()].filter(item => matchesCategory(item, category)).sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
      // Keep original SPP announcements in their own clearly labelled section,
      // avoiding duplicate cards in the general publisher headline grid.
      const items = category === 'spp' ? ownItems.slice(0, limit) : merged.slice(0, limit);
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      return res.json({ success: true, category, items, sppItems: ownItems.slice(0,12), videos: youtube.items || [], sources, fetched_at: Math.floor(Date.now()/1000) });
    } catch (error) {
      return res.status(200).json({ success: true, category, items: [], sppItems: [], videos: [], sources: {}, fetched_at: Math.floor(Date.now()/1000), warning: 'News feed aggregation partially failed.' });
    }
  });

  // This write route is disabled unless the existing SPP admin-auth middleware is provided.
  router.post('/admin/newsroom/items', (req, res, next) => {
    if (typeof requireAdmin !== 'function') return res.status(503).json({ success: false, error: 'Admin publishing is disabled until the existing SPP admin-auth middleware is connected.' });
    return requireAdmin(req, res, next);
  }, async (req, res) => {
    try {
      const title = String(req.body && req.body.title || '').trim().slice(0, 300);
      const url = safeHttpUrl(req.body && req.body.url);
      const description = stripHtml(req.body && (req.body.description || req.body.summary) || '').slice(0, 350);
      const category = String(req.body && req.body.category || 'spp').toLowerCase();
      const image = safeHttpUrl(req.body && req.body.image || '');
      const author = stripHtml(req.body && req.body.author || '').slice(0, 100);
      if (!title || !url) return res.status(400).json({ success: false, error: 'A title and absolute HTTP(S) article URL are required.' });
      const allowed = new Set(['spp','nigeria','politics','celebrities','movies','actors','musicians','talents','football','media','tech','world','business']);
      if (!allowed.has(category)) return res.status(400).json({ success: false, error: 'Unsupported category.' });
      await fs.mkdir(path.dirname(SPP_NEWS_FILE), { recursive: true });
      let items = [];
      try { const parsed = JSON.parse(await fs.readFile(SPP_NEWS_FILE, 'utf8')); if (Array.isArray(parsed)) items = parsed; } catch {}
      const entry = { id: `spp-${Date.now()}`, title, url, description, category, image, author, source: 'Shoto Point Production', published_at: new Date().toISOString() };
      items = [entry, ...items.filter(item => item.url !== url)].slice(0, 500);
      await fs.writeFile(SPP_NEWS_FILE, JSON.stringify(items, null, 2), 'utf8');
      return res.status(201).json({ success: true, item: entry });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Could not save the SPP newsroom item.' });
    }
  });

  return router;
};

module.exports = { createNewsroomRouter: routerFactory };
