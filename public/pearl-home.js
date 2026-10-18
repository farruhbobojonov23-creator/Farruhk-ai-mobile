import {selectTasks,taskDay} from './task-board.js';
export function homeAgenda(state,now=new Date()){
 const tasks=selectTasks(state.tasks||[],{now}).filter(t=>!t.due||taskDay(t.due)<=taskDay(now)).slice(0,2).map(t=>({title:t.text,detail:t.due?(Date.parse(t.due)<+now?'Срок истёк · ':'')+new Date(t.due).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Без срока',view:'tasks'}));
 const action=(state.haccp?.actions||[]).find(a=>a.status==='open');if(action)tasks.push({title:action.text,detail:'ХАССП · Требует проверки',view:'lab'});
 return tasks.slice(0,3);
}
export function recentRecipe(state,id){return state.recipes?.find(r=>r.id===id)||null}
export function mountPearlHome({getState,show,openEditor,notify}){
 const $=id=>document.getElementById(id),list=$('pearl-agenda'),resume=$('pearl-resume');
 $('pearl-new-recipe').onclick=()=>openEditor();$('pearl-day-plan').onclick=()=>{show('tasks');document.querySelector('[data-filter=day]')?.click()};
 $('pearl-all-tasks').onclick=()=>show('tasks');
 const explain=()=>{$('pearl-help').showModal()};$('pearl-orb-button').onclick=explain;$('pearl-help-close').onclick=()=>$('pearl-help').close();
 const mic=document.createElement('button');mic.type='button';mic.id='pearl-mic';mic.setAttribute('aria-label','Голосовой ввод');mic.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';mic.onclick=explain;document.getElementById('chat-form').append(mic);
 const message=$('message'),send=document.querySelector('#chat-form [type=submit]')||document.querySelector('#chat-form button');const input=()=>{const hasText=!!message.value.trim();send.hidden=!hasText;mic.hidden=hasText};message.addEventListener('input',input);input();
 const observer=new MutationObserver(()=>{const phase=$('voice-panel').dataset.phase;document.getElementById('pearl-art').dataset.phase=phase;input()});observer.observe($('voice-panel'),{attributes:true,attributeFilter:['data-phase']});
 let lastId;try{lastId=localStorage.getItem('farrukh-last-open-recipe')}catch{}
 function remember(recipe){if(!recipe?.id)return;lastId=recipe.id;try{localStorage.setItem('farrukh-last-open-recipe',lastId)}catch{}render()}
 function render(){const state=getState();if(!state)return;list.replaceChildren();const agenda=homeAgenda(state);if(!agenda.length){const empty=document.createElement('div');empty.className='pearl-empty';empty.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 6H7v24h20V6h-4M12 3h10v6H12zM11 16l2 2 4-4M11 24h12"/></svg><p>Здесь будут задачи и замечания</p>';list.append(empty)}else for(const item of agenda){const b=document.createElement('button');b.type='button';b.className='pearl-agenda-row';const title=document.createElement('strong'),detail=document.createElement('small'),arrow=document.createElement('span');title.textContent=item.title;detail.textContent=item.detail;arrow.textContent='›';b.append(title,detail,arrow);b.onclick=()=>show(item.view);list.append(b)}const recipe=recentRecipe(state,lastId);$('pearl-resume-name').textContent=recipe?recipe.name:'Открыть мои техкарты';resume.onclick=()=>recipe?openEditor(recipe):show('recipes');input()}
 return {render,remember};
}
