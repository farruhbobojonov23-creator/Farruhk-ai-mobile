// An unfinished form is kept separately from approved recipes and never exported to Google.
export function mountRecipeDraft({editor,store,getEditId,openEditor,getIngredients,addIngredient,refresh,notify}){
 let dirty=false,timer,lastSaved=null,restoring=false;const marker=document.createElement('p');marker.className='chef-draft-status';marker.setAttribute('role','status');editor.querySelector('.chef-mode-tabs').after(marker);
 const recover=document.createElement('button');recover.type='button';recover.className='chef-recover-draft';recover.hidden=true;document.querySelector('#recipes .bar').append(recover);
 function capture(){return {editId:getEditId(),fields:Object.fromEntries([...editor.querySelectorAll('input[id],textarea[id],select[id]')].map(i=>[i.id,i.type==='checkbox'?i.checked:i.value])),ingredients:getIngredients(),at:new Date().toISOString()}}
 async function persist(){if(!dirty||editor.hidden||restoring)return;try{const draft=capture();await store.metaValue('recipe-draft',draft);lastSaved=draft;marker.textContent='Черновик формы сохранён на устройстве · '+new Date(draft.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});recover.hidden=false;recover.textContent='Восстановить черновик'}catch{marker.textContent='Не удалось сохранить черновик. Сохрани ТТК перед выходом.'}}
 function changed(){dirty=true;marker.textContent='Есть изменения · сохраняю черновик…';clearTimeout(timer);timer=setTimeout(persist,500)}
 editor.addEventListener('input',changed);editor.addEventListener('change',changed);
 editor.addEventListener('click',e=>{if(e.target.closest('#addingredient,.ingredient button'))changed()});
 recover.onclick=async()=>{const draft=await store.metaValue('recipe-draft');if(!draft)return;if(dirty&&!confirmLeave())return;restoring=true;try{openEditor({id:draft.editId||undefined,name:draft.fields['recipe-name']||'',category:draft.fields['recipe-category'],ingredients:draft.ingredients});for(const [id,value] of Object.entries(draft.fields)){const i=document.getElementById(id);if(i){if(i.type==='checkbox')i.checked=Boolean(value);else i.value=value}}refresh();dirty=true;marker.textContent='Восстановлен черновик формы. ТТК ещё не сохранена.'}finally{restoring=false}};
 function markClean(){dirty=false;clearTimeout(timer);marker.textContent='Изменения формы сохраняются в черновик автоматически.'}
 async function clear(){markClean();lastSaved=null;recover.hidden=true;await store.metaValue('recipe-draft',null)}
 function confirmLeave(){if(!dirty)return true;persist();return window.confirm('Есть несохранённые изменения ТТК. Выйти из формы? Черновик останется на этом устройстве.')}
 window.addEventListener('beforeunload',e=>{if(dirty&&!editor.hidden){persist();e.preventDefault();e.returnValue=''}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)persist()});
 async function start(){lastSaved=await store.metaValue('recipe-draft');recover.hidden=!lastSaved;if(lastSaved)recover.textContent='Восстановить черновик · '+(lastSaved.fields?.['recipe-name']||'без названия')}
 return {get dirty(){return dirty},changed,markClean,clear,confirmLeave,start,persist};
}
