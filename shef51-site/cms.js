(()=>{
const API='https://farruhk-ai-mobile.onrender.com';
const byHref=(s)=>[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===s);
const txt=(el,v)=>{if(el&&typeof v==='string'&&v.length)el.textContent=v};
const setMeta=(name,content)=>{let m=document.querySelector('meta[name="'+name+'"]');if(!m){m=document.createElement('meta');m.name=name;document.head.appendChild(m)}m.content=content||''};
fetch(API+'/api/shef51/site-config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(({config:c})=>{
 if(!c)return;
 const d=c.design||{},g=c.general||{},n=c.navigation||{},h=c.home||{},p=c.pages||{};
 const css=document.createElement('style');
 css.textContent=`
 :root{--cms-bg:${d.background||'#050505'};--cms-surface:${d.surface||'#0b0b0b'};--cms-text:${d.text||'#fff'};--cms-muted:${d.muted||'#9b9b9b'};--cms-accent:${d.accent||'#ef2634'};--cms-border:${d.border||'#242424'};--cms-radius:${Number(d.radius)||24}px}
${Number(d.fontScale)&&Number(d.fontScale)!==100?` html{font-size:${Number(d.fontScale)}%}`:''}
 body{background:var(--cms-bg)!important;color:var(--cms-text)!important}
 header{background:color-mix(in srgb,var(--cms-bg) 92%,transparent)!important;border-color:var(--cms-border)!important}
 .brand b,.eyebrow,.svc .num{color:var(--cms-accent)!important}
 .btn,.chip.active{background:var(--cms-accent)!important;border-color:var(--cms-accent)!important}
 .panel,.svc,.card{background:var(--cms-surface)!important;border-color:var(--cms-border)!important;border-radius:var(--cms-radius)!important}
 .lead,.muted,.mini,footer{color:var(--cms-muted)!important}
 `;document.head.appendChild(css);
 if(c.seo){if(c.seo.title)document.title=c.seo.title;setMeta('description',c.seo.description||'')}
 const brand=document.querySelector('.brand');if(brand)brand.innerHTML='<b>'+((g.siteName||'SHEF51').replace(/[<>&]/g,''))+'</b> · '+((g.brandLine||'FARRUKH AKA').replace(/[<>&]/g,''));
 txt(byHref('index.html'),n.home);txt(byHref('products.html'),n.products);txt(byHref('services.html'),n.services);txt(byHref('about.html'),n.about);
 document.querySelectorAll('a[href="book.html"]').forEach(a=>{if(a.closest('.links'))txt(a,n.book);else if(a.classList.contains('btn'))txt(a,n.book)});
 const foot=document.querySelector('footer .foot');if(foot){const parts=foot.children;if(parts[0])txt(parts[0],g.footerText||((g.siteName||'SHEF51')+' · '+(g.brandLine||'')));if(parts[1])txt(parts[1],g.whatsapp?'WhatsApp: '+g.whatsapp:'')}
 const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 if(path===''||path==='index.html'){
   txt(document.querySelector('.hero .eyebrow'),h.eyebrow);txt(document.querySelector('.hero h1'),h.title);txt(document.querySelector('.hero .lead'),h.lead);
   const acts=document.querySelectorAll('.hero .actions .btn');if(acts[0])txt(acts[0],h.primaryButton);if(acts[1])txt(acts[1],h.secondaryButton);
   if(h.heroImage){let src=h.heroImage;if(src.startsWith('/api/'))src=API+src;const img=document.querySelector('.heroArt img');if(img)img.src=src}
   if(c.sections){const sec=[...document.querySelectorAll('section')];if(c.sections.products===false)sec.filter(x=>x.querySelector('.products')).forEach(x=>x.style.display='none');if(c.sections.services===false)sec.filter(x=>x.querySelector('.services')).forEach(x=>x.style.display='none');if(c.sections.booking===false)sec.filter(x=>x.querySelector('.book,.form')).forEach(x=>x.style.display='none')}
 }
 if(path==='products.html'){}
 if(path==='services.html'){}
 if(path==='about.html'){}
 if(path==='book.html'){}

 const applyCustom=()=>{
   const ct=c.customText||{}, ci=c.customImages||{}, hidden=c.hiddenElements||{};
   const texts=[...document.querySelectorAll('h1,h2,h3,p,.eyebrow,.lead,.mini,.price,.svc .num,footer .foot>div')];
   texts.forEach((el,i)=>{
     const key=path+':text:'+i;
     if(Object.prototype.hasOwnProperty.call(ct,key))el.textContent=ct[key];
     if(hidden[key])el.style.display='none';
   });
   const imgs=[...document.querySelectorAll('img')];
   imgs.forEach((el,i)=>{
     const key=path+':image:'+i;
     if(ci[key]){let src=ci[key];if(src.startsWith('/api/'))src=API+src;el.src=src}
     if(hidden[key])el.style.display='none';
   });
 };
 applyCustom();
 const mo=new MutationObserver(()=>applyCustom());
 mo.observe(document.body,{childList:true,subtree:true});
 setTimeout(()=>mo.disconnect(),12000);
}).catch(()=>{});
})();