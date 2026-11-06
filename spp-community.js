(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cfg = window.SPP_COMMUNITY_CONFIG || {};
  const configured = Boolean(cfg.demoMode === false && cfg.supabaseUrl && cfg.supabaseAnonKey && !String(cfg.supabaseUrl).includes('YOUR_') && !String(cfg.supabaseAnonKey).includes('YOUR_'));
  let db = null, session = null, profile = null, activeFilter = 'all', posts = [], activePost = null, activeChatUser = null, authMode = 'signin', commentsChannel = null, messagesChannel = null;

  const samples = [
    {id:'sample-1',category:'movie-story',title:'The Last Light of Lagos',summary:'A young cinematographer discovers an old reel that connects three generations of a Lagos family. A sample movie concept submitted to demonstrate the SPP pitch format.',genre:'Drama · Mystery',creator_name:'SPP Showcase Preview',created_at:'2026-10-18T10:00:00Z',symbol:'🎬',status:'sample',author_id:null},
    {id:'sample-2',category:'novel',title:'Letters from the River',summary:'A sample literary concept about memory, home and the choices that shape a family across distant places.',genre:'Literary fiction',creator_name:'SPP Showcase Preview',created_at:'2026-10-15T10:00:00Z',symbol:'📖',status:'sample',author_id:null},
    {id:'sample-3',category:'song',title:'Midnight Promise',summary:'A demonstration music listing showing how independent artists can introduce an original track and share an authorised audio link.',genre:'Afro-fusion',creator_name:'SPP Showcase Preview',created_at:'2026-10-12T10:00:00Z',symbol:'♫',status:'sample',author_id:null},
    {id:'sample-4',category:'live-pitch',title:'One City, Many Dreams',summary:'A sample live pitch for a short film anthology following young people building creative careers in a changing city.',genre:'Anthology · Short film',creator_name:'SPP Showcase Preview',created_at:'2026-10-10T10:00:00Z',symbol:'🎥',status:'sample',author_id:null},
    {id:'sample-5',category:'music-video',title:'Colours of Home',summary:'A sample music-video showcase entry for an original visual treatment celebrating place, rhythm and identity.',genre:'Music video',creator_name:'SPP Showcase Preview',created_at:'2026-10-08T10:00:00Z',symbol:'▶',status:'sample',author_id:null},
    {id:'sample-6',category:'tutorial',title:'Your First Short Film',summary:'A sample tutorial listing introducing story structure, shot planning and the basics of preparing a small film production.',genre:'Filmmaking · Beginner',creator_name:'SPP Showcase Preview',created_at:'2026-10-05T10:00:00Z',symbol:'🎓',status:'sample',author_id:null}
  ];
  const categoryNames = {'movie-story':'Movie story','live-pitch':'Live movie pitch','novel':'Novel','novel-video':'Novel video','song':'Song / MP3','music-video':'Music video','tutorial':'Tutorial'};
  const symbols = {'movie-story':'🎬','live-pitch':'🎥','novel':'📖','novel-video':'📚','song':'♫','music-video':'▶','tutorial':'🎓'};
  const escapeHtml = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHref = (v) => { try { const u = new URL(String(v), location.origin); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const dateText = (v) => { const d = new Date(v); return isNaN(d) ? 'Date unavailable' : d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); };
  const notify = (message) => { const t=$('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3400); };
  const openModal = (id) => { $(id).hidden=false; document.body.style.overflow='hidden'; };
  const closeModal = (id) => { $(id).hidden=true; if(!document.querySelector('.modal-backdrop:not([hidden])')) document.body.style.overflow=''; };
  const isConfigured = () => configured && db;
  const requireLogin = (message='Please sign in or create an SPP community account first.') => { if(!session){notify(message);setAuthTab('signin');openModal('authModal');return false;} return true; };

  function setAuthTab(mode){authMode=mode;document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===mode));$('nameField').hidden=mode!=='signup';$('authName').required=mode==='signup';$('authPassword').autocomplete=mode==='signup'?'new-password':'current-password';$('authSubmit').textContent=mode==='signup'?'Create account':'Sign in';$('authMessage').textContent='';}
  function authButtons(){const label=session?(profile?.display_name||session.user.email):'Sign in / Join';$('authOpenTop').textContent=label;}
  function renderGrid(){
    const q=$('searchInput').value.trim().toLowerCase();const order=$('sortSelect').value;
    let list=posts.filter(p=>(activeFilter==='all'||p.category===activeFilter)&&(!q||[p.title,p.summary,p.genre,p.creator_name].join(' ').toLowerCase().includes(q)));
    list.sort((a,b)=>order==='oldest'?new Date(a.created_at)-new Date(b.created_at):new Date(b.created_at)-new Date(a.created_at));
    $('showcaseGrid').innerHTML=list.length?list.map(p=>{
      const isSample=p.status==='sample';const initials=(p.creator_name||'SP').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
      return `<article class="story-card"><div class="card-art" ${p.cover_url?`style="background-image:linear-gradient(0deg,#050505aa,transparent 70%),url('${escapeHtml(p.cover_url)}');background-size:cover;background-position:center"`:''}>${p.cover_url?'':`<span class="art-symbol">${escapeHtml(p.symbol||symbols[p.category]||'✦')}</span>`}<span class="art-label">${escapeHtml(categoryNames[p.category]||'SPP CREATOR')}</span>${isSample?'<span class="sample-tag">SAMPLE PREVIEW</span>':''}</div><div class="card-content"><div class="card-meta"><span>${escapeHtml(categoryNames[p.category]||'Creator story')}</span><span>${escapeHtml(dateText(p.created_at))}</span></div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.summary||'Community creative submission.')}</p><div class="creator-line"><div class="creator-info"><span class="avatar">${escapeHtml(initials)}</span><span><b>${escapeHtml(p.creator_name||'SPP Creator')}</b><small>${isSample?'Demonstration entry':'SPP community creator'}</small></span></div></div><div class="card-actions"><button class="view-button" data-view="${escapeHtml(p.id)}">View story</button>${p.contact_preference!=='messages'?`<button data-comment="${escapeHtml(p.id)}">Comments</button>`:''}<button data-share="${escapeHtml(p.id)}">Share ↗</button></div>${!isSample&&p.author_id&&['messages','both'].includes(p.contact_preference)?`<div class="card-actions"><button data-message="${escapeHtml(p.author_id)}" data-name="${escapeHtml(p.creator_name||'Creator')}">Message creator</button></div>`:''}</div></article>`;
    }).join(''):'<div class="empty-state">No published submissions match this filter yet. Try another category or check back as new creator work is approved.</div>';
  }

  async function fetchPosts(){
    if(!isConfigured()){posts=samples;$('demoNotice').hidden=false;renderGrid();return;}
    try{
      const {data,error}=await db.from('community_posts').select('id,category,title,summary,story_text,genre,creator_credit,creator_id,created_at,external_url,youtube_url,storage_path,cover_path,media_type,contact_preference,creator:profiles!community_posts_creator_id_fkey(display_name)').eq('status','published').order('created_at',{ascending:false}).limit(60);
      if(error)throw error;
      const rows=data||[];
      const coverPaths=rows.filter(p=>p.cover_path).map(p=>p.cover_path);
      let signedByPath={};
      if(coverPaths.length){const {data:signed}=await db.storage.from('spp-community-media').createSignedUrls(coverPaths,900);(signed||[]).forEach(item=>{if(item.path&&item.signedUrl)signedByPath[item.path]=item.signedUrl;});}
      posts=rows.map(p=>({id:p.id,category:p.category,title:p.title,summary:p.summary,story_text:p.story_text,genre:p.genre,creator_credit:p.creator_credit,contact_preference:p.contact_preference||'comments',created_at:p.created_at,author_id:p.creator_id,creator_name:p.creator?.display_name||'SPP Creator',external_url:p.external_url,youtube_url:p.youtube_url,storage_path:p.storage_path,cover_path:p.cover_path,cover_url:signedByPath[p.cover_path]||null,media_type:p.media_type,symbol:symbols[p.category]}));
      $('demoNotice').hidden=true;renderGrid();
    }catch(err){console.error(err);posts=samples;$('demoNotice').hidden=false;$('demoNotice').innerHTML='<strong>Community connection needs attention:</strong> the database could not be reached. Showing sample preview cards. Check the Supabase setup and browser console.';renderGrid();}
  }

  async function refreshProfile(){
    if(!session){profile=null;authButtons();return;}
    const {data,error}=await db.from('profiles').select('id,display_name,role,is_approved').eq('id',session.user.id).single();
    if(error){console.error(error);profile=null;}else profile=data;
    authButtons();
  }

  async function handleAuth(e){e.preventDefault();$('authMessage').textContent='Working…';if(!isConfigured()){$('authMessage').textContent='Community accounts are not connected yet. Configure Supabase in spp-community-config.js first.';return;}
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    try{
      if(authMode==='signup'){
        const displayName=$('authName').value.trim();const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:displayName}}});if(error)throw error;
        $('authMessage').textContent=data.session?'Account created. Complete your profile and wait for SPP approval.':'Account created. Check your email to confirm your address, then sign in.';
      }else{
        const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;await refreshProfile();closeModal('authModal');notify(profile?.is_approved?'Welcome back.':'You are signed in. Your creator approval is still pending.');
      }
    }catch(err){$('authMessage').textContent=err.message||'Authentication failed.';}
  }

  async function handleSubmission(e){e.preventDefault();if(!requireLogin())return;if(!isConfigured()){notify('Connect the SPP community database before accepting submissions.');return;}if(!profile?.is_approved && profile?.role!=='admin'){notify('Your account is registered but still awaiting SPP creator approval.');return;}
    const file=$('postFile').files[0],cover=$('postCover').files[0];if(cover&&cover.size>5*1024*1024){$('submissionMessage').textContent='Cover artwork must be 5 MB or smaller.';return;}if(file&&file.size>25*1024*1024){$('submissionMessage').textContent='This prototype accepts files up to 25 MB. For larger videos, configure resumable media uploads or provide an authorised hosted link.';return;}
    $('submitWorkButton').disabled=true;$('submissionMessage').textContent='Sending your work for review…';
    let uploadedPath=null;
    try{
      const payload={creator_id:session.user.id,category:$('postCategory').value,title:$('postTitle').value.trim(),summary:$('postSummary').value.trim(),genre:$('postGenre').value.trim()||null,creator_credit:$('postCredit').value.trim()||null,external_url:$('postLink').value.trim()||null,story_text:$('postStoryText').value.trim()||null,contact_preference:$('postContact').value,status:'pending'};
      const {data:post,error}=await db.from('community_posts').insert(payload).select('id').single();if(error)throw error;
      const updates={};
      if(cover){const safeCover=cover.name.replace(/[^a-zA-Z0-9._-]/g,'_');const coverPath=`${session.user.id}/${post.id}/cover-${Date.now()}-${safeCover}`;const {error:coverErr}=await db.storage.from('spp-community-media').upload(coverPath,cover,{upsert:false,contentType:cover.type});if(coverErr)throw coverErr;updates.cover_path=coverPath;}
      if(file){const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');uploadedPath=`${session.user.id}/${post.id}/${Date.now()}-${safeName}`;const {error:upErr}=await db.storage.from('spp-community-media').upload(uploadedPath,file,{upsert:false,contentType:file.type});if(upErr)throw upErr;updates.storage_path=uploadedPath;updates.media_type=file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':file.type==='application/pdf'?'document':'image';}
      if(Object.keys(updates).length){const {error:updateErr}=await db.from('community_posts').update(updates).eq('id',post.id);if(updateErr)throw updateErr;}
      $('submissionMessage').textContent='Submission received. It is now in the SPP review queue and will appear publicly after approval.';$('submissionForm').reset();notify('Your work has been submitted for SPP review.');setTimeout(()=>closeModal('submitModal'),1800);
    }catch(err){console.error(err);$('submissionMessage').textContent=err.message||'Submission failed. Please try again.';}
    finally{$('submitWorkButton').disabled=false;}
  }

  async function sharePost(id){const p=posts.find(x=>x.id===id);if(!p)return;const url=new URL(location.href);url.hash='showcase';url.searchParams.set('post',id);try{if(navigator.share)await navigator.share({title:p.title,text:p.summary,url:url.toString()});else{await navigator.clipboard.writeText(url.toString());notify('Showcase link copied.');}}catch(e){if(e.name!=='AbortError')notify('Could not share this item on this device.');}}

  async function viewPost(id){activePost=posts.find(x=>x.id===id);if(!activePost)return;
    const p=activePost;let media='';if(p.external_url||p.youtube_url){const link=safeHref(p.youtube_url||p.external_url);if(link)media=`<p><a class="gold-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open creator media ↗</a></p>`;}
    if(p.storage_path&&isConfigured()){const {data}=await db.storage.from('spp-community-media').createSignedUrl(p.storage_path,900);if(data?.signedUrl){if((p.media_type||'').startsWith('image/'))media=`<img class="detail-media" src="${escapeHtml(data.signedUrl)}" alt="${escapeHtml(p.title)}">`;else if((p.media_type||'').startsWith('video/'))media=`<video class="detail-media" controls src="${escapeHtml(data.signedUrl)}"></video>`;else if((p.media_type||'').startsWith('audio/'))media=`<audio controls src="${escapeHtml(data.signedUrl)}"></audio>`;else media=`<p><a class="gold-link" href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noopener">View attached document ↗</a></p>`;}}
    $('postDetail').innerHTML=`<div class="eyebrow">${escapeHtml(categoryNames[p.category]||'SPP COMMUNITY')}</div><div class="detail-head"><div class="detail-art">${escapeHtml(p.symbol||symbols[p.category]||'✦')}</div><div class="detail-copy"><h2 id="postModalTitle">${escapeHtml(p.title)}</h2><div class="card-meta">${escapeHtml(p.creator_name||'SPP Creator')} · ${escapeHtml(dateText(p.created_at))}</div><p>${escapeHtml(p.summary||'')}</p>${p.genre?`<p><strong>Genre / topic:</strong> ${escapeHtml(p.genre)}</p>`:''}${p.creator_credit?`<p><strong>Creator credit:</strong> ${escapeHtml(p.creator_credit)}</p>`:''}${p.cover_url?`<img class="detail-media" src="${escapeHtml(p.cover_url)}" alt="${escapeHtml(p.title)} cover">`:''}${p.story_text?`<div class="story-text">${escapeHtml(p.story_text)}</div>`:''}${media}</div></div><div class="detail-actions"><button class="outline-button" id="detailShare" type="button">Share ↗</button>${p.author_id&&session&&p.author_id!==session.user.id&&['messages','both'].includes(p.contact_preference)?`<button class="gold-button" id="detailMessage" type="button">Message creator</button>`:''}</div>`;
    $('detailShare').addEventListener('click',()=>sharePost(p.id));if($('detailMessage'))$('detailMessage').addEventListener('click',()=>openChat(p.author_id,p.creator_name));
    $('commentForm').hidden=p.contact_preference==='messages';$('commentsList').hidden=p.contact_preference==='messages';$('postModal').querySelector('.comments-area h3').textContent=p.contact_preference==='messages'?'Comments are disabled for this showcase':'Community comments';if(p.contact_preference==='messages')$('commentsList').innerHTML='<div class="empty-state">The creator prefers private messages for this showcase.</div>';else await loadComments(p.id);openModal('postModal');
  }

  async function loadComments(postId){const list=$('commentsList');if(!isConfigured()){list.innerHTML='<div class="empty-state">Comments will be enabled when the community database is connected.</div>';return;}const {data,error}=await db.from('community_comments').select('id,body,created_at,user:profiles!community_comments_user_id_fkey(display_name)').eq('post_id',postId).order('created_at',{ascending:true}).limit(100);if(error){list.innerHTML='<div class="empty-state">Comments could not be loaded.</div>';return;}list.innerHTML=(data||[]).map(c=>`<div class="comment-item"><b>${escapeHtml(c.user?.display_name||'Community member')} · ${escapeHtml(dateText(c.created_at))}</b><p>${escapeHtml(c.body)}</p></div>`).join('')||'<div class="empty-state">No comments yet. Start a respectful conversation.</div>';}
  async function handleComment(e){e.preventDefault();if(!requireLogin())return;if(!isConfigured()||!activePost||String(activePost.id).startsWith('sample-')){$('commentMessage').textContent='Comments are available on published community posts after the database is connected.';return;}const body=$('commentInput').value.trim();if(!body)return;const {error}=await db.from('community_comments').insert({post_id:activePost.id,user_id:session.user.id,body});if(error){$('commentMessage').textContent=error.message;return;}$('commentInput').value='';$('commentMessage').textContent='Comment posted.';await loadComments(activePost.id);}

  async function openChat(recipientId,recipientName){if(!requireLogin())return;if(!isConfigured()){notify('Private messages need the SPP community database.');return;}if(recipientId===session.user.id){notify('This is your own creator profile.');return;}activeChatUser={id:recipientId,name:recipientName||'Creator'};$('chatTitle').textContent=`Chat with ${activeChatUser.name}`;openModal('chatModal');await loadMessages();}
  async function loadMessages(){if(!activeChatUser||!isConfigured())return;const uid=session.user.id,rid=activeChatUser.id;const {data,error}=await db.from('community_messages').select('id,sender_id,recipient_id,body,created_at').or(`and(sender_id.eq.${uid},recipient_id.eq.${rid}),and(sender_id.eq.${rid},recipient_id.eq.${uid})`).order('created_at',{ascending:true}).limit(150);if(error){$('chatMessages').innerHTML='<div class="empty-state">Messages could not be loaded.</div>';return;}$('chatMessages').innerHTML=(data||[]).map(m=>`<div class="message-bubble ${m.sender_id===uid?'mine':''}">${escapeHtml(m.body)}<small>${escapeHtml(new Date(m.created_at).toLocaleString())}</small></div>`).join('')||'<div class="empty-state">Start the conversation with a respectful introduction.</div>';const box=$('chatMessages');box.scrollTop=box.scrollHeight;}
  async function handleMessage(e){e.preventDefault();if(!requireLogin())return;if(!activeChatUser||!isConfigured())return;const body=$('chatInput').value.trim();if(!body)return;const {error}=await db.from('community_messages').insert({sender_id:session.user.id,recipient_id:activeChatUser.id,body});if(error){$('chatMessage').textContent=error.message;return;}$('chatInput').value='';$('chatMessage').textContent='Message sent.';await loadMessages();}

  function showAdminNotice(){if(profile?.role==='admin'){$('demoNotice').hidden=false;$('demoNotice').innerHTML='<strong>Administrator:</strong> review submissions in the <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">Supabase dashboard</a> under Table Editor → community_posts. Change status from pending to published or rejected.';}}

  function bindUI(){
    $('mobileToggle').addEventListener('click',()=>{const open=$('navlinks').classList.toggle('mobile-open');$('mobileToggle').setAttribute('aria-expanded',String(open));});
    ['authOpenTop','joinOpenBottom'].forEach(id=>$(id).addEventListener('click',()=>{setAuthTab('signin');openModal('authModal');}));
    ['submitOpenTop','submitOpenHero','submitOpenSection'].forEach(id=>$(id).addEventListener('click',()=>{if(requireLogin()){if(!isConfigured())notify('Connect the SPP database before accepting submissions.');else if(!profile?.is_approved&&profile?.role!=='admin')notify('Your account is awaiting creator approval.');else openModal('submitModal');}}));
    $('messagesOpen').addEventListener('click',()=>{if(requireLogin())openModal('chatModal');});
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
    document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id);}));
    document.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>setAuthTab(b.dataset.authTab)));
    $('authForm').addEventListener('submit',handleAuth);$('submissionForm').addEventListener('submit',handleSubmission);$('commentForm').addEventListener('submit',handleComment);$('chatForm').addEventListener('submit',handleMessage);
    document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderGrid();}));
    $('searchInput').addEventListener('input',renderGrid);$('sortSelect').addEventListener('change',renderGrid);
    $('showcaseGrid').addEventListener('click',e=>{const view=e.target.closest('[data-view]'),comment=e.target.closest('[data-comment]'),share=e.target.closest('[data-share]'),msg=e.target.closest('[data-message]');if(view||comment)viewPost((view||comment).dataset.view||(view||comment).dataset.comment);if(share)sharePost(share.dataset.share);if(msg)openChat(msg.dataset.message,msg.dataset.name);});
    $('year').textContent=new Date().getFullYear();
  }

  async function init(){bindUI();setAuthTab('signin');if(!configured||!window.supabase?.createClient){posts=samples;$('demoNotice').hidden=false;renderGrid();authButtons();return;}
    db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);const {data}=await db.auth.getSession();session=data.session;await refreshProfile();await fetchPosts();showAdminNotice();
    db.auth.onAuthStateChange(async(_event,newSession)=>{session=newSession;await refreshProfile();if(session)notify('Signed in to the SPP creator community.');else notify('You have signed out.');});
    db.channel('spp-community-feed').on('postgres_changes',{event:'*',schema:'public',table:'community_posts'},()=>fetchPosts()).subscribe();
    db.channel('spp-community-comments').on('postgres_changes',{event:'INSERT',schema:'public',table:'community_comments'},()=>{if(activePost)loadComments(activePost.id);}).subscribe();
    db.channel('spp-community-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'community_messages'},()=>{if(activeChatUser)loadMessages();}).subscribe();
    const sharedPostId=new URLSearchParams(location.search).get('post');if(sharedPostId&&posts.some(p=>p.id===sharedPostId))viewPost(sharedPostId);
  }
  init();
})();
