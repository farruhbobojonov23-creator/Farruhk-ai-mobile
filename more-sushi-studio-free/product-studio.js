/* MORE SUSHI · protected product recipe drafts and menu catalog */
(function(){
'use strict';
const e=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const previous={render:window.renderRecipes,save:window.saveRecipe,open:window.openRecipe,create:window.newRecipe};
let search='',cat='',filterStatus='';
const panel=e('catalogPage').querySelector('.panel');
const control=document.createElement('div');control.id='msProductMenu';
control.innerHTML='<div class="msProductHero"><div><small>МОРЕ СУШИ · STUDIO PRO</small><h2>🍣 Меню и ТТК</h2><p>10 холодных + 10 запечённых. Рецептуры доступны для редактирования.</p></div><strong id="msProductCount">—</strong></div>'+
'<div class="msProductFilters"><input type="search" id="msProductSearch" placeholder="Найти ролл или код">'+
'<select id="msProductCategory"><option value="">Все категории</option><option>Холодные роллы</option><option>Запечённые роллы</option></select>'+
'<select id="msProductStatus"><option value="">Все статусы</option><option>Черновик</option><option>Тест</option><option>Утверждено</option></select></div>'+
'<div class="msProductAlert">⚠ Это технологические черновики: нужны реальные фото, проверка выхода, КБЖУ, аллергенов и срока хранения перед утверждением.</div>';
panel.querySelector('.row.between').after(control);
e('msProductSearch').oninput=ev=>{search=ev.target.value.toLocaleLowerCase('ru').trim();filter()};
e('msProductCategory').onchange=ev=>{cat=ev.target.value;filter()};
e('msProductStatus').onchange=ev=>{filterStatus=ev.target.value;filter()};
const editor=e('editorPage').querySelector('.panel');
const note=document.createElement('section');note.id='msProductEditorNote';
note.innerHTML='<strong>📄 Карточка ролла — ТТК А4</strong><p>Новые рецептуры остаются черновиками. Фактический выход и температурный режим должны быть подтверждены.</p><small id="msProductEditorMass">—</small>';
editor.firstElementChild.after(note);
function filter(){
 if(currentKind!=='product')return;
 const list=recipes.filter(r=>r.kind==='product');
 const rows=Array.from(e('recipeRows').children);let count=0;
 list.forEach((r,i)=>{
  const show=(!cat||r.category===cat)&&(!filterStatus||r.status===filterStatus)&&
   (!search||[r.code,r.name,r.category].some(x=>String(x||'').toLocaleLowerCase('ru').includes(search)));
  if(rows[i])rows[i].style.display=show?'':'none';
  if(show)count++;
 });
 e('msProductCount').textContent=count+'/'+list.length;
}
function render(){
 previous.render();
 control.hidden=currentKind!=='product';
 if(control.hidden)return;
 const list=recipes.filter(r=>r.kind==='product'),rows=Array.from(e('recipeRows').children);
 list.forEach((r,i)=>{
  const row=rows[i];if(!row)return;
  const name=row.querySelector('.ingProductText');
  if(name){
   const lab=document.createElement('div');lab.className='msProductTags';
   lab.textContent=(r.status==='Утверждено'?'✅ Утверждено':'⚠ Требует утверждения')+
    (r.photo_path?' · Фото есть':' · 📷 Фото готового ролла отсутствует');
   name.append(lab);
  }
  const last=row.lastElementChild;
  if(last){
   const a=document.createElement('a');a.className='msProductTtk';
   a.href='./ttk.html?id='+Number(r.id);a.target='_blank';a.rel='noopener';a.textContent='ТТК А4';last.append(a);
  }
 });
 filter();
}
function showNote(){
 note.hidden=currentKind!=='product';if(note.hidden)return;
 const sum=components.reduce((s,c)=>s+Number(c.net_g||0),0);
 e('msProductEditorMass').textContent='Компонентов: '+components.length+' · Сумма нетто: '+sum.toLocaleString('ru-RU',{maximumFractionDigits:2})+' г. Для запечённых роллов выход после запекания измеряется отдельно.';
}
function audit(){
 const issues=[],visited=new Set();
 if(!usageLoaded)issues.push('Нет полного списка связей сырья');
 function ing(id){
  const v=ingredients.find(x=>Number(x.id)===Number(id));
  if(!v){issues.push('Ингредиент не найден');return}
  if(v.allergen_status!=='verified')issues.push('Аллергены: '+v.name);
  const n=v.nutrition_100g||{};
  if(v.nutrition_review_status!=='verified'||!['protein','fat','carbs','kcal'].every(k=>n[k]!=null&&n[k]!==''&&Number.isFinite(Number(n[k]))))issues.push('КБЖУ: '+v.name);
 }
 function pf(id){
  const v=recipes.find(x=>x.kind==='prefab'&&Number(x.id)===Number(id));
  if(!v){issues.push('ПФ не найден');return}
  if(visited.has(Number(id)))return;visited.add(Number(id));
  if(v.status!=='Утверждено')issues.push('Не утверждён ПФ: '+v.name);
  const d=v.ttk_fields?.ultra?.pf_storage||{};
  if(!d.temperature||!(Number(d.hours)>0)||!d.source)issues.push('Хранение ПФ: '+v.name);
  const parts=recipeLines.filter(x=>Number(x.recipe_id)===Number(v.id));
  if(!parts.length)issues.push('ПФ без рецептуры: '+v.name);
  parts.forEach(l=>{if(l.ingredient_id!=null)ing(l.ingredient_id);else if(l.prefab_id!=null)pf(l.prefab_id)});
 }
 components.forEach(c=>c.source_type==='ingredient'?ing(c.source_id):pf(c.source_id));
 return [...new Set(issues)];
}
async function save(){
 if(currentKind!=='product')return previous.save();
 const btn=Array.from(editor.querySelectorAll('button')).find(x=>(x.getAttribute('onclick')||'').includes('saveRecipe()'));
 if(btn?.disabled)return;
 try{
  const val=id=>e(id)?.value.trim()||'';
  const code=val('rCode'),name=val('rName'),status=val('rStatus');
  if(!code||!name)throw Error('Введите код и название товара');
  if(recipes.some(r=>r.code===code&&Number(r.id)!==Number(editing?.id)))throw Error('Такой код ТТК уже существует');
  if(!components.length)throw Error('Добавьте хотя бы один компонент');
  const lines=components.map((c,i)=>{
   const gross=Number(c.gross_g),net=Number(c.net_g),id=Number(c.source_id);
   if(!id||!Number.isFinite(gross)||!Number.isFinite(net)||gross<=0||net<=0||net>gross)throw Error('Ошибка брутто/нетто в строке '+(i+1));
   const found=c.source_type==='ingredient'?ingredients.some(x=>Number(x.id)===id):
     recipes.some(x=>Number(x.id)===id&&x.kind==='prefab');
   if(!found)throw Error('Компонент не найден: строка '+(i+1));
   return {seq:i,ingredient_id:c.source_type==='ingredient'?id:null,prefab_id:c.source_type==='prefab'?id:null,gross_g:gross,net_g:net,line_yield_g:null};
  });
  const total=lines.reduce((sum,x)=>sum+x.net_g,0),output=Number(e('rYield').value);
  if(!Number.isFinite(output)||output<=0||output>total+.01)throw Error('Проверьте выход: сумма нетто '+total.toFixed(1)+' г');
  if(status==='Утверждено'){
   const required=['rScope','rRaw','rProcess','rServing','rQuality','rStorage','rNutrition','rDeveloped','rApproved','rApprovedDate'];
   if(required.some(k=>!val(k)))throw Error('Для утверждения нужны все разделы ТТК и подписи');
   if(/не утвержден|не подтвержден|черновик|теоретическ|требу.*провер|в разработке/i.test(required.map(val).join(' ')))throw Error('В ТТК остались непроверенные значения; утверждение запрещено');
   if(!photoData&&!e('photoFile').files.length)throw Error('Добавьте оригинальную фотографию готового ролла');
   const errors=audit();if(errors.length)throw Error('Не подтверждены исходные данные: '+errors.slice(0,4).join('; '));
   const loss=Number(editing?.ttk_fields?.loss_g||0);
   if(Math.abs(total-loss-output)>.11)throw Error('Уточните технологические потери и фактический выход');
  }
  if(editing?.status==='Утверждено'&&status==='Утверждено')
   throw Error('Перед изменением утверждённой ТТК переведите её в черновик для повторной проверки');
  await uploadPhoto();
  const data={kind:'product',code,name,category:val('rCategory'),status,yield_g:output,
   scope:val('rScope'),raw_requirements:val('rRaw'),process:val('rProcess'),
   serving:val('rServing'),quality:val('rQuality'),storage:val('rStorage'),
   allergens:val('rAllergens'),nutrition:{text:val('rNutrition')},
   developed_by:val('rDeveloped')||null,
   approved_by:status==='Утверждено'?val('rApproved'):null,
   approved_at:status==='Утверждено'?val('rApprovedDate'):null,
   photo_path:photoData,updated_at:new Date().toISOString(),
   ttk_fields:{...(editing?.ttk_fields||{}),menu_draft:status!=='Утверждено',
    safety_review_required:status!=='Утверждено',target_pieces:8,
    photo_status:photoData?'Оригинальное фото':'Нужно оригинальное фото'}};
  if(btn)btn.disabled=true;
  let id;
  if(editing){
   id=Number(editing.id);
   await http('/rest/v1/rpc/save_ttk_document',{method:'POST',body:JSON.stringify({
    p_recipe_id:id,p_expected_version:Number(editing.version),p_patch:data,p_lines:lines})});
  }else{
   const result=await http('/rest/v1/recipes?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...data,version:1})});
   if(!result?.[0]?.id)throw Error('Не удалось сохранить карточку');
   id=Number(result[0].id);
   try{await http('/rest/v1/recipe_lines',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(lines.map(l=>({...l,recipe_id:id})))})}
   catch(error){try{await http('/rest/v1/recipes?id=eq.'+id,{method:'DELETE'})}catch{}throw error}
  }
  await reload();await window.openRecipe(id);
  e('saveInfo').textContent='✓ Сохранено. Версия и ТТК обновлены.';
  e('saveInfo').style.color='#237d5a';
 }catch(error){
  e('saveInfo').textContent='⚠ '+(error?.message||error);
  e('saveInfo').style.color='#b6394e';
 }finally{if(btn)btn.disabled=false}
}
window.renderRecipes=render;
window.saveRecipe=save;
window.openRecipe=async function(id){const result=await previous.open(id);showNote();return result};
window.newRecipe=function(){const result=previous.create();showNote();return result};
e('components').addEventListener('input',()=>{if(currentKind==='product')showNote()});
e('components').addEventListener('change',()=>{if(currentKind==='product')showNote()});
})();