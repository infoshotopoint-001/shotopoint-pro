/* Shoto Point public-site analytics + 10-second CMS sync helper.
   Include on public pages after the page's own renderer. */
(function(){
  const API='/api';
  function send(eventType,entityType,entityId,metadata){
    const body=JSON.stringify({eventType,entityType,entityId,path:location.pathname+location.search,metadata});
    if(navigator.sendBeacon){navigator.sendBeacon(API+'/public/event',new Blob([body],{type:'application/json'}));}
    else fetch(API+'/public/event',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  window.ShotoPointAnalytics={visit:(t,i,m)=>send('visit',t,i,m),read:(t,i,m)=>send('read',t,i,m),watch:(t,i,m)=>send('watch',t,i,m),download:(t,i,m)=>send('download',t,i,m),share:(t,i,m)=>send('share',t,i,m),like:(t,i,m)=>send('like',t,i,m),comment:(t,i,m)=>send('comment',t,i,m),play:(t,i,m)=>send('play',t,i,m)};
  send('visit','page',location.pathname);
  async function sync(){
    try{
      const [menus,content]=await Promise.all([fetch(API+'/public/cms/menus').then(r=>r.json()),fetch(API+'/public/cms/content').then(r=>r.json())]);
      window.ShotoPointCMS={menus:menus.data||[],content:content.data||[],syncedAt:new Date()};
      window.dispatchEvent(new CustomEvent('shoto:cms-update',{detail:window.ShotoPointCMS}));
    }catch(e){}
  }
  sync(); setInterval(sync,10000);
})();
