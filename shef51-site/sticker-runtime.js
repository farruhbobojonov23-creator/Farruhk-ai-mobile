(()=> {
  const A='/assets/stickers/';
  const asset=(n)=>A+n+'.svg';
  const rules=[
    // contacts
    ['+7 966 123-29-92','contacts_phone'],
    ['telegram','contacts_telegram'],
    ['whatsapp','contacts_whatsapp'],
    ['max','contacts_max'],
    ['farruh.bobojonov23@gmail.com','contacts_mail'],
    ['почта','contacts_mail'],

    // philosophy / benefits
    ['свежие продукты','benefits_fresh'],
    ['чистый вкус продукта','benefits_taste'],
    ['умами и баланс','benefits_spark'],
    ['текстуры и температура','benefits_heat'],
    ['японская точность','benefits_japan'],

    // services
    ['ужин на дому','services_dinner'],
    ['день рождения','services_birthday'],
    ['свадьба','services_wedding'],
    ['вечеринка','services_party'],
    ['корпоратив','services_corporate'],
    ['индивидуальный формат','services_chef'],
    ['персональный подход','services_chef'],
    ['индивидуальное меню','menu_setbox'],
    ['ресторанная подача','menu_service'],

    // about
    ['бренд-шеф','services_chef'],
    ['бренд‑шеф','services_chef'],
    ['horeca','services_corporate'],
    ['4 точки','services_corporate'],
    ['японская кухня','menu_sushi'],
    ['управление и развитие','menu_quality'],
    ['кухня','menu_sushi'],
    ['форматы','services_party'],
    ['подход','benefits_spark'],
    ['меню и r&d','benefits_spark'],
    ['команда','services_corporate'],
    ['управление','menu_quality'],
    ['стандарты','menu_quality'],
    ['запуск кухни','services_chef'],
    ['shef51','menu_service'],

    // booking
    ['выберите услугу и удобную дату','services_calendar'],
    ['количество гостей','services_corporate'],
    ['администратор шеф-повара','contacts_mail'],

    // menu / categories
    ['роллы','menu_rolls'],
    ['суши','menu_sushi'],
    ['сашими','menu_sashimi'],
    ['сеты','menu_setbox'],
    ['лосось','menu_salmon'],
    ['качество','menu_quality'],
    ['подача','menu_service']
  ];

  const style=document.createElement('style');
  style.id='real-sticker-style';
  style.textContent=`
    .realSticker{
      width:44px;height:44px;object-fit:contain;display:inline-block;vertical-align:middle;
      margin-right:9px;flex:0 0 44px;filter:drop-shadow(0 7px 12px rgba(0,0,0,.5));
      border-radius:50%;
    }
    .heroContacts .realSticker,.heroPhilosophy .realSticker{width:46px;height:46px;flex-basis:46px}
    .svc>.realSticker,.profileCard>.realSticker{width:66px;height:66px;display:block;margin:10px 0 14px 0}
    .badge .realSticker,.serviceBadge .realSticker{width:34px;height:34px;flex-basis:34px;margin-right:7px}
    .lead .realSticker,.notice .realSticker,.fact .realSticker{width:36px;height:36px;flex-basis:36px}
    .fullDesc .realSticker{width:38px;height:38px;float:left;margin:1px 10px 5px 0}
    .chip.hasSticker{display:inline-flex;align-items:center;gap:7px;padding-left:10px}
    .chip.hasSticker .realSticker{width:28px;height:28px;flex-basis:28px;margin:0}
    @media(max-width:560px){
      .realSticker{width:38px;height:38px;flex-basis:38px}
      .heroContacts .realSticker,.heroPhilosophy .realSticker{width:40px;height:40px;flex-basis:40px}
      .svc>.realSticker,.profileCard>.realSticker{width:58px;height:58px}
      .chip.hasSticker .realSticker{width:24px;height:24px;flex-basis:24px}
    }`;
  document.head.appendChild(style);

  function choose(el){
    const own=(el.textContent||'').trim().toLowerCase();
    const card=el.closest('.svc,.profileCard,.fact,.badge,.serviceBadge,.luxPill,.prod,.lead,.notice');
    const text=((card?.textContent||own)).trim().toLowerCase();
    if(el.closest('.prod')){
      const p=el.closest('.prod');
      const cat=(p.dataset.cat||'').toLowerCase();
      if(cat==='wok') return 'menu_service';
      if(cat==='sushi') return 'menu_sushi';
      return 'menu_rolls';
    }
    for(const [needle,name] of rules){
      if(text.includes(needle)) return name;
    }
    return null;
  }

  function swap(root=document){
    root.querySelectorAll('.siteIcon,.luxIcon').forEach(icon=>{
      if(icon.dataset.stickerDone) return;
      const name=choose(icon);
      if(!name) return;
      const img=document.createElement('img');
      img.className='realSticker';
      img.src=asset(name);
      img.alt='';
      img.setAttribute('aria-hidden','true');
      icon.replaceWith(img);
    });

    // Category chips on menu page
    root.querySelectorAll('.chip').forEach(chip=>{
      if(chip.dataset.stickerDone) return;
      const t=(chip.textContent||'').trim().toLowerCase();
      let name=null;
      if(t==='все') name='menu_setbox';
      else if(t==='роллы') name='menu_rolls';
      else if(t==='суши') name='menu_sushi';
      else if(t==='воки') name='menu_service';
      if(name){
        const img=document.createElement('img');
        img.className='realSticker';
        img.src=asset(name);
        img.alt='';
        img.setAttribute('aria-hidden','true');
        chip.prepend(img);
        chip.classList.add('hasSticker');
        chip.dataset.stickerDone='1';
      }
    });
  }

  swap();
  const obs=new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1) swap(n)})));
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();