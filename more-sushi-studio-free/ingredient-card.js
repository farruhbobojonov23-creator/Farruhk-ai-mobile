/* MORE SUSHI · ingredient labels, confirmation and live recipe values */
(function(){
'use strict';
const e=id=>document.getElementById(id);
const number=v=>Number(String(v??'').replace(',','.'));
const fmt=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1});
const state={photo:null,text:'',original:null};
const nutritionFields={protein:'ingNProtein',fat:'ingNFat',carbs:'ingNCarbs',kcal:'ingNKcal'};
let summary=new Map();
function banner(text,error=false){e('msLabelMessage').textContent=text;e('msLabelMessage').style.color=error?'#bd3647':'#146583'}
function markPending(){e('msAllergenVerified').checked=false;e('msNutritionVerified').checked=false;badge()}
function badge(){e('msVerifiedBadge').textContent=e('msAllergenVerified').checked&&e('msNutritionVerified').checked?'✅ Сверено': '⚠ Требует проверки'}
function preview(data){const image=e('msLabelPreview');image.hidden=!data;if(data)image.src=data;else image.removeAttribute('src')}
async function scaledImage(file){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>9e6)throw Error('Нужен JPG/PNG/WEBP до 9 МБ');
 const raw=await new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=bad;r.readAsDataURL(file)});
 const img=await new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=raw});
 const rate=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
 c.width=Math.round(img.naturalWidth*rate);c.height=Math.round(img.naturalHeight*rate);
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 return c.toDataURL('image/webp',0.86);
}
async function imageToRecognize(){
 if(state.photo)return state.photo;
 const source=window.MSIcons?.getIngredientPhoto?.()||state.original?.photo_data;
 if(!source)return null;
 const image=await new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=source});
 // Our approved product image: front LEFT, reverse with label RIGHT.
 const c=document.createElement('canvas'),w=image.naturalWidth,h=image.naturalHeight;
 c.width=Math.round(w*.49);c.height=h;
 c.getContext('2d').drawImage(image,w*.51,0,w*.49,h,0,0,c.width,c.height);
 return c.toDataURL('image/png');
}
let ocrLoader;
async function getOcr(){
 if(window.Tesseract)return window.Tesseract;
 if(!ocrLoader)ocrLoader=new Promise((ok,bad)=>{
 const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
 s.onload=()=>window.Tesseract?ok(window.Tesseract):bad(Error('OCR недоступен'));
 s.onerror=()=>bad(Error('Модуль распознавания не загрузился. Можно вставить текст вручную.'));document.head.appendChild(s)
 }).catch(ex=>{ocrLoader=null;throw ex});
 return ocrLoader;
}
function parseLabel(raw){
 const t=String(raw||'').replace(/[ \t]+/g,' '),lines=t.split(/\r?\n/);
 const find=(patterns)=>{
 for(const p of patterns){const m=t.match(new RegExp('(?:'+p+')\\s*(?:г(?:рамм)?)?\\s*[:—–-]?\\s*(\\d{1,4}(?:[.,]\\d{1,3})?)','i'));if(m)return number(m[1])}
 return null;
 };
 const macros={
 protein:find(['белк(?:и|ов)?','protein']),
 fat:find(['жир(?:ы|ов)?','fat']),
 carbs:find(['углевод(?:ы|ов)?','carbohydrates?']),
 kcal:find(['ккал','калори[а-я]*'])
 };
 if(macros.kcal==null){const m=t.match(/(\d{2,4}(?:[.,]\d+)?)\s*(?:ккал|kcal)/i);if(m)macros.kcal=number(m[1])}
 const manufacturerLine=lines.find(l=>/^(?:изготовитель|производитель|произведено|организация-изготовитель)\s*[:—-]/i.test(l));
 const storageLine=lines.find(l=>/условия хранения|хранить при|температура хранения/i.test(l));
 const life=t.match(/срок (?:годности|хранения)\s*[:—-]?\s*(\d+(?:[.,]\d+)?)\s*(час(?:а|ов)?|сут(?:ок|ки)?|дн(?:ей|я|ь))/i);
 const alerts=lines.filter(l=>/содержит|аллерген|может содержать|следы/i.test(l)).join(' ');
 const groups={рыба:/рыб|лосос|форел/i,молоко:/молок|лактоз/i,яйцо:/яйц/i,соя:/соев|соя/i,пшеница:/пшениц|глютен/i,ракообразные:/кревет|ракообраз/i,моллюски:/моллюск/i,кунжут:/кунжут/i,горчица:/горчиц/i,орехи:/орех/i,арахис:/арахис/i,сельдерей:/сельдерей/i,люпин:/люпин/i,сульфиты:/сульфит/i};
 return {macros,manufacturer:manufacturerLine?.replace(/^[^:—-]+[:—-]\s*/,'').trim()||'',storage:storageLine?.trim()||'',hours:life?number(life[1])*(life[2].startsWith('час')?1:24):null,allergens:Object.keys(groups).filter(k=>groups[k].test(alerts))};
}
function applyText(){
 const d=parseLabel(e('msLabelText').value);
 if(d.manufacturer)e('ingManufacturer').value=d.manufacturer.slice(0,160);
 if(d.storage)e('ingStorage').value=d.storage.slice(0,160);
 if(d.hours!=null)e('ingShelfLife').value=String(d.hours);
 if(d.allergens.length)e('ingAllergens').value=d.allergens.join(', ');
 for(const k of Object.keys(nutritionFields))if(d.macros[k]!=null&&d.macros[k]>=0)e(nutritionFields[k]).value=String(d.macros[k]);
 if(Object.values(d.macros).every(v=>v!=null)&&!e('ingNSource').value)e('ingNSource').value='Этикетка производителя — после сверки';
 e('ingNutritionPanel').open=true;markPending();
 banner('Предварительные данные перенесены в карточку. Проверьте цифры по этикетке.');
}
async function recognize(){
 const btn=e('msReadLabel');btn.disabled=true;let worker;
 try{
 const picture=await imageToRecognize();if(!picture)throw Error('Добавьте фото этикетки либо общий снимок продукта с этикеткой справа');
 banner('Распознавание русского текста…');
 const engine=await getOcr();
 worker=await engine.createWorker('rus+eng',1,{logger:p=>{if(p.status==='recognizing text')banner('Распознавание '+Math.round((p.progress||0)*100)+'%')}});
 const result=await worker.recognize(picture),text=String(result?.data?.text||'').trim();
 if(text.length<12)throw Error('Этикетка слишком мелкая. Добавьте отдельное крупное фото.');
 state.text=text.slice(0,20000);e('msLabelText').value=state.text;e('msLabelDetails').open=true;applyText();
 banner('Текст распознан. Ничего не подтверждено автоматически: проверьте данные.');
 }catch(ex){banner(ex.message||'Ошибка OCR',true)}finally{if(worker)try{await worker.terminate()}catch{}btn.disabled=false}
}
function reset(){
 state.photo=null;state.text='';state.original=null;
 e('msLabelFile').value='';e('msLabelText').value='';e('msLabelSource').value='';
 preview(null);markPending();banner('');
}
function edit(item){
 state.original=item;state.photo=item.label_photo_data||null;state.text=String(item.label_extraction_draft?.text||'');
 e('msLabelText').value=state.text;e('msLabelSource').value=item.label_source_notes||'';
 e('msAllergenVerified').checked=item.allergen_status==='verified';
 e('msNutritionVerified').checked=item.nutrition_review_status==='verified';
 preview(state.photo);badge();banner('');
}
function payload(){
 const filled=Object.values(nutritionFields).every(id=>e(id).value!=='');
 const a=e('msAllergenVerified').checked,n=e('msNutritionVerified').checked&&filled&&!!e('ingNSource').value.trim();
 const hasPhoto=!!(state.photo||state.original?.photo_data||window.MSIcons?.getIngredientPhoto?.());
 return {
 label_photo_data:state.photo,
 label_extraction_draft:state.text?{text:state.text,source:'ocr_draft_unverified'}:{},
 label_source_notes:e('msLabelSource').value.trim(),
 label_review_status:(a&&n&&hasPhoto)?'verified':(state.text||hasPhoto?'needs_review':'pending'),
 label_reviewed_at:a&&n&&hasPhoto?new Date().toISOString():null,
 allergen_status:a?'verified':(e('ingAllergens').value.trim()?'typical':'pending'),
 nutrition_review_status:n?'verified':(filled?'needs_review':'pending')
 };
}
function showAuto(id){
 const x=summary.get(Number(id)),box=e('msRecipeAuto');
 box.hidden=!x;if(!x)return;
 const tags=x.nutrition_verified&&x.allergens_verified?'✅ Сведения проверены':'⚠ Требуется проверка исходного сырья';
 const nutr=x.nutrition_complete?'На 100 г: Б '+fmt(x.protein_per_100g)+' · Ж '+fmt(x.fat_per_100g)+' · У '+fmt(x.carbs_per_100g)+' · '+fmt(x.kcal_per_100g)+' ккал. На порцию: '+fmt(x.kcal_per_portion)+' ккал.':'Нет данных КБЖУ: '+(x.missing_nutrition_ingredients||'сырьё не заполнено');
 box.innerHTML='<h3>🧬 Авторасчёт ингредиенты → ПФ → ТТК</h3><div class="msAutoStatus">'+tags+'</div><p><b>Аллергены:</b> '+esc(x.calculated_allergens||'не подтверждены')+'</p><p>'+esc(nutr)+'</p><small>Производители сырья: '+esc(x.source_manufacturers||'не указаны')+'. Производитель готового блюда задаётся отдельно. Срок и температура готового блюда не копируются из сырья.</small><div><button type="button" id="msApplyAutoTtk" '+(x.nutrition_verified&&x.allergens_verified?'':'disabled')+'>↳ Перенести проверенные КБЖУ и аллергены в ТТК</button></div>';
 e('msApplyAutoTtk').onclick=()=>{
  e('rAllergens').value=x.calculated_allergens||'По документам поставщиков аллергены не указаны';
  e('rNutrition').value='На 100 г: белки '+fmt(x.protein_per_100g)+' г; жиры '+fmt(x.fat_per_100g)+' г; углеводы '+fmt(x.carbs_per_100g)+' г; '+fmt(x.kcal_per_100g)+' ккал. На порцию ('+fmt(x.yield_g)+' г): белки '+fmt(x.protein_per_portion)+' г; жиры '+fmt(x.fat_per_portion)+' г; углеводы '+fmt(x.carbs_per_portion)+' г; '+fmt(x.kcal_per_portion)+' ккал.';
  e('rAllergens').dispatchEvent(new Event('input',{bubbles:true}));e('rNutrition').dispatchEvent(new Event('input',{bubbles:true}));
  e('saveInfo').textContent='Данные перенесены. Нажмите Сохранить карточку.';
 };
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function start(){
 const panel=document.createElement('section');panel.id='msLabelCard';
 panel.innerHTML=[
 '<div class="msLabelTop"><strong>🏷️ Карточка товара · данные по этикетке</strong><span id="msVerifiedBadge">⚠ Требует проверки</span></div>',
 '<div class="msLabelBody"><label class="msLabelPhoto">📷 Фото этикетки<input type="file" id="msLabelFile" accept="image/jpeg,image/png,image/webp"><img id="msLabelPreview" alt="Этикетка" hidden></label>',
 '<div class="msLabelControls"><button class="secondary" type="button" id="msReadLabel">✨ Распознать с фотографии</button><button class="secondary" type="button" id="msApplyLabel">↳ Заполнить поля из текста</button><small>Можно использовать уже загруженное фото: этикетка должна быть справа по нашему эталону.</small><span id="msLabelMessage" aria-live="polite"></span></div></div>',
 '<details id="msLabelDetails"><summary>Текст этикетки — посмотреть и исправить</summary><textarea id="msLabelText" rows="5" placeholder="Распознанный текст или текст с этикетки вручную"></textarea><input id="msLabelSource" placeholder="Артикул или ссылка на спецификацию"></details>',
 '<div class="msLabelVerify"><label><input id="msAllergenVerified" type="checkbox"> Аллергены сверены с упаковкой</label><label><input id="msNutritionVerified" type="checkbox"> КБЖУ на 100 г сверено с упаковкой</label></div>',
 '<p class="msLabelNote">OCR может ошибаться. Подтверждение — только после проверки. Срок готового ПФ и готового ролла устанавливается отдельно.</p>'
 ].join('');
 const visual=document.querySelector('#ingredientFormPanel .msIngredientVisualEditor');
 if(visual)visual.after(panel);else e('ingNutritionPanel').before(panel);
 const box=document.createElement('div');box.id='msRecipeAuto';box.className='msRecipeAuto';box.hidden=true;e('components').after(box);
 e('msLabelFile').onchange=async ev=>{try{state.photo=await scaledImage(ev.target.files[0]);preview(state.photo);markPending();banner('Фото добавлено')}catch(ex){banner(ex.message,true)}};
 e('msReadLabel').onclick=recognize;e('msApplyLabel').onclick=()=>{state.text=e('msLabelText').value.slice(0,20000);applyText()};
 e('msLabelText').oninput=()=>{state.text=e('msLabelText').value.slice(0,20000);markPending()};
 e('msAllergenVerified').onchange=badge;e('msNutritionVerified').onchange=badge;
 e('ingAllergens').addEventListener('input',()=>{e('msAllergenVerified').checked=false;badge()});
 e('ingAllergenChips')?.addEventListener('click',()=>{e('msAllergenVerified').checked=false;badge()});
 Object.values(nutritionFields).forEach(id=>e(id).addEventListener('input',()=>{e('msNutritionVerified').checked=false;badge()}));
 const oldReload=window.reload;
 window.reload=async function(...args){
   const result=await oldReload.apply(this,args);
   try{const rows=await http('/rest/v1/ms_recipe_auto_summary?select=*');summary=new Map(rows.map(r=>[Number(r.recipe_id),r]))}
   catch(ex){console.warn('Расчёт:',ex.message);summary=new Map()}
   if(editing?.id)showAuto(editing.id);
   return result;
 };
 const oldOpen=window.openRecipe;
 window.openRecipe=async function(id){const result=await oldOpen.call(this,id);showAuto(id);return result};
 window.MSIngredientCard={payload,reset,edit};
}
start();
})();