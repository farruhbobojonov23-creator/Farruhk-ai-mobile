export function mountRubyHome({voice,panel,setMenu,settingsDialog,messagesDialog}){
 const $=id=>document.getElementById(id);
 const talk=$('ruby-talk'),label=$('ruby-talk-label'),status=$('ruby-status');
 function openChat(){messagesDialog.append($('chat-form'));if(!messagesDialog.open)messagesDialog.showModal();$('message').focus()}
 $('ruby-menu').onclick=e=>{e.stopPropagation();setMenu($('chef-menu').hidden)};
 $('ruby-settings').onclick=()=>settingsDialog.showModal();
 $('ruby-chat').onclick=openChat;$('ruby-keyboard').onclick=openChat;
 talk.onclick=()=>{const phase=panel.dataset.phase||'idle';if(['idle','error'].includes(phase))voice.start();else voice.stop()};
 const phaseNames={connecting:'Подключаюсь…',listening:'Слушаю вас',thinking:'Думаю над ответом…',speaking:'Отвечаю вам'};
 function sync(){const phase=panel.dataset.phase||'idle',active=!['idle','error'].includes(phase);talk.setAttribute('aria-pressed',String(active));label.textContent=active?'Остановить':'Начать разговор';status.textContent=phase==='error'?$('voice-status').textContent:(phaseNames[phase]||'Я на связи');}
 new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['data-phase']});sync();
 return {render(){},remember(recipe){if(recipe?.id)try{localStorage.setItem('farrukh-last-open-recipe',recipe.id)}catch{}}};
}
