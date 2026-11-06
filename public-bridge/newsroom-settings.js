/* Add this script to the public Newsroom if you want live browser-side settings.
   It does not replace the existing RSS logic; it supplies the Admin Control Centre settings. */
(async()=>{
 try{
  const r=await fetch("/api/public/newsroom-config",{cache:"no-store"});
  const j=await r.json(); if(!j.success)return;
  window.SHOTO_NEWSROOM_CONFIG=j.data;
  document.documentElement.dataset.newsfeedEnabled=j.data.settings?.enabled?"true":"false";
  document.documentElement.dataset.newsfeedLayout=j.data.settings?.layout||"hybrid";
  window.dispatchEvent(new CustomEvent("shoto:newsfeed-settings",{detail:j.data}));
 }catch(e){console.warn("Shoto Point Newsroom settings unavailable.",e)}
})();
