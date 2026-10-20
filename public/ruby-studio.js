export function mountRubyHome({voice,panel,setMenu,settingsDialog,messagesDialog,getState}){
 const $=id=>document.getElementById(id);
 const talk=$('ruby-talk'),label=$('ruby-talk-label'),status=$('ruby-status');
 function openChat(){messagesDialog.append($('chat-form'));if(!messagesDialog.open)messagesDialog.showModal();$('message').focus()}
 $('ruby-menu').onclick=e=>{e.stopPropagation();setMenu($('chef-menu').hidden)};
 $('ruby-settings').onclick=()=>settingsDialog.showModal();
 $('ruby-chat').onclick=openChat;$('ruby-keyboard').onclick=openChat;
 talk.onclick=()=>{const phase=panel.dataset.phase||'idle';if(['idle','error'].includes(phase))voice.start();else voice.stop()};
 const phaseNames={connecting:'Подключаюсь…',listening:'Слушаю вас',thinking:'Думаю над ответом…',speaking:'Отвечаю вам'};
 function sync(){const phase=panel.dataset.phase||'idle';$('home').dataset.phase=phase;const active=!['idle','error'].includes(phase);talk.setAttribute('aria-pressed',String(active));label.textContent=active?'Остановить':'Начать разговор';status.textContent=phase==='error'?$('voice-status').textContent:(phaseNames[phase]||'Я на связи');}
 new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['data-phase']});sync();
 return {render(){const state=getState?.();if(!state)return;const active=(state.tasks||[]).filter(t=>!t.done);const late=active.filter(t=>t.due&&Date.parse(t.due)<Date.now());const box=$('home-today');box.replaceChildren();const title=document.createElement('strong');title.textContent=active.length?'На контроле: '+active.length+' задач':'Все задачи выполнены';box.append(title);if(late.length)box.append(document.createElement('br'),document.createTextNode('Просрочено: '+late.length));else box.append(document.createElement('br'),document.createTextNode('Можно заняться новой проработкой'));},remember(recipe){if(recipe?.id)try{localStorage.setItem('farrukh-last-open-recipe',recipe.id)}catch{}}};
}
