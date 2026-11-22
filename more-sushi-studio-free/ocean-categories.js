/* Five new categories, UI-only: no data is deleted or modified. */
(()=>{"use strict";const keys=new Set(["home","ttk","catalog","pdf","more"]);if(!document.getElementById("mssCategoryApp"))return;
function show(tab,save=true){if(!keys.has(tab))tab="home";
document.querySelectorAll("[data-mss-panel]").forEach(el=>{el.hidden=el.dataset.mssPanel!==tab});
document.querySelectorAll("[data-mss-tab]").forEach(el=>{const active=el.dataset.mssTab===tab;el.classList.toggle("active",active);el.setAttribute("aria-current",active?"page":"false")});
const hero=document.querySelector(".wrap > .hero"),metrics=document.querySelector(".wrap > .metrics"),tray=document.querySelector(".wrap > .tray");
if(hero)hero.hidden=tab!=="home";if(metrics)metrics.hidden=tab!=="home";if(tray)tray.hidden=tab!=="home";
const notice=document.getElementById("mssFutureMessage");if(notice)notice.hidden=true;
if(save){const next=new URL(location.href);next.hash=tab==="home"?"":tab;history.replaceState(null,"",next)}
scrollTo(0,0);
}
document.addEventListener("click",ev=>{const target=ev.target.closest("[data-mss-tab],[data-mss-future]");if(!target)return;
if(target.dataset.mssTab){show(target.dataset.mssTab);return}
const note=document.getElementById("mssFutureMessage"),name=document.getElementById("mssFutureName");if(note&&name){name.textContent=target.dataset.mssFuture;note.hidden=false;note.scrollIntoView({behavior:"smooth",block:"nearest"})}
});
const close=document.getElementById("mssFutureClose");if(close)close.addEventListener("click",()=>document.getElementById("mssFutureMessage").hidden=true);
addEventListener("hashchange",()=>show(location.hash.slice(1)||"home",false));show(location.hash.slice(1)||"home",false);
})();