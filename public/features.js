
;(()=>{
  try{state.wakeWord=false;save();stopWakeWord(true);}catch(e){}
  try{
    const toggle=document.querySelector('#wakeWordToggle');
    if(toggle){toggle.checked=false;toggle.disabled=true;const label=toggle.closest('label');if(label)label.style.display='none';}
    const note=document.querySelector('.wake-note');
    if(note)note.textContent='Голосовой режим: нажми «Говорить». AI скажет «Слушаю, шеф» и начнёт слушать команду.';
  }catch(e){}

  const StableSR=window.SpeechRecognition||window.webkitSpeechRecognition;
  function startStableVoice(){
    try{state.wakeWord=false;save();stopWakeWord(true);}catch(e){}
    if(!StableSR){alert('Голосовой ввод лучше всего работает в Chrome на Android.');return;}

    const startMic=()=>{
      const r=new StableSR();
      r.lang='ru-RU';
      r.continuous=false;
      r.interimResults=false;
      const btn=document.querySelector('#talkBtn');
      if(btn)btn.textContent='🎙 Слушаю...';
      r.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';if(text)askAI(text);};
      r.onend=()=>{if(btn)btn.textContent='🎙 Говорить';};
      r.onerror=()=>{if(btn)btn.textContent='🎙 Говорить';};
      try{r.start();}catch(e){if(btn)btn.textContent='🎙 Говорить';}
    };

    if(state.tts && 'speechSynthesis' in window){
      speechSynthesis.cancel();
      const preset=voicePresets[voicePreset]||voicePresets.ai;
      const u=new SpeechSynthesisUtterance('Слушаю, шеф.');
      u.lang='ru-RU';
      const customRate=parseFloat(localStorage.getItem('farrukh_voice_rate')||'0');
      u.rate=customRate||preset.rate;
      u.pitch=preset.pitch;
      const chosen=getPreferredVoice(preset);if(chosen)u.voice=chosen;
      u.onend=startMic;
      u.onerror=startMic;
      speechSynthesis.speak(u);
    }else startMic();
  }

  const talk=document.querySelector('#talkBtn');if(talk)talk.onclick=startStableVoice;
  const wake=document.querySelector('#wakeBtn');if(wake)wake.onclick=startStableVoice;
})();

;(()=>{
  function cleanSpeechText(text){
    return String(text||'')
      .replace(/https?:\/\/\S+/gi,'')
      .replace(/[*#_~\x60>|\[\]{}]/g,' ')
      .replace(/\(([^)]{0,120})\)/g,' $1 ')
      .replace(/[-–—]{2,}/g,' ')
      .replace(/\s*[,;:]\s*/g,', ')
      .replace(/\s+/g,' ')
      .trim();
  }

  try{
    speakWithPreset=function(text,presetKey=voicePreset){
      const clean=cleanSpeechText(text);
      if(!state.tts||!('speechSynthesis'in window)||!clean)return;
      const preset=voicePresets[presetKey]||voicePresets.ai;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(clean);
      u.lang='ru-RU';
      const customRate=parseFloat(localStorage.getItem('farrukh_voice_rate')||'0');
      u.rate=customRate||Math.min(1.0,Math.max(0.9,preset.rate));
      u.pitch=preset.gender==='female'?1.02:0.96;
      const chosen=getPreferredVoice(preset);if(chosen)u.voice=chosen;
      speechSynthesis.speak(u);
    };
    speak=function(text){speakWithPreset(text,voicePreset)};
  }catch(e){}

  function addChat(role,text){state.chat.push({role,text});renderChat();}

  function parseTime(text){
    const now=new Date();
    const lower=String(text||'').toLowerCase();
    const m=lower.match(/(?:в|на)\s*(\d{1,2})(?:[:.](\d{2}))?/);
    if(!m)return null;
    const d=new Date(now);
    d.setHours(Math.min(23,Number(m[1])),Math.min(59,Number(m[2]||0)),0,0);
    if(/послезавтра/.test(lower))d.setDate(d.getDate()+2);
    else if(/завтра/.test(lower))d.setDate(d.getDate()+1);
    else if(d<=now)d.setDate(d.getDate()+1);
    return d;
  }

  function taskTextFromCommand(text){
    return String(text||'')
      .replace(/^(добавь|добавить|создай|создать|запиши|записать)\s+/i,'')
      .replace(/^(мне\s+)?(задачу|напоминание)\s*[:,-]?\s*/i,'')
      .replace(/^(напомни|напомнить)\s*(мне)?\s*/i,'')
      .replace(/\s+(сегодня|завтра|послезавтра)\s*(?:в|на)?\s*\d{1,2}(?:[:.]\d{2})?\s*$/i,'')
      .replace(/\s+(?:в|на)\s*\d{1,2}(?:[:.]\d{2})?\s*$/i,'')
      .trim();
  }

  function formatWhen(d){return d?d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';}

  function saveVoiceTask(text){
    const due=parseTime(text);
    const taskText=taskTextFromCommand(text)||'Новая задача';
    state.tasks.unshift({text:taskText,priority:'normal',done:false,dueAt:due?due.toISOString():null,reminded:false,createdBy:'voice'});
    save();renderTasks();
    const reply=due?'Задача сохранена. Напоминание при открытом приложении '+formatWhen(due)+': '+taskText+'.':'Задача сохранена: '+taskText+'.';
    addChat('ai',reply);speak(reply);return true;
  }

  function reportText(kind){
    const active=(state.tasks||[]).filter(t=>!t.done);
    const done=(state.tasks||[]).filter(t=>t.done);
    const high=active.filter(t=>t.priority==='high');
    const due=active.filter(t=>t.dueAt&&new Date(t.dueAt)<=new Date(Date.now()+24*60*60*1000));
    if(kind==='morning'){
      let s='Доброе утро, шеф. На сегодня '+active.length+' активных задач.';
      if(high.length)s+=' Важных: '+high.length+'. '+high.slice(0,3).map(t=>t.text).join('. ')+'.';
      if(due.length)s+=' С напоминанием в ближайшие сутки: '+due.length+'.';
      if(!active.length)s+=' Активных задач нет.';
      return s;
    }
    let s='Вечерний отчёт, шеф. Выполнено задач: '+done.length+'. Осталось: '+active.length+'.';
    if(active.length)s+=' На контроле: '+active.slice(0,3).map(t=>t.text).join('. ')+'.';
    return s;
  }

  function showReport(kind,automatic=false){const text=reportText(kind);addChat('ai',text);speak(text);if(automatic)show('chat');}

  const originalAskAI=askAI;
  askAI=async function(text){
    const t=String(text||'').trim();
    const low=t.toLowerCase();
    if(/^(добавь|добавить|создай|создать|запиши|записать).*(задач|напомин)|^напомни|^напомнить/.test(low)){
      addChat('user',t);show('chat');return saveVoiceTask(t);
    }
    if(/утренн.*отч[её]т|отч[её]т.*утр/.test(low)){addChat('user',t);show('chat');showReport('morning');return;}
    if(/вечерн.*отч[её]т|отч[её]т.*вечер/.test(low)){addChat('user',t);show('chat');showReport('evening');return;}
    return originalAskAI(t);
  };

  function maybeNotify(task){
    const body=task.text||'Напоминание';
    if('Notification'in window&&Notification.permission==='granted')try{new Notification('FARRUKH AI',{body});}catch(e){}
    addChat('ai','Напоминание: '+body);speak('Шеф, напоминаю: '+body);task.reminded=true;save();
  }

  async function ensureNotifications(){if(!('Notification'in window))return;if(Notification.permission==='default')try{await Notification.requestPermission();}catch(e){}}
  // Notification permission is requested only from an explicit user action.

  function reminderTick(){const now=Date.now();(state.tasks||[]).forEach(t=>{if(!t.done&&!t.reminded&&t.dueAt&&new Date(t.dueAt).getTime()<=now)maybeNotify(t);});}
  reminderTick();setInterval(reminderTick,30000);

  function dailyReportsTick(){
    const now=new Date();
    const day=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    const mins=now.getHours()*60+now.getMinutes();
    const morningKey='farrukh_report_morning_'+day;
    const eveningKey='farrukh_report_evening_'+day;
    if(mins>=540&&mins<720&&!localStorage.getItem(morningKey)){localStorage.setItem(morningKey,'1');showReport('morning',true);}
    if(mins>=1260&&!localStorage.getItem(eveningKey)){localStorage.setItem(eveningKey,'1');showReport('evening',true);}
  }
  // Reports are user initiated; a foreground timer cannot guarantee scheduled delivery.
})();

;(()=>{
  const pathInput=document.querySelector('#yandexDiskPath');
  const saveBtn=document.querySelector('#saveYandexDiskPath');
  const statusEl=document.querySelector('#yandexDiskStatus');
  if(!pathInput||!saveBtn||!statusEl)return;
  const saved=localStorage.getItem('farrukh_yandex_disk_path')||pathInput.value||'/FARRUKH_AI_STORAGE/';pathInput.value=saved;
  let connectBtn=document.querySelector('#connectYandexDisk');
  if(!connectBtn){connectBtn=document.createElement('button');connectBtn.id='connectYandexDisk';connectBtn.className='primary';connectBtn.textContent='Подключить Яндекс Диск';connectBtn.style.marginTop='8px';saveBtn.insertAdjacentElement('afterend',connectBtn);}
  let backupBtn=document.querySelector('#backupYandexDisk');
  if(!backupBtn){backupBtn=document.createElement('button');backupBtn.id='backupYandexDisk';backupBtn.textContent='Сделать резервную копию';backupBtn.style.cssText='width:100%;margin-top:8px;padding:12px;border-radius:14px;border:1px solid #244036;background:#102019;color:#78ffad;font-weight:700;';connectBtn.insertAdjacentElement('afterend',backupBtn);}
  function setStatus(text,ok=false){statusEl.textContent=text;statusEl.style.color=ok?'#77ffab':'#f4c66a';}
  function path(){let p=(pathInput.value||'/FARRUKH_AI_STORAGE/').trim();if(!p.startsWith('/'))p='/'+p;if(!p.endsWith('/'))p+='/';return p;}
  saveBtn.onclick=()=>{const p=path();pathInput.value=p;localStorage.setItem('farrukh_yandex_disk_path',p);setStatus('Путь сохранён: '+p,true);};
  async function checkYandex(){try{setStatus('Проверяю подключение…');const r=await fetch('/api/yandex/status');const d=await r.json();if(d.connected){setStatus('Яндекс Диск подключён ✓',true);connectBtn.textContent='Создать рабочие папки';return true;}if(d.reason==='token_missing'){setStatus('Нужен безопасный токен Яндекс Диска на сервере Render.');connectBtn.textContent='Яндекс Диск не авторизован';return false;}setStatus('Не удалось подключиться к Яндекс Диску: '+(d.error||'ошибка'));return false;}catch(e){setStatus('Ошибка связи с сервером.');return false;}}
  connectBtn.onclick=async()=>{const connected=await checkYandex();if(!connected){alert('Добавь OAuth-токен Яндекс Диска в Render как YANDEX_DISK_TOKEN.');return;}try{connectBtn.disabled=true;connectBtn.textContent='Создаю папки…';const r=await fetch('/api/yandex/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basePath:path()})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка');setStatus('Яндекс Диск подключён ✓ Папки готовы.',true);connectBtn.textContent='Папки готовы ✓';}catch(e){setStatus('Ошибка: '+e.message);connectBtn.textContent='Повторить подключение';}finally{connectBtn.disabled=false;}};
  backupBtn.onclick=async()=>{try{backupBtn.disabled=true;backupBtn.textContent='Сохраняю…';const backup={createdAt:new Date().toISOString(),tasks:state.tasks||[],projects:state.projects||[],knowledge:state.knowledge||'',settings:{voicePreset:localStorage.getItem('farrukh_voice_preset')||'ai'}};const fileName='farrukh-ai-backup-'+new Date().toISOString().slice(0,10)+'.json';const r=await fetch('/api/yandex/upload-json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basePath:path(),folder:'Backups',fileName,data:backup})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка');setStatus('Резервная копия сохранена: '+d.path,true);backupBtn.textContent='Резервная копия готова ✓';}catch(e){setStatus('Не удалось сохранить копию: '+e.message);backupBtn.textContent='Сделать резервную копию';}finally{backupBtn.disabled=false;}};
  checkYandex();
})();