(()=>{
  const ENDPOINT='https://farruhk-ai-mobile.onrender.com/api/shef51/analytics';
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const send=(event,data={})=>{
    const payload={
      event,
      page,
      label:String(data.label||'').slice(0,180),
      href:String(data.href||'').slice(0,300),
      meta:data.meta||{}
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
    let event='click';
    if(el.classList.contains('svcDetails'))event='service_details';
    else if(el.classList.contains('detailsBtn'))event='product_details';
    else if(el.classList.contains('chip'))event='product_filter';
    else if(/book\.html/i.test(href))event='booking_cta';
    else if(/wa\.me|whatsapp/i.test(href))event='whatsapp_click';
    else if(/^(index|products|services|about|book)\.html/i.test(href))event='nav_click';
    send(event,{label:text,href});
  },{passive:true});

  document.addEventListener('focusin',e=>{
    const form=e.target.closest('form');
    if(!form||form.dataset.analyticsStarted)return;
    form.dataset.analyticsStarted='1';
    send('form_start',{label:form.id||'form'});
  },{passive:true});
})();