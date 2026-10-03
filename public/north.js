(()=>{
  const root=document.createElement('div');
  root.id='northClock';
  root.innerHTML='<strong>--:--</strong><span>МОСКОВСКОЕ ВРЕМЯ</span>';
  document.body.appendChild(root);
  const time=root.querySelector('strong');
  const update=()=>{
    try{
      time.textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(new Date());
    }catch{
      time.textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    }
  };
  update();
  setInterval(update,30000);
})();
