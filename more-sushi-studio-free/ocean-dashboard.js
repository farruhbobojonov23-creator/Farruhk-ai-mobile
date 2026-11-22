/* MORE SUSHI STUDIO PRO — read-only counters and update awareness.
   Do not invent zero values; only display counts verified by authenticated Supabase.
   Neither the database nor the native APK is modified. */
(function(){
"use strict";
const SB="https://mhsmmssipligbmvfzkce.supabase.co";
const KEY="sb_publishable_JKA5HzoGDIkLxBnctT27hw_TBIqnoc0";
const BUILD=document.querySelector('meta[name="mss-ui-build"]')?.content||"unknown";
const cloudName=document.getElementById("cloudName");
const cloudDesc=document.getElementById("cloudDesc");
const cloudDot=document.getElementById("syncDot");
const counters=["countTtk","countProjects","countDrafts"];
let loading=false,lastCheck=0;

function setCloud(title,description,connected){
 if(cloudName)cloudName.textContent=title;
 if(cloudDesc)cloudDesc.textContent=description;
 const badge=document.getElementById("countCloud");
 if(badge)badge.textContent=connected?"✓":"—";
 if(cloudDot){cloudDot.style.background=connected?"#2ed6a0":"#e6ab42";
 cloudDot.style.boxShadow=connected?"0 0 10px #0da576":"0 0 9px #d69b3b";
 cloudDot.style.animation=connected?"beacon 5s ease-in-out infinite":"none";}
}
function clearCounters(){counters.forEach(id=>{const el=document.getElementById(id);if(el)el.textContent="—";});}
function getSession(){try{return JSON.parse(localStorage.getItem("ms_session")||"null")}catch{return null}}
async function refreshSession(session){
 if(!session.refresh_token)throw Error("Refresh token unavailable");
 const r=await fetch(SB+"/auth/v1/token?grant_type=refresh_token",{
  method:"POST",headers:{"apikey":KEY,"Content-Type":"application/json"},
  body:JSON.stringify({refresh_token:session.refresh_token}),cache:"no-store"
 });
 if(!r.ok)throw Error("Refresh session failed ("+r.status+")");
 const next=await r.json();
 if(!next.access_token)throw Error("Missing refreshed session");
 next.expires_at=next.expires_at||Math.floor(Date.now()/1000)+Number(next.expires_in||3600);
 localStorage.setItem("ms_session",JSON.stringify(next));
 return next;
}
async function countRows(table,token,filter){
 const url=new URL(SB+"/rest/v1/"+table);
 url.searchParams.set("select","id");
 if(filter)url.searchParams.set(filter[0],filter[1]);
 const res=await fetch(url,{method:"HEAD",cache:"no-store",
  headers:{"apikey":KEY,"Authorization":"Bearer "+token,"Prefer":"count=exact"}});
 if(!res.ok)throw Error(table+" HTTP "+res.status);
 const range=res.headers.get("Content-Range")||"";
 const match=range.match(/\/(\d+)$/);
 if(!match)throw Error("Total count unavailable for "+table);
 return Number(match[1]);
}
async function updateCounts(){
 if(loading||Date.now()-lastCheck<12000)return;
 loading=true;lastCheck=Date.now();clearCounters();
 let session=getSession();
 try{
  if(!session?.access_token||!session?.refresh_token){
   setCloud("Облако MORE SUSHI · требуется вход","Войди в студию, чтобы увидеть свои данные",false);return;
  }
  const expired=Number(session.expires_at||0)<Math.floor(Date.now()/1000)+90;
  if(expired)session=await refreshSession(session);
  setCloud("Проверяем облако MORE SUSHI…","Загрузка актуальных данных",false);
  const stats=await Promise.all([
   countRows("ttk_documents",session.access_token),
   countRows("ttk_projects",session.access_token),
   countRows("ttk_documents",session.access_token,["status","eq.Черновик"])
  ]);
  stats.forEach((value,index)=>{const el=document.getElementById(counters[index]);
   if(el)el.textContent=Number.isFinite(value)?String(value):"—";});
  setCloud("Облако MORE SUSHI подключено","Синхронизация активна · показатели проверены",true);
 }catch(e){
  clearCounters();setCloud("Облако · данные пока недоступны",
   "Вход сохранён · проверь интернет или открой студию",false);
 }finally{loading=false}
}
let versionCheckRunning=false;
async function detectLatestVersion(){
 if(versionCheckRunning)return;
 versionCheckRunning=true;
 try{
  const url="./ocean-ui-version.json?_="+Date.now();
  const r=await fetch(url,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
  if(!r.ok)return;
  const data=await r.json();
  if(typeof data?.build!=="string" || data.build===BUILD)return;
  const btn=document.querySelector(".cloudbar [data-ocean-refresh]");
  if(btn){
   btn.classList.add("update-available");
   btn.title="Доступен обновлённый интерфейс — нажми, чтобы загрузить";
   const label=btn.querySelector("span:last-child");
   if(label)label.textContent="Новое!";
  }
  // The mobile home has no editable form: safely self-update the old
  // WebView page once per target build so splash/theme JS are actually loaded.
  // An attempt marker prevents loops if a cache serves the old HTML again.
  try{
   const key="mss-auto-ui-target-v1";
   if(sessionStorage.getItem(key)!==data.build){
    setTimeout(()=>{
     if(document.visibilityState!=="visible")return;
     // Never auto-navigate out of TTK editor or a standalone Revision page.
     if(!document.getElementById("mssCategoryApp"))return;
     try{
      if(sessionStorage.getItem(key)===data.build)return;
      sessionStorage.setItem(key,data.build);
     }catch{ /* still attempt once even with storage disabled */ }
     const destination=new URL(location.href);
     destination.searchParams.set("_fresh",Date.now().toString());
     location.replace(destination.href);
    },900);
   }
  }catch(e){} // private mode/storage disabled: keep manual «Новое!» button
 }catch(e){}finally{versionCheckRunning=false}
}
function check(){updateCounts();detectLatestVersion()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",check,{once:true});
else check();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check()});
window.addEventListener("online",check);
window.MoreSushiRefreshStats=check;
})();