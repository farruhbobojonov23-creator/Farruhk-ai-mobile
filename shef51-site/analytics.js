(()=>{
  const ENDPOINT='https://farruhk-ai-mobile.onrender.com/api/shef51/analytics';
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();

  const makeId=()=>((globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2)));
  let visitorId='',sessionId='';
  try{
    visitorId=localStorage.getItem('shef51_visitor_id')||makeId();
    localStorage.setItem('shef51_visitor_id',visitorId);
  }catch{}
  try{
    sessionId=sessionStorage.getItem('shef51_session_id')||makeId();
    sessionStorage.setItem('shef51_session_id',sessionId);
  }catch{}

  const qs=new URLSearchParams(location.search);
  const ref=document.referrer||'';
  const host=(()=>{try{return new URL(ref).hostname.replace(/^www\./,'')}catch{return ''}})();
  const detectSource=()=>{
    const utm=qs.get('utm_source');
    if(utm)return utm.slice(0,80);
    if(!host)return 'Прямой заход';
    if(/google\./i.test(host))return 'Google';
    if(/yandex\./i.test(host))return 'Яндекс';
    if(/vk\.com|vk\.ru/i.test(host))return 'VK';
    if(/t\.me|telegram/i.test(host))return 'Telegram';
    if(/wa\.me|whatsapp/i.test(host))return 'WhatsApp';
    if(/instagram\.com/i.test(host))return 'Instagram';
    if(/facebook\.com/i.test(host))return 'Facebook';
    return host;
  };
  const detectBrowser=()=>{
    const ua=navigator.userAgent||'';
    if(/Edg\//.test(ua))return 'Edge';
    if(/OPR\//.test(ua))return 'Opera';
    if(/Chrome\//.test(ua)&&!/Edg\//.test(ua))return 'Chrome';
    if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))return 'Safari';
    if(/Firefox\//.test(ua))return 'Firefox';
    return 'Другой';
  };
  const detectOS=()=>{
    const ua=navigator.userAgent||'';
    if(/iPhone|iPad|iPod/.test(ua))return 'iOS';
    if(/Android/.test(ua))return 'Android';
    if(/Windows/.test(ua))return 'Windows';
    if(/Mac OS X/.test(ua))return 'macOS';
    if(/Linux/.test(ua))return 'Linux';
    return 'Другой';
  };

  let firstTouch={};
  try{
    const saved=JSON.parse(localStorage.getItem('shef51_first_touch_v1')||'null');
    if(saved&&saved.source)firstTouch=saved;
    else{
      firstTouch={
        source:detectSource(),
        referrer:ref.slice(0,300),
        referrerHost:host.slice(0,120),
        landingPage:(location.pathname+location.search).slice(0,300),
        utmMedium:(qs.get('utm_medium')||'').slice(0,80),
        utmCampaign:(qs.get('utm_campaign')||'').slice(0,120),
        utmTerm:(qs.get('utm_term')||'').slice(0,120),
        utmContent:(qs.get('utm_content')||'').slice(0,120)
      };
      localStorage.setItem('shef51_first_touch_v1',JSON.stringify(firstTouch));
    }
  }catch{
    firstTouch={source:detectSource(),referrer:ref.slice(0,300),referrerHost:host.slice(0,120),landingPage:(location.pathname+location.search).slice(0,300)};
  }

  const baseMeta=()=>({
    visitorId,sessionId,
    source:firstTouch.source||detectSource(),
    referrerHost:firstTouch.referrerHost||host,
    landingPage:firstTouch.landingPage||page,
    utmMedium:firstTouch.utmMedium||'',
    utmCampaign:firstTouch.utmCampaign||'',
    device:matchMedia('(max-width: 900px)').matches?'mobile':'desktop',
    browser:detectBrowser(),
    os:detectOS(),
    language:(navigator.language||'').slice(0,20),
    timezone:(Intl.DateTimeFormat().resolvedOptions().timeZone||'').slice(0,80)
  });

  window.shefAnalyticsContext=()=>({...baseMeta(),referrer:firstTouch.referrer||ref});

  const send=(event,data={})=>{
    const payload={
      event,
      page,
      label:String(data.label||'').slice(0,180),
      href:String(data.href||'').slice(0,300),
      meta:{...baseMeta(),...(data.meta||{})}
    };
    try{
      fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,mode:'cors'}).catch(()=>{});
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