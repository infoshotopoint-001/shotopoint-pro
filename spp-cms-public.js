/* Shoto Point Production public CMS renderer.
   Public pages retrieve only published CMS records from the live MySQL-backed API. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pageSlug = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function safeHref(value) {
    const v = String(value || '').trim();
    if (!v) return '#';
    try { const u = new URL(v, location.origin); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; }
    catch { return '#'; }
  }
  function cleanHtml(value) {
    const template = document.createElement('template');
    template.innerHTML = String(value || '');
    template.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(n => n.remove());
    template.content.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => {
      if (/^on/i.test(a.name) || a.name.toLowerCase() === 'srcdoc') el.removeAttribute(a.name);
      if (['href','src','xlink:href'].includes(a.name.toLowerCase()) && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }));
    return template.innerHTML;
  }
  function menuTreeHtml(items, mode) {
    return (items || []).map(item => {
      const children = item.children || [];
      const url = safeHref(item.url || '#');
      if (children.length) {
        const parentClass = mode === 'syfm' ? 'nav-link navlink' : 'navlink';
        const childClass = mode === 'syfm' ? 'nav-link' : '';
        return `<div class="navitem"><a class="${parentClass}" href="${esc(url)}">${esc(item.name)} <span class="chev" aria-hidden="true">⌄</span></a><div class="dropdown"><strong>${esc(item.name)}</strong>${children.map(ch => `<a class="${childClass}" href="${esc(safeHref(ch.url))}" target="${esc(ch.target || '_self')}">${esc(ch.name)}</a>`).join('')}</div></div>`;
      }
      return `<a class="${mode === 'syfm' ? 'nav-link' : 'navlink'}" href="${esc(url)}" target="${esc(item.target || '_self')}">${esc(item.name)}</a>`;
    }).join('');
  }
  async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  function makeSlot(id, parent, placement = 'append') {
    let slot = document.getElementById(id);
    if (slot) return slot;
    if (!parent) return null;
    slot = document.createElement('section');
    slot.id = id;
    slot.className = 'spp-cms-slot';
    slot.hidden = true;
    if (placement === 'before') parent.insertAdjacentElement('beforebegin', slot);
    else if (placement === 'after') parent.insertAdjacentElement('afterend', slot);
    else parent.appendChild(slot);
    return slot;
  }
  async function injectBlocks(section, container) {
    if (!container) return;
    try {
      const data = await getJson(`/api/public/cms/content?section=${encodeURIComponent(section)}&limit=100`);
      const rows = data.data || [];
      if (!rows.length) { container.hidden = true; container.innerHTML = ''; return rows; }
      container.hidden = false;
      container.innerHTML = rows.map(row => {
        let settings = {};
        try { settings = typeof row.settings_json === 'string' ? JSON.parse(row.settings_json || '{}') : (row.settings_json || {}); } catch {}
        const align = String(row.placement || settings.alignment || 'left').replace(/[^a-z ]/gi, '').trim().replace(/\s+/g, '-');
        return `<article class="spp-cms-block spp-align-${esc(align)}"><div class="spp-cms-block-inner">${row.title ? `<h2>${esc(row.title)}</h2>` : ''}${settings.excerpt ? `<p class="spp-cms-excerpt">${esc(settings.excerpt)}</p>` : ''}<div class="spp-cms-body">${cleanHtml(row.body || '')}</div>${row.link_url ? `<a class="spp-cms-link" href="${esc(safeHref(row.link_url))}">Learn more ↗</a>` : ''}</div></article>`;
      }).join('');
      return rows;
    } catch (error) {
      console.warn(`[SPP CMS] Public section "${section}" could not load:`, error.message);
      return [];
    }
  }
  async function updateHomeNavigation() {
    const nav = document.getElementById('navlinks');
    if (!nav) return;
    try {
      const result = await getJson('/api/public/cms/menus?location=header');
      const rows = result.data || [];
      if (rows.length) {
        const cta = nav.querySelector('.start-btn');
        nav.innerHTML = menuTreeHtml(rows, 'home');
        if (cta) nav.appendChild(cta);
      }
    } catch (error) { console.warn('[SPP CMS] Header navigation kept as static fallback:', error.message); }
  }

  async function updateHomeTeam() {
    const main = document.querySelector('main');
    if (!main || document.getElementById('sppHomeTeam')) return;
    const anchor = document.querySelector('.category-strip') || main.lastElementChild;
    const section = document.createElement('section');
    section.id = 'sppHomeTeam';
    section.className = 'spp-home-team';
    section.innerHTML = '<div class="spp-home-team-head"><span class="spp-home-team-kicker">THE PEOPLE BEHIND THE STORIES</span><h2>Meet the Shoto Point Team</h2><p>Leadership, administration and creative professionals bringing every production to life.</p></div><div class="spp-home-team-grid" id="sppHomeTeamGrid"><p class="spp-team-loading">Loading published team profiles…</p></div><div class="spp-home-team-actions"><a href="/shoto_point_team_pages/ceo.html">Executive Team</a><a href="/shoto_point_team_pages/administrative.html">Administrative Team</a><a href="/shoto_point_team_pages/senior-teams.html">Senior Team</a></div>';
    if (anchor && anchor.parentElement) anchor.insertAdjacentElement('afterend', section); else main.appendChild(section);
    const grid = section.querySelector('#sppHomeTeamGrid');
    try {
      const data = await getJson('/api/public/team');
      const rows = (data.data || []).slice(0, 6);
      if (!rows.length) { grid.innerHTML = '<p class="spp-team-loading">Team profiles will appear here when published by the administrator.</p>'; return; }
      grid.innerHTML = rows.map(member => `<article class="spp-home-team-card"><img src="${esc(member.image_url || '/assets/team-placeholder.jpg')}" alt="${esc(member.name)}" loading="lazy"><div><span>${esc(member.role || 'Team Member')}</span><h3>${esc(member.name)}</h3><p>${esc(member.short_bio || '')}</p><a href="/team-member.html?id=${encodeURIComponent(member.id)}">View profile ↗</a></div></article>`).join('');
    } catch (error) {
      grid.innerHTML = '<p class="spp-team-loading">Team profiles are temporarily unavailable. Please refresh to try again.</p>';
      console.warn('[SPP Team] Public profiles could not load:', error.message);
    }
  }
  async function updateSyfmNavigation() {
    const nav = document.getElementById('mainNav');
    if (nav && !nav.dataset.sppCmsDelegate) {
      nav.dataset.sppCmsDelegate = '1';
      // SYFM's original navigation uses an SPA router (navigateTo), not native page anchors.
      // The CMS replaces the original links, so this delegated listener preserves that router.
      nav.addEventListener('click', event => {
        const link = event.target.closest('a.nav-link');
        if (!link || !nav.contains(link)) return;
        const href = link.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        const pageName = href.slice(1);
        if (typeof window.navigateTo !== 'function') return;
        event.preventDefault();
        window.navigateTo(pageName, true);
        history.pushState({ page: pageName }, '', `#${pageName}`);
      });
    }
    try {
      const result = await getJson('/api/public/cms/menus?location=syfm');
      const rows = result.data || [];
      if (nav && rows.length) {
        const join = rows.find(x => /join\s*syfm/i.test(x.name) || x.slug === 'syfm-join-syfm');
        nav.innerHTML = menuTreeHtml(rows.filter(x => x !== join), 'syfm');
        const joinLink = document.querySelector('.header-actions a.btn.nav-link');
        if (joinLink && join) { joinLink.href = safeHref(join.url); joinLink.textContent = `${join.name} →`; }
      }
    } catch (error) { console.warn('[SPP CMS] SYFM navigation kept as static fallback:', error.message); }
  }
  async function init() {
    const script = document.querySelector('script[src*="spp-cms-public.js"]');
    const pathFile = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
    const queryPage = new URLSearchParams(location.search).get('page');
    const inferred = queryPage || (pathFile.toLowerCase() === 'index.html' || pathFile === '' ? 'home' : pageSlug(pathFile.replace(/\.html?$/i, '')));
    const page = pageSlug(script?.dataset?.sppPage || document.body?.dataset?.sppPage || inferred) || 'home';

    const header = document.querySelector('header, .site-header, .header');
    const footer = document.querySelector('footer, .site-footer, .footer');
    const headerSlot = makeSlot('sppCmsHeaderContent', header, 'after');
    const footerSlot = makeSlot('sppCmsFooterContent', footer, 'append');
    const tasks = [injectBlocks('header', headerSlot), injectBlocks('footer', footerSlot)];

    if (page === 'home') {
      await updateHomeNavigation();
      tasks.push(updateHomeTeam());
      tasks.push(injectBlocks('home', document.getElementById('sppCmsHomeContent') || makeSlot('sppCmsHomeContent', document.querySelector('main') || document.body)));
    } else if (page === 'syfm') {
      await updateSyfmNavigation();
      tasks.push(injectBlocks('syfm', document.getElementById('sppCmsSyfmContent') || makeSlot('sppCmsSyfmContent', document.getElementById('page-home') || document.querySelector('main') || document.body)));
    } else if (page !== 'news' && page !== 'news-article') {
      const main = document.querySelector('main') || document.querySelector('#main-content') || document.querySelector('.main-content') || document.body;
      const pageSlot = makeSlot('sppCmsPageContent', main, 'append');
      tasks.push(injectBlocks(page, pageSlot).then(rows=>{
        if (pathFile.toLowerCase()==='cms-page.html') {
          const pageRecord=(rows||[]).find(row=>String(row.content_type||'').toLowerCase()==='page') || (rows||[])[0];
          if (pageRecord?.title) {
            const titleNode=document.getElementById('sppDynamicPageTitle');
            if (titleNode) titleNode.textContent=pageRecord.title;
            document.title=`${pageRecord.title} | Shoto Point Production`;
          }
        }
      }));
    }
    await Promise.allSettled(tasks);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
