(()=> {
  const A='/assets/stickers/';
  const asset=(n)=>A+n+'.svg';

  // Ordered from the most specific phrase to broader concepts.
  const rules=[
    // contacts
    ['farruh.bobojonov23@gmail.com','contacts_mail'],
    ['электронная почта','contacts_mail'],
    ['whatsapp','contacts_whatsapp'],
    ['telegram','contacts_telegram'],
    ['телеграм','contacts_telegram'],
    ['+7 966 123-29-92','contacts_phone'],
    ['телефон','contacts_phone'],
    ['почта','contacts_mail'],
    ['max','contacts_max'],

    // main philosophy
    ['свежие продукты','benefits_fresh'],
    ['свежесть продукта','benefits_fresh'],
    ['чистый вкус продукта','benefits_taste'],
    ['чистый вкус','benefits_taste'],
    ['умами и баланс','benefits_spark'],
    ['умами','benefits_spark'],
    ['текстуры и температура','benefits_heat'],
    ['температура','benefits_heat'],
    ['японская точность','benefits_japan'],

    // service badges / services
    ['персональный подход','services_chef'],
    ['индивидуальный подход','services_chef'],
    ['ресторанная подача','menu_service'],
    ['ужин на дому','services_dinner'],
    ['день рождения','services_birthday'],
    ['свадьба','services_wedding'],
    ['вечеринка','services_party'],
    ['корпоратив','services_corporate'],
    ['индивидуальный формат','services_chef'],
    ['частный ужин','services_dinner'],

    // booking and event details
    ['выберите услугу и удобную дату','services_calendar'],
    ['удобную дату','services_calendar'],
    ['дата','services_calendar'],
    ['количество гостей','services_corporate'],
    ['гостей','services_corporate'],
    ['ваше имя','services_chef'],
    ['имя','services_chef'],
    ['пожелания','benefits_spark'],
    ['администратор шеф-повара','contacts_mail'],
    ['подтверждения и уточнения деталей','contacts_mail'],

    // about / professional blocks
    ['бренд-шеф японской кухни','services_chef'],
    ['бренд‑шеф японской кухни','services_chef'],
    ['бренд-шеф','services_chef'],
    ['бренд‑шеф','services_chef'],
    ['моя работа — не просто приготовить','menu_quality'],
    ['horeca','services_corporate'],
    ['мурманск','menu_quality'],
    ['японская кухня','menu_sushi'],
    ['кухня','menu_sushi'],
    ['форматы','services_party'],
    ['подход','benefits_spark'],
    ['меню и r&d','menu_setbox'],
    ['r&d','menu_setbox'],
    ['команда','services_corporate'],
    ['управление','menu_quality'],
    ['стандарты','menu_quality'],
    ['запуск кухни','services_chef'],
    ['shef51','menu_service'],
    ['4 точки','services_corporate'],
    ['управление и развитие','menu_quality'],

    // food / categories
    ['свежий лосось','menu_salmon'],
    ['лосось','menu_salmon'],
    ['сашими','menu_sashimi'],
    ['сеты','menu_setbox'],
    ['роллы','menu_rolls'],
    ['суши','menu_sushi'],
    ['воки','menu_service'],
    ['удон','menu_service'],
    ['качество','menu_quality'],
    ['подача','menu_service']
  ];

  const style=document.createElement('style');
  style.id='real-sticker-style-v3';
  style.textContent=`
    .realSticker{
      width:44px;height:44px;object-fit:contain;display:inline-block;vertical-align:middle;
      margin-right:9px;flex:0 0 44px;
      filter:drop-shadow(0 8px 14px rgba(0,0,0,.48));
      border-radius:0!important;
    }
    .heroContacts .realSticker,.heroPhilosophy .realSticker{width:48px;height:48px;flex-basis:48px}
    .svc>.realSticker,.profileCard>.realSticker{width:68px;height:68px;display:block;margin:8px 0 14px 0}
    .badge .realSticker,.serviceBadge .realSticker{width:34px;height:34px;flex-basis:34px;margin-right:7px}
    .lead .realSticker,.notice .realSticker,.fact .realSticker{width:38px;height:38px;flex-basis:38px}
    .fullDesc .realSticker{width:40px;height:40px;float:left;margin:1px 10px 5px 0}
    .chip.hasSticker{display:inline-flex;align-items:center;gap:7px;padding-left:10px}
    .chip.hasSticker .realSticker{width:28px;height:28px;flex-basis:28px;margin:0}
    .field label.hasSticker{display:flex;align-items:center;gap:7px;color:#cfcfcf}
    .field label.hasSticker .realSticker{width:25px;height:25px;flex:0 0 25px;margin:0}
    .foot .footerSticker{display:inline-flex;align-items:center;gap:7px}
    .foot .footerSticker .realSticker{width:28px;height:28px;flex:0 0 28px;margin:0}
    @media(max-width:560px){
      .realSticker{width:38px;height:38px;flex-basis:38px}
      .heroContacts .realSticker,.heroPhilosophy .realSticker{width:41px;height:41px;flex-basis:41px}
      .svc>.realSticker,.profileCard>.realSticker{width:58px;height:58px}
      .chip.hasSticker .realSticker{width:24px;height:24px;flex-basis:24px}
    }`;
  if(!document.getElementById(style.id)) document.head.appendChild(style);

  const normalize=(s)=>(s||'').replace(/\s+/g,' ').trim().toLowerCase();

  function followingText(el){
    let out='';
    let n=el.nextSibling;
    while(n && out.length<180){
      if(n.nodeType===1 && (n.matches?.('.siteIcon,.luxIcon,.realSticker'))) break;
      out+=' '+(n.textContent||'');
      n=n.nextSibling;
    }
    return normalize(out);
  }

  function closestText(el){
    const parent=el.closest('.luxPill,.serviceBadge,.badge,.svc,.profileCard,.fact,.lead,.notice,.fullDesc,.prod,.panel');
    return normalize(parent?.textContent||el.parentElement?.textContent||'');
  }

  function byRules(text){
    for(const [needle,name] of rules){
      if(text.includes(needle)) return name;
    }
    return null;
  }

  function choose(el){
    // Product card category has priority.
    const p=el.closest('.prod');
    if(p){
      const cat=normalize(p.dataset.cat||'');
      const text=normalize(p.textContent||'');
      if(text.includes('лосось')) return 'menu_salmon';
      if(cat==='wok' || text.includes('удон')) return 'menu_service';
      if(cat==='sushi' || text.includes('суши')) return 'menu_sushi';
      if(text.includes('сашими')) return 'menu_sashimi';
      if(text.includes('сет')) return 'menu_setbox';
      return 'menu_rolls';
    }

    // When several icons live in the same paragraph, read the text immediately after each icon.
    const local=followingText(el);
    const localMatch=byRules(local);
    if(localMatch) return localMatch;

    const block=closestText(el);
    return byRules(block);
  }

  function makeImg(name,extra=''){
    const img=document.createElement('img');
    img.className=('realSticker '+extra).trim();
    img.src=asset(name);
    img.alt='';
    img.loading='eager';
    img.decoding='async';
    img.setAttribute('aria-hidden','true');
    return img;
  }

  function swapIcons(root=document){
    root.querySelectorAll('.siteIcon,.luxIcon').forEach(icon=>{
      if(icon.dataset.stickerDone) return;
      const name=choose(icon);
      if(!name) return;
      icon.replaceWith(makeImg(name));
    });
  }

  function addCategoryStickers(root=document){
    root.querySelectorAll('.chip').forEach(chip=>{
      if(chip.dataset.stickerDone) return;
      const t=normalize(chip.textContent);
      let name=null;
      if(t==='все') name='menu_setbox';
      else if(t==='роллы') name='menu_rolls';
      else if(t==='суши') name='menu_sushi';
      else if(t==='воки') name='menu_service';
      else if(t.includes('сашими')) name='menu_sashimi';
      if(name){
        chip.prepend(makeImg(name));
        chip.classList.add('hasSticker');
        chip.dataset.stickerDone='1';
      }
    });
  }

  function addBookingFieldStickers(root=document){
    const fieldRules=[
      ['услуга','services_chef'],
      ['дата','services_calendar'],
      ['количество гостей','services_corporate'],
      ['ваше имя','services_chef'],
      ['телефон / whatsapp','contacts_whatsapp'],
      ['пожелания','benefits_spark']
    ];
    root.querySelectorAll('.field label').forEach(label=>{
      if(label.dataset.stickerDone) return;
      const t=normalize(label.textContent);
      const pair=fieldRules.find(([needle])=>t.includes(needle));
      if(!pair) return;
      label.prepend(makeImg(pair[1]));
      label.classList.add('hasSticker');
      label.dataset.stickerDone='1';
    });
  }

  function addFooterContact(root=document){
    root.querySelectorAll('.foot > div').forEach(div=>{
      if(div.dataset.stickerDone) return;
      const t=normalize(div.textContent);
      if(t.includes('whatsapp')){
        div.prepend(makeImg('contacts_whatsapp'));
        div.classList.add('footerSticker');
        div.dataset.stickerDone='1';
      }
    });
  }

  function addHeroBadge(root=document){
    const badge=root.querySelector?.('.heroBadge');
    if(badge && !badge.dataset.stickerDone){
      badge.prepend(makeImg('services_chef'));
      badge.dataset.stickerDone='1';
    }
  }

  function swap(root=document){
    swapIcons(root);
    addCategoryStickers(root);
    addBookingFieldStickers(root);
    addFooterContact(root);
    addHeroBadge(root);
  }

  swap();
  const obs=new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1) swap(n)})));
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();