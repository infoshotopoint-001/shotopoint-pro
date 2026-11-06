(()=>{
'use strict';
const API='/api/public/cms';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(v,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
const slugFromPath=()=>{const p=location.pathname.split('/').pop()||'index.html';const raw=p.replace(/\.html?$/i,'');if(!raw||raw.toLowerCase()==='index')return 'home';return raw.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/[_\s]+/g,'-').toLowerCase()};
function cleanHTML(html){const doc=new DOMParser().parseFromString(`<div>${html||''}</div>`,'text/html');doc.querySelectorAll('script,style,object,embed,form,iframe,link,meta').forEach(n=>n.remove());doc.querySelectorAll('*').forEach(n=>{[...n.attributes].forEach(a=>{const k=a.name.toLowerCase(),v=a.value.trim();if(k.startsWith('on')||((k==='href'||k==='src')&&/^\s*javascript:/i.test(v)))n.removeAttribute(a.name);if(k==='href'||k==='src')n.setAttribute(a.name,safeUrl(v));});});return doc.body.firstElementChild?.innerHTML||'';}
function applyLinkTarget(a,item){a.target=item.target==='_blank'?'_blank':'_self';if(a.target==='_blank')a.rel='noopener noreferrer';}
function menuNode(item){const has=item.children?.length;const a=document.createElement('a');a.className='navlink';a.href=safeUrl(item.url||'#');a.textContent=item.name;applyLinkTarget(a,item);if(has){a.classList.add('spp-has-dropdown');const wrap=document.createElement('div');wrap.className='navitem';wrap.appendChild(a);const dd=document.createElement('div');dd.className='dropdown';const strong=document.createElement('strong');strong.textContent=item.name;dd.appendChild(strong);item.children.forEach(ch=>{const sub=document.createElement('a');sub.href=safeUrl(ch.url||'#');sub.textContent=ch.name;applyLinkTarget(sub,ch);dd.appendChild(sub)});wrap.appendChild(dd);a.addEventListener('click',e=>{if(matchMedia('(max-width:850px)').matches){e.preventDefault();wrap.classList.toggle('open')}});return wrap;}const wrap=document.createElement('div');wrap.className='navitem';wrap.appendChild(a);return wrap;}
function flattenMenus(items){const out=[];(items||[]).forEach(x=>{out.push(x);(x.children||[]).forEach(c=>out.push(c));});return out;}
async function fetchMenuTree(locationName){const r=await fetch(`${API}/menus?location=${encodeURIComponent(locationName)}`,{cache:'no-store'});if(!r.ok)return[];const d=await r.json();return d.success&&Array.isArray(d.data)?d.data:[];}
async function updateMenus(){
 const tree=await fetchMenuTree('header');
 if(tree.length){
  const hierarchical=document.querySelector('.mainnav .navlinks, nav[aria-label="Main navigation"] .navlinks');
  if(hierarchical){const frag=document.createDocumentFragment();tree.forEach(x=>frag.appendChild(menuNode(x)));hierarchical.replaceChildren(frag);}
 }
 const productionTree=await fetchMenuTree('production');
 const productionNav=document.querySelector('.spp-main-nav');
 if(productionNav&&productionTree.length){const frag=document.createDocumentFragment();productionTree.forEach(item=>{const a=document.createElement('a');a.href=safeUrl(item.url||'#');a.textContent=item.name;frag.appendChild(a);});productionNav.replaceChildren(frag);}
 const photographyTree=await fetchMenuTree('photography');
 const photographyNav=document.querySelector('.market-nav');
 if(photographyNav&&photographyTree.length){const frag=document.createDocumentFragment();photographyTree.forEach(item=>{const a=document.createElement('a');a.href=safeUrl(item.url||'#');a.textContent=item.name;frag.appendChild(a);});photographyNav.replaceChildren(frag);}
 const newsTree=await fetchMenuTree('news');
 const newsNav=document.querySelector('.primary-nav .shell, .nav .shell');
 if(newsNav&&newsTree.length){const frag=document.createDocumentFragment();newsTree.forEach(item=>{const a=document.createElement('a');a.href=safeUrl(item.url||'#');a.textContent=item.name;frag.appendChild(a);});newsNav.replaceChildren(frag);}
 const footerTree=await fetchMenuTree('footer');
 const footer=document.querySelector('footer.footer, footer.site-footer, footer');
 if(footer&&footerTree.length){
  let footerNav=footer.querySelector('[data-spp-footer-menu]');
  if(!footerNav){footerNav=document.createElement('nav');footerNav.className='spp-cms-footer-nav';footerNav.dataset.sppFooterMenu='true';footerNav.setAttribute('aria-label','Footer navigation');footer.appendChild(footerNav);}
  const frag=document.createDocumentFragment();footerTree.forEach(item=>{const a=document.createElement('a');a.href=safeUrl(item.url||'#');a.textContent=item.name;a.target=item.target==='_blank'?'_blank':'_self';if(a.target==='_blank')a.rel='noopener noreferrer';frag.appendChild(a);});footerNav.replaceChildren(frag);
 }
}
function blockSettings(x){try{return typeof x.settings_json==='string'?JSON.parse(x.settings_json||'{}'):(x.settings_json||{})}catch{return {}}}
function applyMediaSettings(node,settings){
 const widths=new Set(['100%','80%','60%','40%']);const fits=new Set(['cover','contain','fill']);const shapes=new Set(['rounded','circle','pill','square','diamond','blob']);
 if(widths.has(settings.mediaWidth))node.style.width=settings.mediaWidth;
 if(fits.has(settings.objectFit))node.style.objectFit=settings.objectFit;
 if(typeof settings.radius==='string'&&/^(?:0|[0-9]{1,2}px|[0-9]{1,2}(?:\.[0-9]+)?rem)$/.test(settings.radius))node.style.borderRadius=settings.radius;
 if(shapes.has(settings.mediaShape))node.classList.add('spp-media-'+settings.mediaShape);
 node.style.maxWidth='100%';node.style.height='auto';
}
function renderBlock(x){
 const settings=blockSettings(x);const s=document.createElement('section');
 s.className=`spp-cms-block spp-cms-${String(x.content_type||'content').replace(/[^a-z0-9_-]/gi,'')}`;
 if(x.title){const h=document.createElement('h2');h.textContent=x.title;s.appendChild(h)}
 if(x.body){const body=document.createElement('div');body.className='spp-cms-body';body.innerHTML=cleanHTML(x.body);s.appendChild(body)}
 if(x.media_url){const u=safeUrl(x.media_url);let node;
  if(String(x.content_type).includes('video')){node=document.createElement('video');node.src=u;node.controls=true;node.playsInline=true;node.preload='metadata'}
  else if(String(x.content_type).includes('audio')){node=document.createElement('audio');node.src=u;node.controls=true}
  else if(String(x.content_type).includes('download')){node=document.createElement('a');node.href=u;node.textContent=x.title||'Download file';node.download='';}
  else{node=document.createElement('img');node.src=u;node.alt=x.title||'';node.loading='lazy'}
  applyMediaSettings(node,settings);s.appendChild(node);
 }
 if(x.link_url){const a=document.createElement('a');a.href=safeUrl(x.link_url);a.textContent=settings.linkLabel||'Learn more';a.rel='noopener';s.appendChild(a)}
 return s;
}
let lastContent='';let lastPageSettings='';
async function updatePageSettings(section){
 const r=await fetch(`/api/public/page/${encodeURIComponent(section)}`,{cache:'no-store'});if(!r.ok)return;const d=await r.json();const settings=d.data?.settings;if(!settings)return;
 const stamp=JSON.stringify([settings.font_family,settings.font_size,settings.accent,settings.green_theme]);if(stamp===lastPageSettings)return;lastPageSettings=stamp;
 const root=document.documentElement;const font=String(settings.font_family||'').trim();const size=String(settings.font_size||'').trim();const accent=String(settings.accent||'').trim();
 const allowedFonts=new Set(['DM Sans','Playfair Display','Georgia','Inter','Montserrat','Poppins','Libre Baskerville','Source Sans 3','Times New Roman']);
 if(allowedFonts.has(font))root.style.setProperty('--spp-cms-font-family',`'${font.replace(/'/g,'')}', sans-serif`);
 if(/^\d{1,2}(?:px|rem|em)$/.test(size))root.style.setProperty('--spp-cms-font-size',size);
 if(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(accent)){root.style.setProperty('--spp-cms-accent',accent);root.style.setProperty('--gold',accent);root.style.setProperty('--gold2',accent);}
 document.body.classList.toggle('spp-cms-legacy-green',Boolean(Number(settings.green_theme)));
}
async function updateContent(){
 const section=slugFromPath();
 const r=await fetch(`${API}/content?section=${encodeURIComponent(section)}&limit=100`,{cache:'no-store'});
 if(!r.ok)return;
 const d=await r.json();
 const rows=d.data||[];
 const settingsById=new Map(rows.map(x=>[String(x.id),blockSettings(x)]));
 const stamp=JSON.stringify(rows.map(x=>[x.id,x.updated_at,x.status,x.body,x.media_url,x.link_url,x.title,x.settings_json]));
 if(stamp===lastContent)return;
 lastContent=stamp;
 let host=document.querySelector('[data-spp-cms-content]');
 if(!host){
  host=document.createElement('div');host.className='spp-cms-published';host.dataset.sppCmsContent='true';
  const main=document.querySelector('main')||document.querySelector('.shell')||document.body;
  const hero=main.querySelector('.page-hero,.hero,header.hero');
  if(hero&&hero.parentNode===main)hero.insertAdjacentElement('afterend',host);else main.appendChild(host);
 }
 const defaultRows=rows.filter(x=>!settingsById.get(String(x.id))?.targetSelector);
 host.replaceChildren(...defaultRows.map(renderBlock));
 const targeted=new Map();
 rows.forEach(x=>{
  const sel=settingsById.get(String(x.id))?.targetSelector;
  if(!sel)return;
  // Prevent a CMS block from replacing site-wide structural elements.
  if(/^(html|body|head|header|nav|main|footer)$/i.test(String(sel).trim()))return;
  let target=null;try{target=document.querySelector(sel)}catch{}
  if(!target||target===document.documentElement||target===document.body||target.closest('nav,header,footer'))return;
  if(!targeted.has(target))targeted.set(target,[]);
  targeted.get(target).push(x);
 });
 targeted.forEach((items,target)=>target.replaceChildren(...items.map(renderBlock)));
}
function track(){fetch('/api/public/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType:'visit',entityType:'page',entityId:slugFromPath(),path:location.pathname})}).catch(()=>{});}
async function sync(){try{const section=slugFromPath();await Promise.all([updateMenus(),updatePageSettings(section),updateContent()])}catch(e){/* keep the original page usable when CMS is offline */}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();track()});else{sync();track()}
setInterval(sync,15000);
})();
