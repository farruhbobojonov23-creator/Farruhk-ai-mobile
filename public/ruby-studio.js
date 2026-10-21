import {nearestReminder,mountHomeWeather} from '/home-context.js?v=76';
export function mountRubyHome({voice,panel,setMenu,settingsDialog,messagesDialog,getState}){
 const $=id=>document.getElementById(id);
 // Enforce the approved Arctic Sapphire heading even when an older cached page
 // contains the previous personalised greeting.
 const arcticHome=$('home');
 if(arcticHome?.classList.contains('arctic-home')){
   const heading=arcticHome.querySelector('.arctic-greeting h1');
   if(heading && !heading.textContent.includes('Будущее')){
     const em=document.createElement('em');em.textContent='В ваших руках.';
     heading.replaceChildren(document.createTextNode('Будущее.'),document.createElement('br'),em);
   }
 }
 const glassArtwork=$('home')?.querySelector('.arctic-reference-orb');
 if(glassArtwork){
   const reveal=()=>{if(glassArtwork.naturalWidth>0)glassArtwork.parentElement.classList.add('art-ready')};
   glassArtwork.addEventListener('load',reveal,{once:true});
   glassArtwork.addEventListener('error',()=>glassArtwork.parentElement.classList.remove('art-ready'),{once:true});
   if(glassArtwork.complete)reveal();
 }
 const pauseEffects=()=>document.body.classList.toggle('fx-paused',document.hidden);
 document.addEventListener('visibilitychange',pauseEffects);pauseEffects();
 mountHomeWeather($('home'));
 const reminder=$('home-today');reminder.setAttribute('role','button');reminder.tabIndex=0;reminder.onclick=()=>{location.hash='tasks'};reminder.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();location.hash='tasks'}};
 const talk=$('ruby-talk'),label=$('ruby-talk-label'),status=$('ruby-status');
 function openChat(){messagesDialog.append($('chat-form'));if(!messagesDialog.open)messagesDialog.showModal();$('message').focus()}
 $('ruby-menu').onclick=e=>{e.stopPropagation();setMenu($('chef-menu').hidden)};
 $('ruby-settings').onclick=()=>settingsDialog.showModal();
 $('ruby-chat').onclick=openChat;$('ruby-keyboard').onclick=openChat;
 talk.onclick=()=>{const phase=panel.dataset.phase||'idle';if(['idle','error'].includes(phase))voice.start();else voice.stop()};
 const phaseNames={connecting:'Подключаюсь…',listening:'Слушаю вас',thinking:'Думаю над ответом…',speaking:'Отвечаю вам'};
 function sync(){const phase=panel.dataset.phase||'idle';$('home').dataset.phase=phase;const active=!['idle','error'].includes(phase);talk.setAttribute('aria-pressed',String(active));label.textContent=active?'Остановить':'Начать разговор';status.textContent=phase==='error'?$('voice-status').textContent:(phaseNames[phase]||'Я на связи');}
 new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['data-phase']});sync();
 function render(){const state=getState?.();if(!state)return;const item=nearestReminder(state.tasks);const box=$('home-today');box.hidden=!item;box.replaceChildren();if(!item)return;const title=document.createElement('strong');title.textContent=item.task.text;const when=document.createElement('span');when.textContent=(item.overdue?'Просрочено · ':'Ближайшее · ')+new Date(item.task.due).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});box.append(when,title);box.setAttribute('aria-label',when.textContent+'. '+item.task.text+'. Открыть задачи');}
 render();setInterval(render,60000);
 return {render,remember(recipe){if(recipe?.id)try{localStorage.setItem('farrukh-last-open-recipe',recipe.id)}catch{}}};
}
