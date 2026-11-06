(() => {
  'use strict';
  const config = window.SYFM_NEWSROOM_CONFIG || {};
  const endpoints = config.endpoints || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { articles: [], activeCategory: 'all', search: '', heroIndex: 0, externalSource: 'all', ticker: [] };

  const demoArticles = [
    { id: 'preview-1', title: 'Your lead story will appear here', excerpt: 'Connect the SYFM newsroom API to publish your lead report, summary and featured photograph.', category: 'News', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1400&q=85', url: '#', publishedAt: '', featured: true, preview: true },
    { id: 'preview-2', title: 'Politics, policy and public affairs', excerpt: 'The latest reporting and analysis on governance and public policy.', category: 'Politics', image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=700&q=80', url: '#', publishedAt: '', preview: true },
    { id: 'preview-3', title: 'Business and economy updates', excerpt: 'Stories on enterprise, markets, jobs and the economy.', category: 'Business', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=700&q=80', url: '#', publishedAt: '', preview: true },
    { id: 'preview-4', title: 'Education, research and innovation', excerpt: 'Coverage of learning, institutions, research and opportunity.', category: 'Education', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=700&q=80', url: '#', publishedAt: '', preview: true },
    { id: 'preview-5', title: 'Sports stories and match updates', excerpt: 'Fixtures, results, analysis and sporting personalities.', category: 'Sports', image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=700&q=80', url: '#', publishedAt: '', preview: true },
    { id: 'preview-6', title: 'Technology shaping everyday life', excerpt: 'Digital transformation, new products and technology developments.', category: 'Technology', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80', url: '#', publishedAt: '', preview: true },
    { id: 'preview-7', title: 'Culture, health and lifestyle', excerpt: 'People, culture, wellness and community life.', category: 'Lifestyle', image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=700&q=80', url: '#', publishedAt: '', preview: true }
  ];

  const externalSourceNames = {
    'vanguard': 'Vanguard', 'the-sun': 'The Sun', 'bbc-news': 'BBC News', 'fox-news': 'Fox News',
    'al-jazeera': 'Al Jazeera', 'cnn': 'CNN', 'channels-tv': 'Channels TV', 'nta': 'NTA', 'africa-magic-tv': 'Africa Magic TV'
  };

  function endpoint(path) {
    const base = String(config.apiBaseUrl || '').replace(/\/$/, '');
    return `${base}${path || ''}`;
  }
  async function fetchJSON(path, options = {}) {
    if (!path) throw new Error('Endpoint is not configured');
    const response = await fetch(endpoint(path), { credentials: 'include', headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }
  function unwrapList(payload, keys) {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
    if (payload?.data && Array.isArray(payload.data)) return payload.data;
    for (const key of keys) if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    return [];
  }
  function normaliseArticle(item, index) {
    return {
      id: item.id ?? item.article_id ?? item.slug ?? `article-${index}`,
      title: item.title ?? item.headline ?? item.name ?? 'Untitled story',
      excerpt: item.excerpt ?? item.summary ?? item.description ?? item.content_preview ?? '',
      category: item.category?.name ?? item.category_name ?? item.category ?? 'News',
      image: item.image_url ?? item.featured_image ?? item.thumbnail ?? item.image ?? '',
      url: (item.id || item.article_id) ? `article.html?id=${encodeURIComponent(item.id ?? item.article_id)}` : (item.slug ? `article.html?slug=${encodeURIComponent(item.slug)}` : (item.url ?? item.link ?? '#')),
      publishedAt: item.published_at ?? item.created_at ?? item.date ?? item.publishedAt ?? '',
      featured: Boolean(item.featured ?? item.is_featured ?? item.is_top_story),
      preview: false
    };
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function safeURL(value) {
    try { const url = new URL(value, window.location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : '#'; }
    catch { return '#'; }
  }
  function formatDate(value) {
    if (!value) return 'SYFM Newsroom';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
  function categoryClass(category) { return String(category || 'news').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function articleCard(article) {
    const image = article.image ? `style="background-image:url('${escapeHTML(article.image)}')"` : '';
    return `<article class="story-card"><a class="story-photo" ${image} href="${safeURL(article.url)}" aria-label="Read ${escapeHTML(article.title)}"></a><div class="story-card-body"><span class="story-tag ${categoryClass(article.category)}">${escapeHTML(article.category)}</span><h3><a href="${safeURL(article.url)}">${escapeHTML(article.title)}</a></h3><p>${escapeHTML(article.excerpt)}</p><time>${escapeHTML(formatDate(article.publishedAt))}</time><a class="read-more" href="${safeURL(article.url)}">Read full story →</a></div></article>`;
  }
  function renderHero() {
    const items = state.articles.filter(a => a.featured && !a.preview).length ? state.articles.filter(a => a.featured && !a.preview) : state.articles;
    if (!items.length) return;
    const article = items[state.heroIndex % items.length];
    const hero = $('#heroStory');
    const image = article.image ? `url("${article.image.replace(/["\\]/g, '')}")` : 'linear-gradient(135deg,#123b37,#07111d)';
    $('.hero-image', hero).style.backgroundImage = image;
    $('#heroCategory').textContent = article.category;
    $('#heroTitle').textContent = article.title;
    $('#heroExcerpt').textContent = article.excerpt;
    $('#heroReadMore').href = safeURL(article.url);
    $('#heroReadMore').textContent = article.preview ? 'Connect and publish stories' : 'Read full story →';
    $('#previewChip').hidden = !article.preview;
    $$('#heroDots i').forEach((dot, i) => dot.classList.toggle('active', i === state.heroIndex % Math.min(3, items.length)));
  }
  function renderTopStories() {
    const items = state.articles.filter(a => !a.featured).slice(0, 4);
    $('#topStoriesList').innerHTML = items.length ? items.map(a => `<article class="top-story"><a class="top-story-image" style="${a.image ? `background-image:url('${escapeHTML(a.image)}')` : ''}" href="${safeURL(a.url)}"></a><div><span class="story-tag ${categoryClass(a.category)}">${escapeHTML(a.category)}</span><h3><a href="${safeURL(a.url)}">${escapeHTML(a.title)}</a></h3><time>${escapeHTML(formatDate(a.publishedAt))}</time><a class="read-more" href="${safeURL(a.url)}">Read more →</a></div></article>`).join('') : `<div class="feed-empty"><strong>No top stories yet</strong><p>Publish an article and mark it as a top story in the CMS.</p></div>`;
  }
  function renderLatest() {
    let articles = state.articles.filter(a => !a.featured || a.preview);
    if (state.activeCategory !== 'all') articles = articles.filter(a => categoryClass(a.category) === state.activeCategory);
    if (state.search) articles = articles.filter(a => `${a.title} ${a.excerpt} ${a.category}`.toLowerCase().includes(state.search));
    $('#latestHeading').textContent = state.activeCategory === 'all' ? 'LATEST STORIES' : `${state.activeCategory.toUpperCase()} STORIES`;
    $('#latestStories').innerHTML = articles.length ? articles.slice(0, 6).map(articleCard).join('') : `<div class="empty-state"><strong>No stories found</strong><p>Try another category or search term, or publish new articles in the CMS.</p></div>`;
  }
  function renderAll() { renderHero(); renderTopStories(); renderLatest(); }
  async function loadArticles() {
    try {
      const payload = await fetchJSON(endpoints.articles || '/api/public/news/articles');
      const list = unwrapList(payload, ['articles', 'items', 'results', 'stories']);
      state.articles = list.map(normaliseArticle);
      $('#apiStatus').textContent = 'API CONNECTED';
      $('#apiStatus').classList.add('connected');
      $('#previewChip').hidden = true;
      renderAll();
    } catch (error) {
      state.articles = demoArticles;
      $('#apiStatus').textContent = 'PREVIEW MODE';
      $('#apiStatus').classList.remove('connected');
      renderAll();
      console.info('[SYFM Newsroom] Article API unavailable; showing clearly labelled preview content.', error.message);
    }
  }
  async function loadTicker() {
    try {
      const payload = await fetchJSON(endpoints.ticker || '/api/public/news/ticker');
      const items = unwrapList(payload, ['headlines', 'items', 'ticker', 'news']);
      if (!items.length) return;
      const texts = items.map(i => typeof i === 'string' ? i : (i.title || i.headline || i.text)).filter(Boolean);
      if (texts.length) $('#tickerTrack').innerHTML = [...texts, ...texts].map(t => `<span>${escapeHTML(t)}</span>`).join('');
    } catch (error) { console.info('[SYFM Newsroom] Ticker feed not connected:', error.message); }
  }
  async function loadExternalSources() {
    const feed = $('#externalFeed');
    try {
      const payload = await fetchJSON(endpoints.externalSources || '/api/public/newsroom');
      const entries = unwrapList(payload, ['headlines', 'articles', 'items', 'sources', 'results']);
      const mapped = entries.map(item => ({
        source: item.source_name || item.publisher || item.source || 'External publisher',
        sourceId: String(item.source_id || item.source_key || item.source || '').toLowerCase(),
        title: item.title || item.headline || 'Untitled headline',
        publishedAt: item.published_at || item.pubDate || item.date || '',
        url: item.url || item.link || '#'
      }));
      if (!mapped.length) throw new Error('No external headlines returned');
      feed.innerHTML = mapped.slice(0, 12).map(item => `<a class="external-item" href="${safeURL(item.url)}" target="_blank" rel="noopener noreferrer"><span class="publisher-mark">${escapeHTML(item.source.slice(0, 3).toUpperCase())}</span><span class="external-copy"><strong>${escapeHTML(item.source)}</strong><span>${escapeHTML(item.title)}</span></span><time>${escapeHTML(formatDate(item.publishedAt))}</time><b class="external-arrow">›</b></a>`).join('');
      $('#apiStatus').textContent = 'FEEDS CONNECTED';
      $('#apiStatus').classList.add('connected');
      $$('.source-tab').forEach(tab => tab.addEventListener('click', () => {
        $$('.source-tab').forEach(t => t.classList.toggle('active', t === tab));
        const source = tab.dataset.source;
        $$('.external-item', feed).forEach(row => {
          const name = $('.external-copy strong', row)?.textContent.toLowerCase() || '';
          const show = source === 'all' || name.includes(source.replace('-', ' ')) || (source === 'bbc' && name.includes('bbc')) || (source === 'channels' && name.includes('channel'));
          row.hidden = !show;
        });
      }));
    } catch (error) {
      feed.innerHTML = `<div class="feed-empty"><span class="feed-pulse"></span><strong>External news feeds are not connected</strong><p>Configure an authorised RSS/API aggregator on your backend for Vanguard, The Sun, BBC News, Fox News, Al Jazeera, CNN, Channels TV, NTA and Africa Magic TV. Headlines will appear here with source attribution and links.</p></div>`;
      console.info('[SYFM Newsroom] External news API unavailable:', error.message);
    }
  }
  function bindNavigation() {
    $('#searchForm').addEventListener('submit', event => {
      event.preventDefault();
      const query = $('#siteSearch').value.trim();
      if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
    });
    $('#siteSearch').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const query = $('#siteSearch').value.trim();
        if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      }
    });
  }
  function closeMobileNav() { $('#primaryNav').classList.remove('open'); $('#mobileMenuToggle').setAttribute('aria-expanded', 'false'); }
  function bindMobileNav() {
    $('#mobileMenuToggle').addEventListener('click', () => { const open = $('#primaryNav').classList.toggle('open'); $('#mobileMenuToggle').setAttribute('aria-expanded', String(open)); });
  }
  function bindHeroControls() {
    $('#heroPrev').addEventListener('click', () => { state.heroIndex = Math.max(0, state.heroIndex - 1); renderHero(); });
    $('#heroNext').addEventListener('click', () => { state.heroIndex += 1; renderHero(); });
    $$('#heroDots i').forEach((dot, i) => dot.addEventListener('click', () => { state.heroIndex = i; renderHero(); }));
  }
  function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 4200); }
  function bindRadio() {
    const button = $('#radioPlayButton'), player = $('#radioPlayer'), status = $('#radioStatus');
    const stream = String(config.radioStreamUrl || '').trim();
    if (stream) player.src = stream;
    button.addEventListener('click', async () => {
      if (!stream) { status.textContent = 'Live radio is not configured yet. Add the authorised stream URL in newsroom-config.js.'; showToast('SYFM live stream URL has not been configured.'); return; }
      if (player.paused) {
        try { await player.play(); button.textContent = 'Ⅱ'; status.textContent = 'You are listening to SYFM Live.'; button.setAttribute('aria-label', 'Pause SYFM live radio'); }
        catch { status.textContent = 'The live stream could not start. Check the stream URL and hosting permissions.'; }
      } else { player.pause(); button.textContent = '▶'; status.textContent = 'Radio paused.'; button.setAttribute('aria-label', 'Play SYFM live radio'); }
    });
    player.addEventListener('ended', () => { button.textContent = '▶'; status.textContent = 'Stream ended.'; });
    player.addEventListener('error', () => { button.textContent = '▶'; status.textContent = 'Unable to load the live stream.'; });
    // Listen Live links navigate to the dedicated live.html page.
  }
  function bindNewsletter() {
    $('#newsletterForm').addEventListener('submit', async event => {
      event.preventDefault();
      const email = $('#newsletterEmail').value.trim();
      const target = $('#newsletterMessage');
      if (!endpoints.newsletter) { target.textContent = 'Newsletter sign-up is not connected yet. Configure the newsletter endpoint in newsroom-config.js.'; return; }
      try {
        await fetchJSON(endpoints.newsletter, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        target.textContent = 'Thank you. Your subscription request has been received.';
        $('#newsletterForm').reset();
      } catch (error) { target.textContent = 'We could not submit your request. Please try again later.'; }
    });
  }
  function initialise() {
    const now = new Date();
    $('#todayDate').textContent = new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(now);
    $('#currentYear').textContent = now.getFullYear();
    bindNavigation(); bindMobileNav(); bindHeroControls(); bindRadio(); bindNewsletter();
    loadArticles(); loadTicker(); loadExternalSources();
  }
  document.addEventListener('DOMContentLoaded', initialise);
})();
