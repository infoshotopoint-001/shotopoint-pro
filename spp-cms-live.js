/* Shoto Point Production — live CMS / Team / SYFM admin workspaces.
   Loaded after app2.js. Uses the existing authenticated Express + MySQL API. */
(function () {
  'use strict';

  const state = { cms: [], team: [], headerMenus: [], syfmMenus: [], dashboard: null, activity: [], page: null, pageSlug: 'home', busy: false, apiConnected: false };
  const categories = ['Nigeria','Politics','Celebrities','Movies & Film','Actors','Musicians','Talents','Football','Media','Tech','World','SPP Originals'];
  const types = ['Article','Page','Section','Header','Footer'];
  const alignments = ['right','left','top','bottom','top right','top left','centre','bottom left','bottom right'];
  const $ = (s, root=document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const base = String(window.SPP_CONFIG?.API_BASE_URL || '').replace(/\/$/, '');
  const endpoint = p => `${base}${p.startsWith('/') ? p : `/${p}`}`;

  async function api(path, options={}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    const token = localStorage.getItem('adminToken') || localStorage.getItem('t') || localStorage.getItem('shotoNewsAdminToken');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    let response;
    try { response = await fetch(endpoint(path), { ...options, headers, body, credentials: 'same-origin', cache: 'no-store' }); }
    catch (error) { state.apiConnected = false; throw new Error(`Cannot reach the Shoto Point API: ${error.message || error}`); }
    state.apiConnected = Boolean(response.ok);
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: text.slice(0, 300) }; }
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your administrator session has expired. Sign in again.');
      throw new Error(payload.error || payload.message || `Request failed (${response.status}).`);
    }
    return payload;
  }

  function notify(message, kind='success') {
    if (typeof window.toast === 'function') window.toast(message, kind);
    else alert(message);
  }
  function modal(title, html, eyebrow='LIVE DATABASE EDITOR') {
    $('#modalTitle').textContent = title;
    $('#modalEyebrow').textContent = eyebrow;
    $('#modalBody').innerHTML = html;
    $('#modalBackdrop').hidden = false;
  }
  function closeModal() { $('#modalBackdrop').hidden = true; }
  function parseSettings(row) {
    try { return typeof row?.settings_json === 'string' ? JSON.parse(row.settings_json || '{}') : (row?.settings_json || {}); }
    catch { return {}; }
  }
  function uiStatus(value) {
    const s = String(value || 'draft').toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
    return ({draft:'Draft', pending:'Pending review', pending_review:'Pending review', scheduled:'Scheduled', published:'Published'})[s] || 'Draft';
  }
  function dbStatus(value) {
    return ({'Draft':'draft','Pending review':'pending_review','Scheduled':'scheduled','Published':'published'})[value] || 'draft';
  }
  function slugify(value) { return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,170) || `menu-${Date.now()}`; }
  function statusClass(value) { return ({Draft:'draft','Pending review':'pending',Scheduled:'scheduled',Published:'published'})[uiStatus(value)] || 'draft'; }
  function fmtDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(); }
  function safeBody(value) {
    const t = document.createElement('template'); t.innerHTML = String(value || '');
    t.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(n=>n.remove());
    t.content.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(a=>{
        if (/^on/i.test(a.name) || ['srcdoc'].includes(a.name.toLowerCase())) el.removeAttribute(a.name);
        if (['href','src','xlink:href'].includes(a.name.toLowerCase()) && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }
  function uploadStatus() { return state.apiConnected ? '<span class="status published">CONNECTED TO MYSQL</span>' : '<span class="status pending">CHECKING DATABASE</span>'; }

  function renderCms() {
    const rows = state.cms;
    const counts = { Published:0, Draft:0, Scheduled:0, 'Pending review':0 };
    rows.forEach(r=>counts[uiStatus(r.status)] = (counts[uiStatus(r.status)] || 0) + 1);
    return `${window.header('CMS Content','Create, edit, schedule and publish website pages, sections and Shoto News articles.',`<button class="btn primary" data-spp-live="cms-new">＋ New content</button>`)}
      <div class="grid four-col">
       ${Object.entries(counts).map(([k,v])=>`<div class="card stat-card"><span class="stat-label">${esc(k)}</span><strong>${v}</strong><small>Live database records</small></div>`).join('')}
      </div>
      <section class="card section-card" style="margin-top:15px">
       <div class="card-head"><div><h3>Content types</h3><p>All changes save to the Shoto Point MySQL CMS.</p></div>${uploadStatus()}</div>
       <div class="cms-type-grid">${types.map(t=>`<button class="cms-type-card" data-spp-live="cms-new" data-type="${t}"><strong>${t}</strong><small>${({Article:'News stories and editorial content',Page:'Public website pages',Section:'Reusable page sections',Header:'Global header content',Footer:'Global footer content'})[t]}</small><span>＋ Create ${t.toLowerCase()}</span></button>`).join('')}</div>
      </section>
      <section class="card section-card">
       <div class="toolbar"><div class="toolbar-left"><input class="field" id="sppCmsSearch" placeholder="Search saved content..."><select class="select" id="sppCmsType"><option value="">All content types</option>${types.map(t=>`<option>${t}</option>`).join('')}</select><select class="select" id="sppCmsStatus"><option value="">All statuses</option>${['Draft','Pending review','Scheduled','Published'].map(s=>`<option>${s}</option>`).join('')}</select></div><div class="toolbar-right"><button class="btn" data-spp-live="cms-refresh">Refresh</button></div></div>
       <div class="table-wrap"><table class="content-table"><thead><tr><th>Title</th><th>Type</th><th>Website section</th><th>Alignment</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody id="sppCmsRows">${cmsRowsMarkup(rows)}</tbody></table></div>
      </section>
      <p class="helper-text">Drafts and review items are stored privately. Only Published items (and scheduled items after their publication time) appear on public pages.</p>`;
  }
  function cmsRowsMarkup(rows) {
    if (!rows.length) return '<tr><td colspan="7"><div class="empty-state">No CMS content has been created yet. Create an Article, Page, Section, Header or Footer to begin.</div></td></tr>';
    return rows.map(r=>`<tr data-live-row="cms" data-id="${Number(r.id)}"><td><strong>${esc(r.title || 'Untitled')}</strong></td><td>${esc(r.content_type)}</td><td>${esc(r.section)}</td><td>${esc(r.placement || 'centre')}</td><td><span class="status ${statusClass(r.status)}">${esc(uiStatus(r.status))}</span></td><td>${esc(fmtDate(r.updated_at))}</td><td><button class="btn" data-spp-live="cms-edit" data-id="${Number(r.id)}">Edit</button> <button class="btn danger" data-spp-live="cms-delete" data-id="${Number(r.id)}">Delete</button></td></tr>`).join('');
  }
  function money(value) { return `₦${Number(value || 0).toLocaleString('en-NG',{maximumFractionDigits:2})}`; }
  function renderOverview() {
    const d=state.dashboard||{};
    const cards=[
      ['Website visitors · 30 days',d.visitors,'Database visitor records'],
      ['Published CMS content',state.cms.filter(r=>uiStatus(r.status)==='Published').length,'Published content blocks from MySQL'],
      ['Meetings',d.meetings,'Meeting registrations'],
      ['Orders',d.orders,'Recorded orders'],
      ['Revenue',d.revenue===undefined?null:money(d.revenue),'Successful / paid transactions'],
      ['Pending news',d.pendingNews,'News submissions awaiting review']
    ];
    return `${window.header('Executive Overview','Live operational totals retrieved from the Shoto Point MySQL backend.',`<button class="btn" data-spp-live="overview-refresh">Refresh live data</button>`)}
      <div class="grid three-col">${cards.map(([label,value,note])=>`<div class="card stat-card"><span class="stat-label">${esc(label)}</span><strong>${value===undefined||value===null?'—':(label==='Revenue'?esc(String(value)):esc(Number(value).toLocaleString('en-NG')))}</strong><small>${esc(note)}</small></div>`).join('')}</div>
      <section class="card section-card" style="margin-top:16px"><div class="card-head"><div><h3>Publishing records</h3><p>Counts calculated from the CMS records returned by MySQL.</p></div><span class="status published">LIVE DATABASE</span></div>
      <div class="grid four-col">${[['Published',state.cms.filter(r=>uiStatus(r.status)==='Published').length],['Draft',state.cms.filter(r=>uiStatus(r.status)==='Draft').length],['Pending review',state.cms.filter(r=>uiStatus(r.status)==='Pending review').length],['Scheduled',state.cms.filter(r=>uiStatus(r.status)==='Scheduled').length]].map(([k,v])=>`<div class="card stat-card"><span class="stat-label">${esc(k)}</span><strong>${v}</strong><small>CMS rows loaded from MySQL</small></div>`).join('')}</div></section>
      <section class="card section-card"><div class="card-head"><div><h3>Recent administrator activity</h3><p>Latest audit events from the backend.</p></div></div>${state.activity.length?`<div class="activity-list">${state.activity.slice(0,8).map(a=>`<div class="activity-item"><i class="activity-bullet"></i><div><strong>${esc(a.action||'Activity')} · ${esc(a.entity_type||'system')}</strong><small>${esc(a.entity_id||'')} · ${esc(fmtDate(a.created_at))}</small></div></div>`).join('')}</div>`:'<div class="empty-state">No administrator activity records were returned.</div>'}</section>
      <p class="helper-text">Only values returned by the live API are shown. An em dash means the API did not supply that metric; no sample figures are substituted.</p>`;
  }
  function renderWebsite() {
    const slug=state.pageSlug||'home';
    const rows=state.cms.filter(r=>String(r.section||'').toLowerCase()===slug.toLowerCase());
    const pathMap={home:'/index.html',about:'/About.html',news:'/news.html',syfm:'/SYFM(2).html',team:'/shoto_point_team_pages/ceo.html',production:'/Production.html','our-webs':'/index.html','our-story':'/OurStories.html',contact:'/HaveAStory.html'};
    return `${window.header('Website & Page Builder','Create and publish page content and reusable sections to the live Shoto Point website.',`<button class="btn" data-spp-live="website-preview" data-slug="${esc(slug)}">Preview public page</button><button class="btn" data-spp-live="website-new-page">＋ New page</button><button class="btn primary" data-spp-live="website-new-section">＋ Add section</button>`)}
      <section class="card section-card"><div class="toolbar"><div class="toolbar-left"><label class="helper-text" for="sppBuilderPage">Choose website page</label><select class="select" id="sppBuilderPage">${[['home','Home'],['about','About'],['service','Service'],['production','Production'],['team','Team'],['our-webs','Our Webs'],['our-story','Our Story'],['contact','Contact'],['syfm','SYFM']].map(([v,l])=>`<option value="${v}" ${slug===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="toolbar-right"><button class="btn" data-spp-live="website-publish-section" data-slug="${esc(slug)}">Publish eligible content</button></div></div>
       <div class="card-head"><div><h3>${esc(slug)} page content</h3><p>Each page block is saved in MySQL and rendered by the public page at ${esc(pathMap[slug]||`/cms-page.html?page=${encodeURIComponent(slug)}`)}.</p></div><span class="status published">LIVE CMS</span></div>
       <div class="table-wrap"><table class="content-table"><thead><tr><th>Title</th><th>Type</th><th>Website section</th><th>Alignment</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${cmsRowsMarkup(rows)}</tbody></table></div>
      </section><section class="card section-card"><div class="card-head"><div><h3>Public page preview</h3><p>Preview shows published website content. Use the editor above to save drafts or publish changes.</p></div><button class="btn" data-spp-live="website-refresh-preview">Refresh preview</button></div><iframe title="Public page preview" src="${esc(pathMap[slug]||`/cms-page.html?page=${encodeURIComponent(slug)}`)}" style="width:100%;height:560px;border:1px solid rgba(214,165,45,.25);border-radius:12px;background:#080a0c" loading="lazy"></iframe></section>`;
  }
  function renderNews() {
    const rows=state.cms.filter(r=>String(r.section||'').toLowerCase()==='news'&&String(r.content_type||'').toLowerCase()==='article');
    return `${window.header('Shoto News Publishing','Create, edit, review, schedule and publish original Shoto Point newsroom stories.',`<button class="btn primary" data-spp-live="cms-new" data-type="Article">＋ New news article</button>`)}
      <section class="card section-card"><div class="card-head"><div><h3>Shoto Point articles</h3><p>These records are stored in MySQL and supplied to the public newsroom API.</p></div><span class="status published">LIVE DATABASE</span></div>
      <div class="toolbar"><input class="field" id="sppNewsSearch" placeholder="Search SPP articles..."><select class="select" id="sppNewsStatus"><option value="">All statuses</option>${['Draft','Pending review','Scheduled','Published'].map(x=>`<option>${x}</option>`).join('')}</select><button class="btn" data-spp-live="cms-refresh">Refresh</button></div>
      <div class="table-wrap"><table class="content-table"><thead><tr><th>Headline</th><th>Category</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody id="sppNewsRows">${newsRowsMarkup(rows)}</tbody></table></div></section>`;
  }
  function newsRowsMarkup(rows) {
    if(!rows.length)return '<tr><td colspan="5"><div class="empty-state">No Shoto Point articles have been created. Select “New news article” to publish an original story.</div></td></tr>';
    return rows.map(r=>{const settings=parseSettings(r);return `<tr><td><strong>${esc(r.title||'Untitled')}</strong></td><td>${esc(settings.category||'SPP Originals')}</td><td><span class="status ${statusClass(r.status)}">${esc(uiStatus(r.status))}</span></td><td>${esc(fmtDate(r.updated_at))}</td><td><button class="btn" data-spp-live="cms-edit" data-id="${Number(r.id)}">Edit</button> <button class="btn danger" data-spp-live="cms-delete" data-id="${Number(r.id)}">Delete</button></td></tr>`}).join('');
  }

  function renderTeam() {
    const groups = [['ceo','Executive'],['administrative','Administrative'],['senior','Senior']];
    return `${window.header('Team Management','Manage real staff profiles, photographs, biographies and public visibility.',`<button class="btn primary" data-spp-live="team-new">＋ Add team profile</button>`)}
      <section class="card section-card"><div class="card-head"><div><h3>Published team profiles</h3><p>Profiles are saved in MySQL and delivered to the public Team pages.</p></div>${uploadStatus()}</div>
      <div class="toolbar"><input class="field" id="sppTeamSearch" placeholder="Search name or role..."><select class="select" id="sppTeamGroup"><option value="">All groups</option>${groups.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><button class="btn" data-spp-live="team-refresh">Refresh</button></div>
      <div class="table-wrap"><table class="content-table"><thead><tr><th>Photo</th><th>Name</th><th>Position</th><th>Group</th><th>Visibility</th><th>Order</th><th>Actions</th></tr></thead><tbody id="sppTeamRows">${teamRowsMarkup(state.team)}</tbody></table></div></section>`;
  }
  function teamRowsMarkup(rows) {
    if (!rows.length) return '<tr><td colspan="7"><div class="empty-state">No team profiles are saved yet. Add a verified team profile to publish it.</div></td></tr>';
    return rows.map(r=>`<tr><td>${r.image_url?`<img src="${esc(r.image_url)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:50%">`:'—'}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.role)}</td><td>${esc(r.group_key)}</td><td><span class="status ${Number(r.active)?'published':'draft'}">${Number(r.active)?'Visible':'Hidden'}</span></td><td>${Number(r.display_order)||0}</td><td><button class="btn" data-spp-live="team-edit" data-id="${Number(r.id)}">Edit</button> <button class="btn danger" data-spp-live="team-delete" data-id="${Number(r.id)}">Delete</button></td></tr>`).join('');
  }

  function renderMenuWorkspace(rows, location, title, description, action) {
    const roots = rows.filter(x=>!x.parent_id);
    const markup = rows.length ? roots.map(parent=>{
      const children=rows.filter(x=>Number(x.parent_id)===Number(parent.id));
      return `<div class="menu-tree-node"><div class="quick-row"><span><strong>${esc(parent.name)}</strong> <small>${esc(parent.url||'#')}</small></span><span><button class="btn" data-spp-live="menu-edit" data-location="${location}" data-id="${parent.id}">Edit</button> <button class="btn" data-spp-live="menu-up" data-id="${parent.id}" data-location="${location}">↑</button> <button class="btn" data-spp-live="menu-down" data-id="${parent.id}" data-location="${location}">↓</button> <button class="btn danger" data-spp-live="menu-delete" data-id="${parent.id}" data-location="${location}">×</button></span></div>${children.length?`<div class="submenu-tree">${children.map(ch=>`<div class="submenu-row"><span>↳ ${esc(ch.name)} <small>${esc(ch.url||'#')}</small></span><span><button class="btn" data-spp-live="menu-edit" data-id="${ch.id}" data-location="${location}">Edit</button> <button class="btn danger" data-spp-live="menu-delete" data-id="${ch.id}" data-location="${location}">×</button></span></div>`).join('')}</div>`:''}</div>`;
    }).join('') : '<div class="empty-state">No menu items have been saved in this location yet.</div>';
    const extra = location==='header' ? `<button class="btn" data-spp-live="menu-restore">Restore requested menu</button>` : '';
    return `${window.header(title,description,`${extra}<button class="btn primary" data-spp-live="menu-new" data-location="${location}">＋ Add menu item</button>`)}<section class="card section-card"><div class="card-head"><div><h3>${esc(location.toUpperCase())} navigation</h3><p>Saved navigation is read directly by the public website.</p></div>${uploadStatus()}</div><div class="section-body menu-tree">${markup}</div></section>`;
  }
  function renderSyfm() {
    const rows=state.syfmMenus;
    return renderMenuWorkspace(rows,'syfm','SYFM Management','Manage Home, About, Vision, Programmes, Leadership, Public Affairs, Membership, Events, News, Gallery, Contact and JOIN SYFM. Changes publish directly to SYFM(2).html.');
  }
  function renderHeaderMenus() {
    return renderMenuWorkspace(state.headerMenus,'header','Website Menus','Manage the Shoto Point public navigation and dropdowns shown on index.html. Changes are saved to MySQL and read by the public homepage.');
  }

  async function loadCms() {
    try {
      try { await api('/api/admin/cms/schedule/publish-due',{method:'POST',body:{}}); } catch {}
      const data=await api('/api/admin/cms/content-blocks'); state.cms=data.data||[];
      if (['cms','website','news','overview'].includes(state.page)) repaint(state.page);
    } catch(e) { if(['cms','website','news'].includes(state.page)) showLoadError('CMS Content',e); }
  }
  async function ensureSeedMenus(location) {
    let all=(await api('/api/admin/cms/menus')).data||[];
    let rows=all.filter(x=>x.location===location);
    const syfm = location==='syfm';
    const defaults = syfm ? [
      {name:'Home',url:'#home'}, {name:'About',url:'#about'}, {name:'Vision',url:'#vision'},
      {name:'Programmes',url:'#programmes'}, {name:'Leadership',url:'#leadership'},
      {name:'Public Affairs',url:'#public-affairs'}, {name:'Membership',url:'#membership'},
      {name:'Events',url:'#events'}, {name:'News',url:'#news'}, {name:'Gallery',url:'#gallery'},
      {name:'Contact',url:'#contact'}, {name:'JOIN SYFM',url:'/MemberShip.html'}
    ] : [
      {name:'Home',url:'/index.html'}, {name:'About',url:'/About.html'}, {name:'Service',url:'/cms-page.html?page=service'},
      {name:'Production',url:'/Production.html'}, {name:'Team',url:'/shoto_point_team_pages/ceo.html'},
      {name:'Our Webs',url:'/OurWebsites.html'}, {name:'Our Story',url:'/OurStories.html'}, {name:'Contact',url:'/HaveAStory.html'}
    ];
    const childDefaults = syfm ? {} : {
      Service:[['Film & Television Production','/Production.html'],['Photography','/Photography.html'],['Live Streaming & Events','/PodcastLiveSessions.html'],['Creative & Digital Services','/DigitalMedia.html']],
      Production:[['Film Production','/FilmProduction.html'],['Television Production','/TelevisionProduction.html'],['Documentaries','/Documentary.html'],['Commercials & Music Videos','/Commercials.html'],['Post Production','/PostProduction.html']],
      Team:[['Executive','/shoto_point_team_pages/ceo.html'],['Administrative','/shoto_point_team_pages/administrative.html'],['Senior','/shoto_point_team_pages/senior-teams.html']],
      'Our Webs':[['Shoto News','/news.html'],['SYFM','/SYFM(2).html'],['SPP Originals','/OurStories.html']],
      'Our Story':[['Our Journey','/OurStories.html'],['Novels','/Novel.html'],['Songs','/Songs.html'],['Tutorials','/Tutorials.html']]
    };
    let order=0;
    for (const item of defaults) {
      order++;
      let root=rows.find(x=>!x.parent_id && String(x.name).toLowerCase()===item.name.toLowerCase());
      if (!root) {
        const created=await api('/api/admin/cms/menus',{method:'POST',body:{name:item.name,slug:`${location}-${slugify(item.name)}`,location,parentId:null,sortOrder:order,enabled:true,target:'_self',url:item.url}});
        root={id:created.id,name:item.name,slug:`${location}-${slugify(item.name)}`,location,parent_id:null,sort_order:order,enabled:1,target:'_self',url:item.url};
        rows.push(root);
      }
      if (childDefaults[item.name]) {
        let childOrder=0;
        for (const [childName,childUrl] of childDefaults[item.name]) {
          childOrder++;
          const exists=rows.some(x=>Number(x.parent_id)===Number(root.id) && String(x.name).toLowerCase()===childName.toLowerCase());
          if (!exists) {
            const created=await api('/api/admin/cms/menus',{method:'POST',body:{name:childName,slug:`${location}-${slugify(item.name)}-${slugify(childName)}`,location,parentId:Number(root.id),sortOrder:childOrder,enabled:true,target:'_self',url:childUrl}});
            rows.push({id:created.id,name:childName,slug:`${location}-${slugify(item.name)}-${slugify(childName)}`,location,parent_id:Number(root.id),sort_order:childOrder,enabled:1,target:'_self',url:childUrl});
          }
        }
      }
    }
    return (await api('/api/admin/cms/menus')).data.filter(x=>x.location===location);
  }
  async function loadMenus(location) {
    try {
      const rows=await ensureSeedMenus(location);
      if(location==='syfm') state.syfmMenus=rows; else state.headerMenus=rows;
      if(state.page===(location==='syfm'?'syfm':'menus')) repaint(state.page);
    } catch(e) { if(state.page===(location==='syfm'?'syfm':'menus')) showLoadError('Website navigation',e); }
  }
  async function restoreRequestedHeaderMenu() {
    if(!confirm('Replace the current primary navigation with the requested Home, About, Service, Production, Team, Our Webs, Our Story and Contact structure?'))return;
    const rows=state.headerMenus;
    for(const root of rows.filter(x=>!x.parent_id)) await api(`/api/admin/cms/menus/${root.id}`,{method:'DELETE'});
    const tree=[
      {name:'Home',url:'/index.html'},
      {name:'About',url:'/About.html'},
      {name:'Service',url:'/cms-page.html?page=service',children:[['Film & Television Production','/Production.html'],['Photography','/Photography.html'],['Live Streaming & Events','/PodcastLiveSessions.html'],['Creative & Digital Services','/DigitalMedia.html']]},
      {name:'Production',url:'/Production.html',children:[['Film Production','/FilmProduction.html'],['Television Production','/TelevisionProduction.html'],['Documentaries','/Documentary.html'],['Commercials & Music Videos','/Commercials.html'],['Post Production','/PostProduction.html']]},
      {name:'Team',url:'/shoto_point_team_pages/ceo.html',children:[['Executive','/shoto_point_team_pages/ceo.html'],['Administrative','/shoto_point_team_pages/administrative.html'],['Senior','/shoto_point_team_pages/senior-teams.html']]},
      {name:'Our Webs',url:'/OurWebsites.html',children:[['Shoto News','/news.html'],['SYFM','/SYFM(2).html'],['SPP Originals','/OurStories.html']]},
      {name:'Our Story',url:'/OurStories.html',children:[['Our Journey','/OurStories.html'],['Novels','/Novel.html'],['Songs','/Songs.html'],['Tutorials','/Tutorials.html']]},
      {name:'Contact',url:'/HaveAStory.html'}
    ];
    let order=0;
    for(const item of tree){order++;const r=await api('/api/admin/cms/menus',{method:'POST',body:{name:item.name,slug:`header-${slugify(item.name)}`,location:'header',parentId:null,sortOrder:order,enabled:true,target:'_self',url:item.url}});for(let i=0;i<(item.children||[]).length;i++){const [name,url]=item.children[i];await api('/api/admin/cms/menus',{method:'POST',body:{name,slug:`header-${slugify(item.name)}-${slugify(name)}`,location:'header',parentId:r.id,sortOrder:i+1,enabled:true,target:'_self',url}});}}
    notify('Requested primary navigation restored and published.');await loadMenus('header');
  }
  async function loadTeam() {
    try { const r=await api('/api/admin/team'); state.team=r.data||[]; if(state.page==='team')repaint('team'); }
    catch(e){ if(state.page==='team')showLoadError('Team Management',e); }
  }
  async function loadDashboard() {
    try {
      const [dash,cms,activity]=await Promise.all([
        api('/api/admin/dashboard'),
        api('/api/admin/cms/content-blocks'),
        api('/api/admin/cms/activity')
      ]);
      state.dashboard=dash.data||{}; state.cms=cms.data||[]; state.activity=activity.data||[];
      if(state.page==='overview')repaint('overview');
    } catch(e) { if(state.page==='overview')showLoadError('Executive Overview',e); }
  }
  function repaint(page) { const node=$('#content'); if(node)node.innerHTML=window.renderPage(page); }
  function showLoadError(title,error) { const node=$('#content'); if(node)node.insertAdjacentHTML('afterbegin',`<div class="card" style="border-color:#a94b4b;margin-bottom:12px"><strong>${esc(title)} could not load from the live API</strong><p>${esc(error.message||error)}</p><small>Check that you are signed in and the Node.js / MySQL services are running.</small></div>`); }

  const oldRenderPage=window.renderPage;
  if (typeof oldRenderPage==='function') {
    window.renderPage=function(page){
      if(page==='overview')return renderOverview();
      if(page==='website')return renderWebsite();
      if(page==='cms')return renderCms();
      if(page==='news')return renderNews();
      if(page==='team')return renderTeam();
      if(page==='syfm')return renderSyfm();
      if(page==='menus')return renderHeaderMenus();
      return oldRenderPage(page);
    };
  }
  const oldSetPage=window.setPage;
  if (typeof oldSetPage==='function') {
    window.setPage=function(page){
      const result=oldSetPage(page);
      state.page=page;
      if(page==='overview')loadDashboard();
      if(page==='website'||page==='cms'||page==='news')loadCms();
      if(page==='team')loadTeam();
      if(page==='syfm')loadMenus('syfm');
      if(page==='menus')loadMenus('header');
      return result;
    };
  }

  function cmsEditor(row=null, type='Article') {
    const settings=parseSettings(row);
    const status=uiStatus(row?.status);
    const defaultSection=type==='Article'?'news':type==='Header'?'header':type==='Footer'?'footer':(type==='Page'||type==='Section')?(state.pageSlug||'home'):'home';
    const scheduleValue=row?.scheduled_at ? new Date(row.scheduled_at).toISOString().slice(0,16) : '';
    modal(row?'Edit content':'Create content',`
      <div class="form-grid">
       <label class="full">Title<input class="field" id="liveCmsTitle" value="${esc(row?.title||'')}" required></label>
       <label>Content type<select class="select" id="liveCmsType">${types.map(t=>`<option ${((row?.content_type||type)===t)?'selected':''}>${t}</option>`).join('')}</select></label>
       <label>Website section / page key<input class="field" id="liveCmsSection" value="${esc(row?.section||defaultSection)}" placeholder="home, news, syfm"></label>
       <label>Alignment<select class="select" id="liveCmsAlignment">${alignments.map(a=>`<option ${((row?.placement||settings.alignment||'left')===a)?'selected':''}>${a}</option>`).join('')}</select></label>
       <label>Status<select class="select" id="liveCmsStatus">${['Draft','Pending review','Scheduled','Published'].map(s=>`<option ${status===s?'selected':''}>${s}</option>`).join('')}</select></label>
       <label>News category<select class="select" id="liveCmsCategory"><option value="">General / not a news article</option>${categories.map(c=>`<option value="${esc(c)}" ${(settings.category||'SPP Originals')===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
       <label>Publish date/time<input class="field" id="liveCmsSchedule" type="datetime-local" value="${esc(scheduleValue)}"></label>
       <label class="full">Short excerpt / summary<textarea class="field" id="liveCmsExcerpt" rows="2">${esc(settings.excerpt||'')}</textarea></label>
       <label class="full">Link URL (optional)<input class="field" id="liveCmsLink" value="${esc(row?.link_url||'')}" placeholder="https:// or /relative-page.html"></label>
       <label class="full">SEO slug<input class="field" id="liveCmsSlug" value="${esc(settings.slug||slugify(row?.title||''))}"></label>
      </div>
      <div class="editor-toolbar cms-rich-toolbar" style="margin-top:14px">
       <select class="select" id="liveCmsFontFace" aria-label="Font family"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option><option value="Tahoma">Tahoma</option><option value="Trebuchet MS">Trebuchet MS</option><option value="Courier New">Courier New</option></select>
       <select class="select" id="liveCmsFontSize" aria-label="Text size"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">Extra large</option><option value="6">Heading</option></select>
       <button type="button" data-live-format="bold"><b>B</b></button><button type="button" data-live-format="italic"><i>I</i></button><button type="button" data-live-format="underline"><u>U</u></button><button type="button" data-live-format="insertUnorderedList">☷ List</button><button type="button" data-live-insert="link">↗ Link</button><button type="button" data-live-upload="image">＋ Image</button><button type="button" data-live-upload="video">＋ Video</button><button type="button" data-live-upload="audio">＋ Audio</button><button type="button" data-live-upload="document">＋ Document (PDF)</button>
      </div>
      <div id="liveCmsEditor" class="cms-rich-editor" contenteditable="true" spellcheck="true">${safeBody(row?.body||'')}</div>
      <input type="file" id="liveCmsFile" accept="image/*,video/*,audio/*,application/pdf" hidden>
      <div class="cms-editor-foot"><span class="status published">SAVED TO MYSQL ON SAVE</span><span class="helper-text">Only Published content appears on public pages. Scheduled content publishes automatically when due.</span></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" id="liveCmsCancel">Cancel</button><button class="btn primary" id="liveCmsSave">${row?'Save changes':'Save content'}</button></div>
    `,'MYSQL CMS EDITOR');
    const editor=$('#liveCmsEditor');
    $('#liveCmsAlignment').addEventListener('change',e=>{editor.style.textAlign=e.target.value.includes('left')?'left':e.target.value.includes('right')?'right':e.target.value==='centre'?'center':'left';});
    $('#modalBody').onchange=e=>{
      if(e.target.id==='liveCmsFontFace'){editor.focus();document.execCommand('fontName',false,e.target.value);}
      if(e.target.id==='liveCmsFontSize'){editor.focus();document.execCommand('fontSize',false,e.target.value);}
    };
    $('#modalBody').onclick=async e=>{
      const fmt=e.target.closest('[data-live-format]'); if(fmt){e.preventDefault();editor.focus();document.execCommand(fmt.dataset.liveFormat,false,null);return;}
      const link=e.target.closest('[data-live-insert="link"]'); if(link){e.preventDefault();const url=prompt('Enter link URL','https://');if(url){editor.focus();document.execCommand('createLink',false,url);}return;}
      const uploadButton=e.target.closest('[data-live-upload]'); if(uploadButton){e.preventDefault();const kind=uploadButton.dataset.liveUpload;const input=$('#liveCmsFile');input.dataset.kind=kind;input.accept=kind==='document'?'.pdf':`${kind}/*`;input.click();}
    };
    $('#liveCmsFile').addEventListener('change',async e=>{
      const file=e.target.files?.[0]; if(!file)return;
      const fd=new FormData();fd.append('file',file);fd.append('altText',file.name);fd.append('caption','');
      try{
        notify('Uploading media to the Shoto Point server…');
        const r=await api('/api/admin/cms/media',{method:'POST',body:fd});
        const url=r.url; const kind=file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':file.type==='application/pdf'?'document':'image';
        const html=kind==='video'?`<video controls preload="metadata" src="${esc(url)}" style="max-width:100%"></video><p></p>`:kind==='audio'?`<audio controls src="${esc(url)}"></audio><p></p>`:kind==='document'?`<p><a href="${esc(url)}" target="_blank" rel="noopener">${esc(file.name)}</a></p>`:`<p><img src="${esc(url)}" alt="${esc(file.name)}" style="max-width:100%;height:auto"></p>`;
        editor.focus();document.execCommand('insertHTML',false,html);notify('Media uploaded and inserted.');
      }catch(err){notify(err.message,'warn');}finally{e.target.value='';}
    });
    $('#liveCmsCancel').addEventListener('click',closeModal);
    $('#liveCmsSave').addEventListener('click',async()=>{
      const title=$('#liveCmsTitle').value.trim(), section=$('#liveCmsSection').value.trim(), contentType=$('#liveCmsType').value, ui=$('#liveCmsStatus').value, scheduled=$('#liveCmsSchedule').value;
      if(!title||!section){notify('Enter a title and website section/page key.','warn');return;}
      if(ui==='Scheduled'&&!scheduled){notify('Choose a publication date and time for scheduled content.','warn');return;}
      const payload={section,title,contentType,placement:$('#liveCmsAlignment').value,body:safeBody(editor.innerHTML),mediaUrl:null,linkUrl:$('#liveCmsLink').value.trim()||null,status:dbStatus(ui),scheduledAt:ui==='Scheduled'&&scheduled?scheduled.replace('T',' ')+':00':null,settings:{category:$('#liveCmsCategory').value||null,excerpt:$('#liveCmsExcerpt').value.trim(),slug:$('#liveCmsSlug').value.trim()||slugify(title),alignment:$('#liveCmsAlignment').value,author:'Shoto Point Editorial'}};
      const button=$('#liveCmsSave');button.disabled=true;button.textContent='Saving…';
      try{
        if(row?.id) await api(`/api/admin/cms/content-blocks/${row.id}`,{method:'PUT',body:payload});
        else await api('/api/admin/cms/content-blocks',{method:'POST',body:payload});
        closeModal();notify(ui==='Published'?'Content published to the website.':'Content saved to the CMS.');await loadCms();
      }catch(err){notify(err.message,'warn');button.disabled=false;button.textContent='Save';}
    });
  }

  function teamEditor(row=null) {
    const r=row||{};
    modal(row?'Edit team profile':'Add team profile',`
      <div class="form-grid">
       <label>Group<select class="select" id="liveTeamGroup">${[['ceo','Executive'],['administrative','Administrative'],['senior','Senior']].map(([v,l])=>`<option value="${v}" ${(r.group_key||'senior')===v?'selected':''}>${l}</option>`).join('')}</select></label>
       <label>Display order<input class="field" id="liveTeamOrder" type="number" value="${Number(r.display_order)||0}"></label>
       <label class="full">Full name<input class="field" id="liveTeamName" value="${esc(r.name||'')}" required></label>
       <label class="full">Position / role<input class="field" id="liveTeamRole" value="${esc(r.role||'')}" required></label>
       <label class="full">Short biography<textarea class="field" id="liveTeamShort" rows="2">${esc(r.short_bio||'')}</textarea></label>
       <label class="full">Full biography<textarea class="field" id="liveTeamBio" rows="5">${esc(r.biography||'')}</textarea></label>
       <label class="full">Profile image URL<input class="field" id="liveTeamImage" value="${esc(r.image_url||'')}" placeholder="Upload a photograph or paste an image URL"></label>
       <label class="full">Upload profile photograph<input class="field" id="liveTeamPhoto" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
       <label>WhatsApp URL<input class="field" id="liveTeamWhatsapp" value="${esc(r.whatsapp_url||'')}"></label>
       <label>Social links (JSON)<input class="field" id="liveTeamSocial" value="${esc(typeof r.social_json==='string'?r.social_json:JSON.stringify(r.social_json||{}))}"></label>
       <label class="full"><span><input type="checkbox" id="liveTeamSocialEnabled" ${r.show_social?'checked':''}> Show social links</span></label>
       <label class="full"><span><input type="checkbox" id="liveTeamActive" ${r.active===0||r.active===false?'':'checked'}> Publish profile on public Team pages</span></label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" id="liveTeamCancel">Cancel</button><button class="btn primary" id="liveTeamSave">Save profile</button></div>
    `,'TEAM PROFILE · MYSQL');
    $('#liveTeamCancel').addEventListener('click',closeModal);
    $('#liveTeamSave').addEventListener('click',async()=>{
      const name=$('#liveTeamName').value.trim(), role=$('#liveTeamRole').value.trim();if(!name||!role){notify('Name and position are required.','warn');return;}
      let imageUrl=$('#liveTeamImage').value.trim(); const file=$('#liveTeamPhoto').files?.[0];
      const button=$('#liveTeamSave');button.disabled=true;
      try{
        if(file){const fd=new FormData();fd.append('file',file);fd.append('altText',name);const media=await api('/api/admin/cms/media',{method:'POST',body:fd});imageUrl=media.url;}
        let social={};try{social=JSON.parse($('#liveTeamSocial').value||'{}');}catch{throw new Error('Social links must be valid JSON, for example {"instagram":"https://…"}.');}
        const payload={group_key:$('#liveTeamGroup').value,name,role,short_bio:$('#liveTeamShort').value,biography:$('#liveTeamBio').value,image_url:imageUrl,whatsapp_url:$('#liveTeamWhatsapp').value.trim(),social_json:social,show_social:$('#liveTeamSocialEnabled').checked,active:$('#liveTeamActive').checked,display_order:Number($('#liveTeamOrder').value)||0};
        if(row?.id)await api(`/api/admin/team/${row.id}`,{method:'PUT',body:payload});else await api('/api/admin/team',{method:'POST',body:payload});
        closeModal();notify('Team profile saved to MySQL and public Team API.');await loadTeam();
      }catch(err){notify(err.message,'warn');button.disabled=false;}
    });
  }

  function menuEditor(row=null, location='header') {
    const currentRows=location==='syfm'?state.syfmMenus:state.headerMenus;
    const r=row||{};
    const parents=currentRows.filter(x=>!x.parent_id && Number(x.id)!==Number(r.id));
    modal(row?'Edit navigation item':'Add navigation item',`
      <div class="form-grid">
       <label class="full">Menu label<input class="field" id="liveMenuName" value="${esc(r.name||'')}" required></label>
       <label class="full">Destination URL<input class="field" id="liveMenuUrl" value="${esc(r.url||'#')}" placeholder="#about or /page.html"></label>
       <label>Parent menu<select class="select" id="liveMenuParent"><option value="">Top-level item</option>${parents.map(p=>`<option value="${p.id}" ${Number(r.parent_id)===Number(p.id)?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
       <label>Display order<input class="field" id="liveMenuOrder" type="number" value="${Number(r.sort_order)||((currentRows.length||0)+1)}"></label>
       <label>Open link<select class="select" id="liveMenuTarget"><option value="_self" ${(r.target||'_self')==='_self'?'selected':''}>Same tab</option><option value="_blank" ${r.target==='_blank'?'selected':''}>New tab</option></select></label>
       <label><span><input type="checkbox" id="liveMenuEnabled" ${r.enabled===0||r.enabled===false?'':'checked'}> Visible on public site</span></label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" id="liveMenuCancel">Cancel</button><button class="btn primary" id="liveMenuSave">Save navigation</button></div>
    `,`${location.toUpperCase()} NAVIGATION`);
    $('#liveMenuCancel').addEventListener('click',closeModal);
    $('#liveMenuSave').addEventListener('click',async()=>{
      const name=$('#liveMenuName').value.trim(),url=$('#liveMenuUrl').value.trim()||'#';if(!name){notify('Enter a menu label.','warn');return;}
      const payload={name,slug:r.slug||`${location}-${slugify(name)}-${Date.now()}`,location,parentId:$('#liveMenuParent').value?Number($('#liveMenuParent').value):null,sortOrder:Number($('#liveMenuOrder').value)||0,enabled:$('#liveMenuEnabled').checked,target:$('#liveMenuTarget').value,url};
      const btn=$('#liveMenuSave');btn.disabled=true;
      try{if(r.id)await api(`/api/admin/cms/menus/${r.id}`,{method:'PUT',body:payload});else await api('/api/admin/cms/menus',{method:'POST',body:payload});closeModal();notify('Navigation saved to MySQL and published to the website.');await loadMenus(location);}
      catch(err){notify(err.message,'warn');btn.disabled=false;}
    });
  }

  document.addEventListener('click', async e=>{
    const b=e.target.closest('[data-spp-live]'); if(!b)return;
    const action=b.dataset.sppLive, id=Number(b.dataset.id);
    try {
      if(action==='cms-new'){cmsEditor(null,b.dataset.type||'Article');return;}
      if(action==='cms-edit'){cmsEditor(state.cms.find(x=>Number(x.id)===id));return;}
      if(action==='cms-delete'){if(!confirm('Delete this CMS record permanently?'))return;await api(`/api/admin/cms/content-blocks/${id}`,{method:'DELETE'});notify('CMS record deleted.');await loadCms();return;}
      if(action==='cms-refresh'){await loadCms();return;}
      if(action==='overview-refresh'){await loadDashboard();return;}
      if(action==='website-new-page'){cmsEditor(null,'Page');return;}
      if(action==='website-new-section'){cmsEditor(null,'Section');return;}
      if(action==='website-preview'){const slug=b.dataset.slug||state.pageSlug;const map={home:'/index.html',about:'/About.html',news:'/news.html',syfm:'/SYFM(2).html',team:'/executive-team.html',production:'/Production.html','our-story':'/OurStories.html',contact:'/HaveAStory.html'};window.open(map[slug]||`/cms-page.html?page=${encodeURIComponent(slug)}`,'_blank','noopener');return;}
      if(action==='website-refresh-preview'){const frame=$('#content iframe');if(frame)frame.src=frame.src;return;}
      if(action==='website-publish-section'){const slug=b.dataset.slug||state.pageSlug;if(!confirm(`Publish all eligible content blocks for “${slug}” now? Future scheduled items will remain scheduled.`))return;const result=await api('/api/admin/cms/content-blocks/publish-section',{method:'POST',body:{section:slug}});notify(`${Number(result.published)||0} content block(s) published.`);await loadCms();return;}
      if(action==='team-new'){teamEditor();return;}
      if(action==='team-edit'){teamEditor(state.team.find(x=>Number(x.id)===id));return;}
      if(action==='team-delete'){if(!confirm('Delete this team profile?'))return;await api(`/api/admin/team/${id}`,{method:'DELETE'});notify('Team profile deleted from the public Team API.');await loadTeam();return;}
      if(action==='team-refresh'){await loadTeam();return;}
      if(action==='menu-new'){menuEditor(null,b.dataset.location||'header');return;}
      if(action==='menu-restore'){await restoreRequestedHeaderMenu();return;}
      if(action==='menu-edit'){const loc=b.dataset.location||'header';const rows=loc==='syfm'?state.syfmMenus:state.headerMenus;menuEditor(rows.find(x=>Number(x.id)===id),loc);return;}
      if(action==='menu-delete'){if(!confirm('Remove this navigation item and its child links?'))return;const loc=b.dataset.location||'header';await api(`/api/admin/cms/menus/${id}`,{method:'DELETE'});notify('Navigation item removed.');await loadMenus(loc);return;}
      if(action==='menu-up'||action==='menu-down'){
        const loc=b.dataset.location||'header', rows=(loc==='syfm'?state.syfmMenus:state.headerMenus).filter(x=>!x.parent_id).sort((a,b)=>a.sort_order-b.sort_order);const ix=rows.findIndex(x=>Number(x.id)===id);const j=action==='menu-up'?ix-1:ix+1;if(ix<0||j<0||j>=rows.length)return;const a=rows[ix],z=rows[j];await Promise.all([api(`/api/admin/cms/menus/${a.id}`,{method:'PUT',body:{sortOrder:z.sort_order}}),api(`/api/admin/cms/menus/${z.id}`,{method:'PUT',body:{sortOrder:a.sort_order}})]);await loadMenus(loc);return;
      }
    } catch(err) { notify(err.message,'warn'); }
  });

  document.addEventListener('change',e=>{
    if(e.target.id==='sppBuilderPage'){state.pageSlug=e.target.value||'home';repaint('website');}
  });

  document.addEventListener('input',e=>{
    if(['sppCmsSearch','sppCmsType','sppCmsStatus'].includes(e.target.id)){
      const q=($('#sppCmsSearch')?.value||'').toLowerCase(),type=$('#sppCmsType')?.value,status=$('#sppCmsStatus')?.value;
      const rows=state.cms.filter(r=>(!q||`${r.title} ${r.section} ${r.content_type}`.toLowerCase().includes(q))&&(!type||r.content_type===type)&&(!status||uiStatus(r.status)===status));
      const body=$('#sppCmsRows');if(body)body.innerHTML=cmsRowsMarkup(rows);
    }
    if(['sppNewsSearch','sppNewsStatus'].includes(e.target.id)){
      const q=($('#sppNewsSearch')?.value||'').toLowerCase(),status=$('#sppNewsStatus')?.value;const rows=state.cms.filter(r=>String(r.section||'').toLowerCase()==='news'&&String(r.content_type||'').toLowerCase()==='article'&&(!q||String(r.title||'').toLowerCase().includes(q))&&(!status||uiStatus(r.status)===status));const body=$('#sppNewsRows');if(body)body.innerHTML=newsRowsMarkup(rows);
    }
    if(['sppTeamSearch','sppTeamGroup'].includes(e.target.id)){
      const q=($('#sppTeamSearch')?.value||'').toLowerCase(),group=$('#sppTeamGroup')?.value;
      const rows=state.team.filter(r=>(!q||`${r.name} ${r.role}`.toLowerCase().includes(q))&&(!group||r.group_key===group));
      const body=$('#sppTeamRows');if(body)body.innerHTML=teamRowsMarkup(rows);
    }
  });

  // The legacy media upload control is not used by these live workflows.
  // Show the connected workspace immediately on initial load instead of leaving the old prototype view visible.
  const initialPage=document.querySelector('.nav-item.active')?.dataset.page||'overview';
  if(typeof window.setPage==='function') window.setPage(initialPage);
})();
