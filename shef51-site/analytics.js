(()=>{
  const ENDPOINT='https://farruhk-ai-mobile.onrender.com/api/shef51/analytics';
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();

  const makeId=()=>((crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2)));
  let visitorId,sessionId;
  try{
    visitorId=localStorage.getItem('shef51_visitor_id')||makeId();
    localStorage.setItem('shef51_visitor_id',visitorId);
  }catch{visitorId='';}
  try{
    sessionId=sessionStorage.getItem('shef51_session_id')||makeId();
    sessionStorage.setItem('shef51_session_id',sessionId);
  }catch{sessionId='';}

  const baseMeta=()=>({
    visitorId,sessionId,
    device:matchMedia('(max-width: 900px)').matches?'mobile':'desktop'
  });

  const send=(event,data={})=>{
    const payload={
      event,
      page,
      label:String(data.label||'').slice(0,180),
      href:String(data.href||'').slice(0,300),
      meta:{...baseMeta(),...(data.meta||{})}
    };
    try{
      fetch(ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        keepalive:true,
        mode:'cors'
      }).catch(()=>{});
    }catch{}
  };
  window.shefTrack=send;

  send('page_view',{meta:{title:document.title}});

  document.addEventListener('click',e=>{
    const el=e.target.closest('a,button');
    if(!el)return;
    const text=(el.textContent||el.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,120);
    const href=el.getAttribute('href')||'';
    let event='click',label=text;
    if(el.classList.contains('svcDetails')){
      event='service_details';
      label=(el.closest('.svc')?.querySelector('h3')?.textContent||text).trim();
    }else if(el.classList.contains('detailsBtn')){
      event='product_details';
      label=(el.closest('.prod')?.querySelector('h3')?.textContent||text).trim();
    }else if(el.classList.contains('chip')){
      event='product_filter';
    }else if(/book\.html/i.test(href)){
      event='booking_cta';
      label=(el.closest('.svc')?.querySelector('h3')?.textContent||text).trim();
    }else if(/wa\.me|whatsapp/i.test(href)){
      event='whatsapp_click';
    }else if(/^(index|products|services|about|book)\.html/i.test(href)){
      event='nav_click';
    }
    send(event,{label,href});
  },{passive:true});

  document.addEventListener('focusin',e=>{
    const form=e.target.closest('form');
    if(!form||form.dataset.analyticsStarted)return;
    form.dataset.analyticsStarted='1';
    send('form_start',{label:form.id||'form'});
  },{passive:true});
})();