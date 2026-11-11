/* MORE SUSHI · ingredient labels, confirmation and live recipe values */
(function(){
'use strict';
const e=id=>document.getElementById(id);
const number=v=>Number(String(v??'').replace(',','.'));
const fmt=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1});
const state={photo:null,ocrImage:null,text:'',original:null,busy:false,lastOcrFilled:[]};
const nutritionFields={protein:'ingNProtein',fat:'ingNFat',carbs:'ingNCarbs',kcal:'ingNKcal'};
let summary=new Map();
function banner(text,error=false){e('msLabelMessage').textContent=text;e('msLabelMessage').style.color=error?'#bd3647':'#146583'}
function markPending(){e('msAllergenVerified').checked=false;e('msNutritionVerified').checked=false;badge()}
function badge(){e('msVerifiedBadge').textContent=e('msAllergenVerified').checked&&e('msNutritionVerified').checked?'✅ Сверено': '⚠ Требует проверки'}
function preview(data){const image=e('msLabelPreview');image.hidden=!data;if(data)image.src=data;else image.removeAttribute('src')}
async function scaledImage(file,maxEdge=1600){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>9e6)throw Error('Нужен JPG/PNG/WEBP до 9 МБ');
 const raw=await new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=bad;r.readAsDataURL(file)});
 const img=await new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=raw});
 const rate=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
 c.width=Math.round(img.naturalWidth*rate);c.height=Math.round(img.naturalHeight*rate);
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 return c.toDataURL('image/webp',0.86);
}
async function imageToRecognize(){
 if(state.ocrImage)return state.ocrImage;
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
function parseLabel(raw) {
 const t=String(raw||'').normalize('NFKC').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/：/g,':');
 const lines=t.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const tokens={
  protein:[/\bprotein(?:s)?\b/i,/белк(?:и|ов|а)?/i],
  fat:[/\bfats?\b/i,/жир(?:ы|ов|а)?/i],
  carbs:[/\bcarbohydrates?\b/i,/углевод(?:ы|ов|а)?/i]
 };
 const values={protein:null,fat:null,carbs:null,kcal:null};
 function directValue(line,label) {
  const m=line.match(label);if(!m)return null;
  let tail=line.slice(m.index+m[0].length);
  // Common manufacturer labels: Белки, г: 7,1; Proteins (g) 7.1
  tail=tail.replace(/^[\s:—–\-.,|/()\[\]гg]{0,18}/i,'');
  const v=tail.match(/^(\d{1,3}(?:[.,]\d{1,3})?)(?:\s|$|г(?=\s|$|[;,./])|g\b|[;,|])/i);
  if(!v)return null;
  const n=number(v[1]);
  return Number.isFinite(n)&&n>=0&&n<=100?n:null;
 }
 for(const [k,patterns] of Object.entries(tokens)) {
  for(const line of lines) {
   for(const pattern of patterns) {
    const v=directValue(line,pattern);
    if(v!==null) { values[k]=v;break }
   }
   if(values[k]!==null)break;
  }
 }
 // kJ is NOT kcal. Search for the number attached explicitly to kcal.
 for(const line of lines) {
  let matches=[...line.matchAll(/(\d{1,4}(?:[.,]\d+)?)\s*(?:ккал|kcal)(?=\s|[.,;)]|$)/gi)];
  if(matches.length) {values.kcal=number(matches[matches.length-1][1]);break}
  const forward=line.match(/(?:ккал|kcal)\s*[:=—–-]?\s*(\d{1,4}(?:[.,]\d+)?)/i);
  if(forward){values.kcal=number(forward[1]);break}
  if(/(?:калорийность|энергетическая ценность)/i.test(line) && !/(?:кДж|kj)/i.test(line)) {
   const m=line.match(/(?:калорийность|энергетическая ценность)\s*[:=—–-]?\s*(\d{1,4}(?:[.,]\d+)?)/i);
   if(m){values.kcal=number(m[1]);break}
  }
 }
 if(values.kcal!==null && (!Number.isFinite(values.kcal)||values.kcal<0||values.kcal>950))values.kcal=null;
 // Typical nutrition table: a heading line followed by values in the same order.
 if(Object.values(values).filter(v=>v!==null).length<=1) {
  for(let j=0;j<lines.length-1;j++){
   if(/белк|protein/i.test(lines[j])&&/жир|fat/i.test(lines[j])&&/углевод|carb/i.test(lines[j])) {
    const chunks=(lines[j+1]||'').match(/\d{1,4}(?:[.,]\d{1,3})?/g)||[];
    if(chunks.length>=4) {
     const nums=chunks.slice(0,4).map(number);
     if(nums.slice(0,3).every(v=>v>=0&&v<=100)&&nums[3]>=0&&nums[3]<=950)
       ['protein','fat','carbs','kcal'].forEach((k,z)=>{if(values[k]===null)values[k]=nums[z]});
    }
   }
  }
 }
 const companyKeys=/^(?:изготовител[ьи]|производител[ьи]|произведено|организация[- ]изготовитель|manufacturer|produced by)(?=\s|[:—-]|$)\s*[:—-]?/i;
 let manufacturer='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i],m=line.match(companyKeys);
  if(!m)continue;
  const value=(line.slice(m[0].length).trim()||lines[i+1]||'').slice(0,180);
  if(value.length>=3&&!/^(?:белки|жиры|ккал|состав|storage)/i.test(value))manufacturer=value;
  break;
 }
 let storage='';
 const validStorage=s=> /[-+]?\d{1,2}\s*(?:°|градус|[CcСс]\b)|(?:от\s*[-+]?\d{1,2}\s*до\s*\+?\d{1,2})|(?:сухом|прохладном|темном|тёмном)\s+месте|(?:store|keep)\s+(?:refrigerated|frozen|at\s+[-+]?\d)/i.test(s);
 for(let i=0;i<lines.length;i++){
  if(!/условия хранени|хранить при|температура хранени|режим хранени|store at|keep refrigerated/i.test(lines[i]))continue;
  const candidate=(validStorage(lines[i])?lines[i]:lines[i]+' '+(lines[i+1]||'')).split(/(?:срок (?:годности|хранения)|manufacturer|изготовитель|производитель)\s*[:—-]?/i)[0].slice(0,200).trim();
  if(validStorage(candidate))storage=candidate;
  break;
 }
 const life=t.match(/(?:срок (?:годности|хранения)|shelf life)\s*[:—-]?\s*(\d+(?:[.,]\d+)?)\s*(час(?:ов|а)?|ч|сут(?:ок|ки)?|дн(?:ей|я|ь)|days?|hours?)(?=\s|[,.;]|$)/i);
 let hours=null;
 if(life)hours=number(life[1])*(/^(?:час|ч\b|hour)/i.test(life[2])?1:24);
 if(hours!==null&&(!Number.isFinite(hours)||hours<=0))hours=null;
 const warning=lines.filter(s=>/(?:аллерген|содержит|contains)/i.test(s)&&!/не содержит|может содержать|may contain|следы/i.test(s)).join(' ');
 const tracesText=lines.filter(s=>/может содержать|may contain|следы/i.test(s)).join(' ');
 let composition=lines.filter(s=>/(?:^|\s)состав\s*[:—-]|ingredients\s*:/i.test(s)).join(' ');
 if(composition.length<20)composition='';
 const source=warning+' '+composition;
 const allergens={
  'рыба':/рыб|лосос|форел|тунец|salmon|fish/i,'молоко':/молок|лактоз|сливк|milk|lactose/i,
  'яйцо':/яйц|яичн|egg/i,'соя':/соев|соя|soy/i,
  'пшеница':/пшениц|глютен|wheat|gluten/i,'ракообразные':/кревет|ракообраз|shrimp|crustacean/i,
  'моллюски':/моллюск|mollusc/i,'кунжут':/кунжут|sesame/i,
  'горчица':/горчиц|mustard/i,'орехи':/орех|nuts?\b/i,'арахис':/арахис|peanut/i,
  'сельдерей':/сельдерей|celery/i,'люпин':/люпин|lupin/i,'сульфиты':/сульфит|sulphite/i
 };
 const allergenNames=Object.entries(allergens).filter(([_,re])=>re.test(source)).map(([k])=>k);
 const traces=Object.entries(allergens).filter(([_,re])=>re.test(tracesText)).map(([k])=>k);
 const basis=/(?:на|в)\s*100\s*г|per\s*100\s*g/i.test(t)?'100g':/на\s*(?:одну\s*)?порци|per\s*serving/i.test(t)?'serving':'unspecified';
 return {macros:values,manufacturer,storage,hours,allergens:allergenNames,traces,basis,
   nutritionCount:Object.values(values).filter(v=>v!==null).length};
}
function applyText() {
 const d=parseLabel(e('msLabelText').value);
 const changed=[];
 if(d.basis==='serving'){
  // Values for a portion cannot safely be stored as 100 g.
  banner('⚠ На этикетке указана пищевая ценность на порцию, а не на 100 г. Пересчитайте по подтверждённой массе порции.',true);
  e('msLabelDetails').open=true;return d;
 }
 if(d.manufacturer){e('ingManufacturer').value=d.manufacturer;changed.push('производитель')}
 if(d.storage){e('ingStorage').value=d.storage;changed.push('хранение')}
 else if(/^[«"' ]*условия хранени[^\n]{0,130}stor[ae]?\s*$/i.test(e('ingStorage').value))e('ingStorage').value='';
 if(d.hours!==null){e('ingShelfLife').value=String(d.hours);changed.push('срок')}
 if(d.allergens.length){e('ingAllergens').value=d.allergens.join(', ');changed.push('аллергены')}
 // Do not mix nutrition numbers from different OCR passes with existing fields.
 for(const k of Object.keys(nutritionFields)){
  const id=nutritionFields[k];
  if(d.macros[k]!==null){e(id).value=String(d.macros[k]);changed.push(k)}
  else if(state.lastOcrFilled?.includes(k)){e(id).value=''}
 }
 state.lastOcrFilled=Object.keys(d.macros).filter(k=>d.macros[k]!==null);
 if(d.nutritionCount===4)e('ingNSource').value='Фото этикетки производителя — требуется сверка';
 else if(e('ingNSource').value.startsWith('Фото этикетки производителя'))e('ingNSource').value='';
 e('ingNutritionPanel').open=true;markPending();
 if(d.nutritionCount<4){
  const missing=Object.keys(d.macros).filter(k=>d.macros[k]===null).map(k=>({protein:'белки',fat:'жиры',carbs:'углеводы',kcal:'ккал'}[k]));
  banner('Распознано '+d.nutritionCount+' из 4 значений КБЖУ. Не найдены: '+missing.join(', ')+'. Сфотографируйте этикетку крупнее или дополните вручную.',true);
 }else banner('✅ Все 4 показателя КБЖУ распознаны. Сверьте с этикеткой и подтвердите.'+(d.traces?.length?' Возможные следы аллергенов: '+d.traces.join(', ')+'.':''));
 return d;
}
async function enhancePicture(uri) {
 const img=await new Promise((ok,bad)=>{const x=new Image();x.onload=()=>ok(x);x.onerror=bad;x.src=uri});
 const scale=Math.min(2.2,3300/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
 c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);
 const ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(img,0,0,c.width,c.height);
 const data=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<data.data.length;i+=4){
  const lum=0.299*data.data[i]+0.587*data.data[i+1]+0.114*data.data[i+2];
  const v=Math.max(0,Math.min(255,(lum-128)*1.45+148));
  data.data[i]=data.data[i+1]=data.data[i+2]=v;
 }
 ctx.putImageData(data,0,0);
 return c.toDataURL('image/png');
}
async function recognize() {
 if(state.busy)return;
 const btn=e('msReadLabel');btn.disabled=true;state.busy=true;
 let worker;
 try {
  const picture=await imageToRecognize();
  if(!picture)throw Error('Сначала выберите фото продукта с этикеткой справа или крупное фото этикетки.');
  banner('Распознаю этикетку…');
  const engine=await getOcr();
  worker=await engine.createWorker('rus+eng',1,{logger:p=>{
   if(p.status==='recognizing text')banner('Читаю этикетку: '+Math.round((p.progress||0)*100)+'%');
  }});
  const first=await worker.recognize(picture);
  let chosen=String(first?.data?.text||'').trim();
  const firstScore=parseLabel(chosen);
  if(firstScore.nutritionCount<4){
   banner('Проверяю мелкий текст вторым способом…');
   try {
    const next=await worker.recognize(await enhancePicture(picture));
    const alternative=String(next?.data?.text||'').trim();
    const a=parseLabel(alternative);
    const score=x=>x.nutritionCount*5+Number(Boolean(x.manufacturer))+Number(Boolean(x.storage))+Number(x.allergens.length>0);
    if(score(a)>score(firstScore))chosen=alternative;
   }catch(error){console.warn('Повторное распознавание:',error.message)}
  }
  if(chosen.length<10)throw Error('Этикетка нечитаемая. Сделайте отдельное фото этикетки крупным планом.');
  state.text=chosen.slice(0,20000);
  e('msLabelText').value=state.text;
  e('msLabelDetails').open=true;
  applyText();
 }catch(error){banner('⚠ '+(error?.message||'Не удалось распознать текст'),true)}
 finally{if(worker)try{await worker.terminate()}catch{}btn.disabled=false;state.busy=false}
}
function reset(){
 state.photo=null;state.ocrImage=null;state.text='';state.original=null;state.lastOcrFilled=[];
 e('msLabelFile').value='';e('msLabelText').value='';e('msLabelSource').value='';
 preview(null);markPending();banner('');
}
function edit(item){
 state.original=item;state.photo=item.label_photo_data||null;state.ocrImage=null;state.lastOcrFilled=[];state.text=String(item.label_extraction_draft?.text||'');
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
 '<div class="msLabelControls"><button class="secondary" type="button" id="msReadLabel">✨ Распознать с фотографии</button><button class="secondary" type="button" id="msApplyLabel">↳ Заполнить поля из текста</button><small>При выборе отдельного фото распознавание запускается само. Для общего фото этикетка должна быть справа.</small><span id="msLabelMessage" aria-live="polite"></span></div></div>',
 '<details id="msLabelDetails"><summary>Текст этикетки — посмотреть и исправить</summary><textarea id="msLabelText" rows="5" placeholder="Распознанный текст или текст с этикетки вручную"></textarea><input id="msLabelSource" placeholder="Артикул или ссылка на спецификацию"></details>',
 '<div class="msLabelVerify"><label><input id="msAllergenVerified" type="checkbox"> Аллергены сверены с упаковкой</label><label><input id="msNutritionVerified" type="checkbox"> КБЖУ на 100 г сверено с упаковкой</label></div>',
 '<p class="msLabelNote">OCR может ошибаться. Подтверждение — только после проверки. Срок готового ПФ и готового ролла устанавливается отдельно.</p>'
 ].join('');
 const visual=document.querySelector('#ingredientFormPanel .msIngredientVisualEditor');
 if(visual)visual.after(panel);else e('ingNutritionPanel').before(panel);
 const ingActions=e('ingSaveBtn')?.closest('.actions');
 if(ingActions)e('ingNutritionPanel').after(ingActions);
 const box=document.createElement('div');box.id='msRecipeAuto';box.className='msRecipeAuto';box.hidden=true;e('components').after(box);
 e('msLabelFile').onchange=async ev=>{try{const file=ev.target.files?.[0];if(!file)return;state.photo=await scaledImage(file);state.ocrImage=await scaledImage(file,2600);preview(state.photo);markPending();await recognize()}catch(ex){banner(ex.message,true)}};
 e('msReadLabel').onclick=recognize;e('msApplyLabel').onclick=()=>{state.text=e('msLabelText').value.slice(0,20000);applyText()};
 e('msLabelText').oninput=()=>{state.text=e('msLabelText').value.slice(0,20000);markPending()};
 e('msAllergenVerified').onchange=badge;e('msNutritionVerified').onchange=badge;
 e('ingAllergens').addEventListener('input',()=>{e('msAllergenVerified').checked=false;badge()});
 e('ingAllergenChips')?.addEventListener('click',()=>{e('msAllergenVerified').checked=false;badge()});
 Object.values(nutritionFields).forEach(id=>e(id).addEventListener('input',()=>{e('msNutritionVerified').checked=false;badge()}));

 // A two-sided ingredient photo may contain the original manufacturer label on the right.
 const productFile=e('msIngredientFile');
 if(productFile)productFile.addEventListener('change',async ev=>{
  if(!ev.target.files?.[0]||state.photo||state.busy)return;
  // Let the existing photo uploader finish updating its preview before OCR.
  await new Promise(ok=>setTimeout(ok,450));
  if(window.MSIcons?.getIngredientPhoto?.())await recognize();
 });
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