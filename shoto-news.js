(() => {
  'use strict';
  const config = window.SHOTO_POINT_NEWS_CONFIG || {};
  const endpoints = config.endpoints || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { articles: [], activeCategory: 'all', search: '', heroIndex: 0 };

  const demoArticles = [
    { id:'preview-1', title:'Inside the next chapter of Shoto Point Productions', excerpt:'Production updates, new projects and the creative people bringing stories to the screen.', category:'Shoto Point Movies', image:'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1400&q=85', publishedAt:'', featured:true, preview:true },
    { id:'preview-2', title:'Film and television personalities shaping the entertainment conversation', excerpt:'Profiles, interviews and verified updates from the screen industry.', category:'Movie Celebrities', image:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=700&q=80', publishedAt:'', preview:true },
    { id:'preview-3', title:'Football weekend: fixtures, results and talking points', excerpt:'Match previews, confirmed results, analysis and football personalities.', category:'Football Games & News', image:'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=700&q=80', publishedAt:'', preview:true },
    { id:'preview-4', title:'New films, cinema releases and industry reports', excerpt:'Film reviews, production news, trailers and movie business updates.', category:'Movies & Films', image:'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=700&q=80', publishedAt:'', preview:true },
    { id:'preview-5', title:'Music releases, artists and live performance updates', excerpt:'New singles, albums, music videos, concerts and verified artist news.', category:'Musicians & Music Updates', image:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=700&q=80', publishedAt:'', preview:true },
    { id:'preview-6', title:'Politics and public affairs: what Nigerians should know', excerpt:'Reports on policy, public institutions, elections and governance with clear sourcing.', category:'Politicians & Politics', image:'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=700&q=80', publishedAt:'', preview:true },
    { id:'preview-7', title:'Nigeria updates: people, places and national developments', excerpt:'Verified national updates from communities and institutions across Nigeria.', category:'Nigeria Updates', image:'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=700&q=80', publishedAt:'', preview:true }
  ];

  const sourceAliases = {
    vanguard:'Vanguard', 'the-sun':'The Sun', 'bbc-news':'BBC News', 'fox-news':'Fox News',
    'al-jazeera':'Al Jazeera', cnn:'CNN', 'channels-tv':'Channels TV', nta:'NTA', 'africa-magic-tv':'Africa Magic TV'
  };

  function endpoint(path) { return `${String(config.apiBaseUrl || '').replace(/\/$/, '')}${path || ''}`; }
  async function fetchJSON(path, options = {}) {
    if (!path) throw new Error('Endpoint is not configured');
    const response = await fetch(endpoint(path), { credentials:'include', headers:{Accept:'application/json', ...(options.headers || {})}, ...options });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }
  function unwrapList(payload, keys=['articles','items','results','stories','headlines']) {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data)) return payload.data;
    for (const key of keys) if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    return [];
  }
  function normaliseArticle(item, index) {
    const id = item.id ?? item.article_id ?? item.slug ?? `article-${index}`;
    const category = item.category?.name ?? item.category_name ?? item.category ?? 'News';
    const slug = item.slug ? `slug=${encodeURIComponent(item.slug)}` : `id=${encodeURIComponent(id)}`;
    return {
      id, title:item.title ?? item.headline ?? item.name ?? 'Untitled story',
      excerpt:item.excerpt ?? item.summary ?? item.description ?? item.content_preview ?? '',
      category, image:item.image_url ?? item.featured_image ?? item.thumbnail ?? item.image ?? '',
      url:(item.id || item.article_id || item.slug) ? `article.html?${slug}` : (item.url ?? item.link ?? '#'),
      publishedAt:item.published_at ?? item.created_at ?? item.date ?? item.publishedAt ?? '',
      featured:Boolean(item.featured ?? item.is_featured ?? item.is_top_story), preview:false
    };
  }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function safeURL(value) { try { const url = new URL(value, window.location.href); return ['http:','https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } }
  function formatDate(value) { if (!value) return 'Shoto Point News'; const d=new Date(value); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'short',year:'numeric'}).format(d); }
  function categoryClass(category) { return String(category || 'news').toLowerCase().replace(/[^a-z0-9]+/g,'-'); }
  function articleCard(article) {
    const image = article.image ? `style="background-image:url('${escapeHTML(article.image)}')"` : '';
    return `<article class="story-card"><a class="story-photo" ${image} href="${safeURL(article.url)}" aria-label="Read ${escapeHTML(article.title)}"></a><div class="story-card-body"><span class="story-tag ${categoryClass(article.category)}">${escapeHTML(article.category)}</span><h3><a href="${safeURL(article.url)}">${escapeHTML(article.title)}</a></h3><p>${escapeHTML(article.excerpt)}</p><time>${escapeHTML(formatDate(article.publishedAt))}</time><a class="read-more" href="${safeURL(article.url)}">Read full story →</a></div></article>`;
  }
  function renderHero() {
    const featured = state.articles.filter(a => a.featured && !a.preview);
    const items = featured.length ? featured : state.articles;
    if (!items.length) return;
    const article = items[state.heroIndex % items.length];
    const hero = $('#heroStory');
    if (!hero) return;
    const image = article.image ? `url("${article.image.replace(/["\\]/g,'')}")` : 'linear-gradient(135deg,#1b2638,#070a10)';
    $('.hero-image', hero).style.backgroundImage = `linear-gradient(90deg,rgba(2,5,10,.94),rgba(2,5,10,.58) 53%,rgba(2,5,10,.08)),${image}`;
    $('#heroCategory').textContent = article.category;
    $('#heroTitle').textContent = article.title;
    $('#heroExcerpt').textContent = article.excerpt;
    $('#heroReadMore').href = safeURL(article.url);
    $('#heroReadMore').textContent = article.preview ? 'Preview story format' : 'Read full story →';
    $('#previewChip').hidden = !article.preview;
    $$('#heroDots i').forEach((dot,i)=>dot.classList.toggle('active',i===state.heroIndex%Math.min(3,items.length)));
  }
  function renderTopStories() {
    const host = $('#topStoriesList'); if (!host) return;
    const items = state.articles.filter(a=>!a.featured).slice(0,4);
    host.innerHTML = items.length ? items.map(a=>`<article class="top-story"><a class="top-story-image" style="${a.image?`background-image:url('${escapeHTML(a.image)}')`:''}" href="${safeURL(a.url)}"></a><div><span class="story-tag ${categoryClass(a.category)}">${escapeHTML(a.category)}</span><h3><a href="${safeURL(a.url)}">${escapeHTML(a.title)}</a></h3><time>${escapeHTML(formatDate(a.publishedAt))}</time><a class="read-more" href="${safeURL(a.url)}">Read more →</a></div></article>`).join('') : `<div class="feed-empty"><strong>No top stories yet</strong><p>Approved Shoto Point News articles will appear here.</p></div>`;
  }
  function renderLatest() {
    const host = $('#latestStories'); if (!host) return;
    let articles = state.articles.filter(a=>!a.featured || a.preview);
    if (state.activeCategory !== 'all') articles=articles.filter(a=>categoryClass(a.category)===state.activeCategory);
    if (state.search) articles=articles.filter(a=>`${a.title} ${a.excerpt} ${a.category}`.toLowerCase().includes(state.search));
    const heading=$('#latestHeading'); if(heading)heading.textContent=state.activeCategory==='all'?'LATEST SHOTO POINT STORIES':`${state.activeCategory.replace(/-/g,' ').toUpperCase()} STORIES`;
    host.innerHTML=articles.length?articles.slice(0,6).map(articleCard).join(''):`<div class="empty-state"><strong>No stories found</strong><p>Try another category or search term, or publish an approved article.</p></div>`;
  }
  function renderAll(){renderHero();renderTopStories();renderLatest();}
  async function loadArticles(){
    try { const payload=await fetchJSON(endpoints.articles||'/api/public/shoto-point-news/articles'); state.articles=unwrapList(payload).map(normaliseArticle); $('#apiStatus').textContent='API CONNECTED';$('#apiStatus').classList.add('connected');$('#previewChip').hidden=true;renderAll(); }
    catch(error){state.articles=demoArticles.map((a,i)=>normaliseArticle(a,i));if($('#apiStatus')){$('#apiStatus').textContent='PREVIEW MODE';$('#apiStatus').classList.remove('connected');}renderAll();console.info('[Shoto Point News] Article API unavailable; showing clearly labelled preview content.',error.message);}
  }
  async function loadTicker(){try{const payload=await fetchJSON(endpoints.ticker||'/api/public/shoto-point-news/ticker');const items=unwrapList(payload,['headlines','items','ticker','news']);const texts=items.map(i=>typeof i==='string'?i:(i.title||i.headline||i.text)).filter(Boolean);if(texts.length)$('#tickerTrack').innerHTML=[...texts,...texts].map(t=>`<span>${escapeHTML(t)}</span>`).join('');}catch(e){console.info('[Shoto Point News] Ticker is not connected:',e.message);}}
  async function loadExternalSources(){
    const feed=$('#externalFeed');if(!feed)return;
    try{
      const payload=await fetchJSON(endpoints.externalSources||'/api/public/shoto-point-newsroom');
      const entries=unwrapList(payload,['headlines','articles','items','sources','results']);
      const mapped=entries.map(item=>({source:item.source_name||item.publisher||item.source||'External publisher',sourceId:String(item.source_id||item.source_key||item.source||'').toLowerCase(),title:item.title||item.headline||'Untitled headline',publishedAt:item.published_at||item.pubDate||item.date||'',url:item.url||item.link||'#'}));
      if(!mapped.length)throw new Error('No external headlines returned');
      feed.innerHTML=mapped.slice(0,18).map(item=>`<a class="external-item" href="${safeURL(item.url)}" target="_blank" rel="noopener noreferrer"><span class="publisher-mark">${escapeHTML(item.source.slice(0,3).toUpperCase())}</span><span class="external-copy"><strong>${escapeHTML(item.source)}</strong><span>${escapeHTML(item.title)}</span></span><time>${escapeHTML(formatDate(item.publishedAt))}</time><b class="external-arrow">›</b></a>`).join('');
      $('#apiStatus').textContent='FEEDS CONNECTED';$('#apiStatus').classList.add('connected');
    }catch(error){feed.innerHTML=`<div class="feed-empty"><span class="feed-pulse"></span><strong>Partner news feeds not connected</strong><p>Connect an authorised server-side RSS/API aggregator for Vanguard, The Sun, BBC News, Fox News, Al Jazeera, CNN, Channels TV, NTA and Africa Magic TV. Publisher headlines must remain attributed and link to the original story.</p></div>`;console.info('[Shoto Point News] External news API unavailable:',error.message);}
    $$('.source-tab').forEach(tab=>tab.addEventListener('click',()=>{$$('.source-tab').forEach(t=>t.classList.toggle('active',t===tab));const source=tab.dataset.source;$$('.external-item',feed).forEach(row=>{const name=$('.external-copy strong',row)?.textContent.toLowerCase()||'';const alias=sourceAliases[source]?.toLowerCase()||source;row.hidden=source!=='all'&&!name.includes(alias);});}));
  }
  function bindNavigation(){
    $('#searchForm')?.addEventListener('submit',e=>{e.preventDefault();const q=$('#siteSearch').value.trim();if(q)location.href=`search.html?q=${encodeURIComponent(q)}`;});
    $('#siteSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const q=$('#siteSearch').value.trim();if(q)location.href=`search.html?q=${encodeURIComponent(q)}`;}});
  }
  function bindMobileNav(){const btn=$('#mobileMenuToggle');btn?.addEventListener('click',()=>{const open=$('#primaryNav').classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});}
  function bindHeroControls(){ $('#heroPrev')?.addEventListener('click',()=>{state.heroIndex=Math.max(0,state.heroIndex-1);renderHero();});$('#heroNext')?.addEventListener('click',()=>{state.heroIndex+=1;renderHero();});$$('#heroDots i').forEach((dot,i)=>dot.addEventListener('click',()=>{state.heroIndex=i;renderHero();})); }
  function bindNewsletter(){const form=$('#newsletterForm');if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const email=$('#newsletterEmail').value.trim(),target=$('#newsletterMessage');if(!endpoints.newsletter){target.textContent='Newsletter sign-up is not connected yet. Configure the newsletter endpoint in newsroom-config.js.';return;}try{await fetchJSON(endpoints.newsletter,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});target.textContent='Thank you. Your subscription request has been received.';form.reset();}catch{target.textContent='We could not submit your request. Please try again later.';}});}
  function youtubeEmbed(url){try{const u=new URL(url);let id='';if(u.hostname.includes('youtu.be'))id=u.pathname.slice(1);else if(u.hostname.includes('youtube.com'))id=u.searchParams.get('v')||u.pathname.match(/\/embed\/([^/?]+)/)?.[1]||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||'';return id?`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`:'';}catch{return '';}}
  function renderProductionUpdates(){
    const prod=config.productionUpdates||{};const videoHost=$('#productionVideoPreview');
    if(videoHost){const embed=youtubeEmbed(prod.youtubeVideoUrl||'');if(embed){videoHost.innerHTML=`<iframe class="production-video-frame" src="${escapeHTML(embed)}" title="${escapeHTML(prod.videoTitle||'Shoto Point Productions video update')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;}else{videoHost.innerHTML=`<div class="video-placeholder"><span class="video-play-symbol">▶</span><strong>${escapeHTML(prod.videoTitle||'Latest production video')}</strong><small>${escapeHTML(prod.videoDescription||'Trailers, behind-the-scenes and production updates.')}</small><a href="production-updates.html" class="read-more">Open Production Updates →</a><small class="source-footnote">Add the official YouTube video URL in newsroom-config.js to activate the video preview.</small></div>`;}}
    const socialHost=$('#productionSocialLinks');const headerSocial=$('#headerProductionSocial');const items=[['YouTube',prod.youtubeChannelUrl,'youtube','▶'],['Facebook',prod.facebookPageUrl,'facebook','f'],['Instagram',prod.instagramProfileUrl,'instagram','◎']];if(socialHost){socialHost.innerHTML=items.map(([name,url,cls,icon])=>url?`<a class="social-action ${cls}" href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">${icon} ${name} · Official updates</a>`:`<span class="social-action ${cls} is-unconfigured" aria-disabled="true">${icon} ${name} · Add official link in config</span>`).join('');}if(headerSocial){headerSocial.innerHTML=items.map(([name,url,cls,icon])=>url?`<a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer" aria-label="${name}">${icon}</a>`:`<a href="production-updates.html" aria-label="${name} production updates">${icon}</a>`).join('');}
  }
  function initialise(){const now=new Date();if($('#todayDate'))$('#todayDate').textContent=new Intl.DateTimeFormat('en-NG',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(now);if($('#currentYear'))$('#currentYear').textContent=now.getFullYear();bindNavigation();bindMobileNav();bindHeroControls();bindNewsletter();renderProductionUpdates();loadArticles();loadTicker();loadExternalSources();}
  document.addEventListener('DOMContentLoaded',initialise);
})();
