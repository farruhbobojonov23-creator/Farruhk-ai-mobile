// Commands edit the actual visible form. No generated reply can mutate records.
export const cleanSpeech = value => String(value || '').trim().replace(/[.!?]+$/, '').replace(/ё/gi, 'е');
const numberWords = {ноль:0,нуль:0,один:1,одна:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900};
export function speechNumber(value) {
 const text=cleanSpeech(value).toLowerCase().replace(/\s*(?:грамм(?:а|ов)?|процент(?:а|ов)?|штук(?:и)?|рубл(?:ь|я|ей))\s*$/u,'').trim();
 if(/^-?\d+(?:[,.]\d+)?$/.test(text))return Number(text.replace(',','.'));
 const tokens=text.split(/\s+/);let result=0,current=0;
 for(const token of tokens){if(token==='тысяча'||token==='тысячи'||token==='тысяч'){result+=(current||1)*1000;current=0}else if(Object.hasOwn(numberWords,token))current+=numberWords[token];else return null}
 return tokens.length&&text?result+current:null;
}
const sections={главную:'home',главная:'home',задачи:'tasks',техкарты:'recipes',ттк:'recipes',хассп:'lab',хасп:'lab',калькулятор:'calc',проверки:'checks',ассистент:'chat',заготовки:'preparations','контроль точек':'checks'};
export function parseWorkbenchCommand(raw){
 const text=cleanSpeech(raw), lower=text.toLowerCase();let m;
 const journals={'уборки':'cleaning','уборок':'cleaning','температур':'temperature','температуры':'temperature','температуры холодильников':'temperature','влажности':'humidity','приемки':'receiving','приемки продуктов':'receiving','хранения':'storage','приготовления':'cooking','размораживания':'defrosting','качества':'quality','гигиены':'hygiene','персонала':'hygiene','вредителей':'pests','фритюра':'frying','аудита':'audit','упаковки':'packaging','маркировки':'packaging','упаковки и маркировки':'packaging'};
 if((m=lower.match(/^(?:открой|открыть|покажи)\s+журнал\s+(.+)$/u))&&journals[m[1]])return {type:'journal',kind:journals[m[1]]};
 if((m=lower.match(/^(?:открой|открыть|перейди в|перейди на|покажи)\s+(?:раздел\s+)?(.+)$/u))&&sections[m[1]])return {type:'navigate',view:sections[m[1]]};
 if((m=text.match(/^(?:создай|создать|новая|открой новую)\s+(?:ттк|техкарту|рецептуру)(?:\s+(.+))?$/iu)))return {type:'new-recipe',name:(m[1]||'').replace(/^(?:с названием|название)\s+/iu,'')};
 if(/^(?:сохрани|сохранить)\s+(?:ттк|техкарту|рецептуру)$/iu.test(text))return {type:'save-recipe'};
 if((m=text.match(/^(?:добавь|добавить)\s+ингредиент\s+(.+?)\s+нетто\s+(.+?)(?:\s+отход[ыа]?\s+(.+))?$/iu))){
  const grams=speechNumber(m[2]),loss=m[3]===undefined?null:speechNumber(m[3]);
  if(grams===null||grams<=0||loss!==null&&(loss<0||loss>=100))return {type:'error',message:'Укажи нетто больше нуля и отходы от 0 до 99 процентов.'};
  return {type:'ingredient',name:m[1].trim(),grams,lossPercent:loss};
 }
 if((m=text.match(/^(?:заполни|заполнить|измени|укажи)\s+(?:поле\s+)?(.+?)\s*(?::|\sзначением\s|\sна\s)\s*(.+)$/iu)))return {type:'field',label:m[1].trim(),value:m[2].trim()};
 if((m=text.match(/^(?:впиши|продиктуй|запиши в поле|добавь в поле)\s+(.+)$/iu)))return {type:'dictate',value:m[1].trim()};
 if((m=text.match(/^(название блюда|название|категория|технология|подготовка|подача|хранение|внешний вид|вкус|количество штук|номер ттк)\s*[:—-]?\s+(.+)$/iu)))return {type:'field',label:m[1],value:m[2].trim()};
 if(/^(?:что ты умеешь|помощь|команды|голосовые команды)$/iu.test(text))return {type:'help'};
 return null;
}
const aliases={название:'recipe-name','название блюда':'recipe-name',категория:'recipe-category',статус:'recipe-status',технология:'technology',подготовка:'card-prep',подача:'card-serving',хранение:'card-storage','срок хранения':'card-storage',вкус:'card-taste','внешний вид':'card-appearance',шеф:'card-chef',утверждаю:'card-approver','номер ттк':'card-number',штуки:'card-pieces','количество штук':'card-pieces',задача:'tasktext','текст задачи':'tasktext','дата задачи':'taskdue',замечание:'checktext',ответственный:'owner',точка:'point','количество порций':'portions'};
export function fieldLabel(field){return field.getAttribute('aria-label')||field.labels?.[0]?.childNodes?.[0]?.textContent?.trim()||field.placeholder||field.name||field.id}
export function findVoiceField(label,fields){
 const key=cleanSpeech(label).toLowerCase(),id=aliases[key];
 if(id){const exact=fields.find(f=>f.id===id);if(exact)return exact}
 const exact=fields.filter(f=>cleanSpeech(fieldLabel(f)).toLowerCase().replace(/[,:]\s*$/,'')===key);
 if(exact.length===1)return exact[0];
 const matches=fields.filter(f=>cleanSpeech(fieldLabel(f)).toLowerCase().startsWith(key));
 return matches.length===1?matches[0]:null;
}
export function normalizeFieldValue(field,value){
 if(field.tagName==='SELECT'){
  const key=cleanSpeech(value).toLowerCase();const matches=[...field.options].filter(o=>cleanSpeech(o.textContent).toLowerCase()===key||o.value.toLowerCase()===key);
  if(matches.length!==1)throw Error('Назови один из вариантов: '+[...field.options].map(o=>o.textContent).join(', '));
  return matches[0].value;
 }
 if(field.type==='number'){
  const n=speechNumber(value);if(n===null||field.min!==''&&n<Number(field.min)||field.max!==''&&n>Number(field.max))throw Error('Уточни допустимое число для поля «'+fieldLabel(field)+'».');return String(n);
 }
 if(field.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Назови дату в формате год-месяц-день.');
 if(field.type==='datetime-local'&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Для срока задачи скажи: «Добавь задачу проверить рис завтра в 10:00».');
 if(field.maxLength>0&&value.length>field.maxLength)throw Error('Текст превышает длину поля. Продиктуй короче.');
 return value;
}
export function mountWorkbenchVoice({getView,show,openEditor,addIngredient,refreshRecipe,saveRecipe,voice,notify,openJournal,afterCommand=()=>{}}){
 let selected=null;
 const editable=f=>f?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]),textarea,select')&&!f.readOnly&&!f.disabled&&!f.closest('[hidden]');
 const visible=()=>[...document.querySelectorAll('input,textarea,select')].filter(f=>editable(f)&&f.getClientRects().length&&!f.closest('dialog,#chat-form'));
 document.addEventListener('focusin',e=>{if(editable(e.target)&&!e.target.closest('dialog,#chat-form'))selected=e.target});
 const help='Скажи: «Открой задачи», «Открой журнал уборки», «Открой заготовки», «Добавь задачу проверить рис завтра в 10:00», «Создай ТТК Филадельфия», «Добавь ингредиент рис нетто 80 граммов отходы 0 процентов», «Заполни технология: свернуть ролл». Или выбери поле и скажи «Впиши…». Для записи техкарты скажи «Сохрани ТТК».';
 function write(field,value,append=false){
  if(!editable(field)||!field.isConnected||field.getClientRects().length===0)throw Error('Сначала выбери доступное поле в открытой форме.');
  const next=normalizeFieldValue(field,value);field.value=append&&field.value&&field.tagName==='TEXTAREA'?field.value+'\n'+next:next;
  field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
  return 'Заполнено поле «'+fieldLabel(field)+'». Изменения пока в форме.';
 }
 const dock=document.createElement('button');dock.type='button';dock.className='neural-launch';dock.id='neural-launch';dock.setAttribute('aria-label','ИИ-помощник: начать разговор');dock.innerHTML='<span class="ai-orb" aria-hidden="true"><span class="ai-orb-halo"></span><span class="ai-orb-shell"><span class="ai-orb-rings"><i></i><i></i><i></i></span><span class="ai-orb-label">AI</span><span class="ai-orb-gloss"></span></span></span>';
 document.body.append(dock);dock.onclick=()=>voice.start();
 const update=()=>{dock.classList.toggle('in-home',getView()==='home');if(getView()==='home')document.querySelector('.lunar-shortcuts')?.append(dock);else document.body.append(dock)};
 window.addEventListener('hashchange',update);update();
 const observer=new MutationObserver(()=>{const phase=document.getElementById('voice-panel').dataset.phase||'idle';dock.dataset.phase=phase;dock.setAttribute('aria-label',phase==='listening'?'Слушаю: нажать для завершения фразы':phase==='thinking'||phase==='speaking'?'Остановить помощника':'ИИ-помощник: начать разговор');dock.onclick=()=>phase==='listening'?document.getElementById('voice-send').click():['thinking','speaking','connecting'].includes(phase)?voice.stop():voice.start()});
 observer.observe(document.getElementById('voice-panel'),{attributes:true,attributeFilter:['data-phase']});
 return {help,async run(text){
  const c=parseWorkbenchCommand(text);if(!c)return null;
  let result;
  if(c.type==='error')return c.message;
  if(c.type==='navigate'){show(c.view);if(getView()!==c.view)return 'Переход отменён. Несохранённая техкарта остаётся открытой.';selected=null;result='Открыт раздел. '+(c.view==='recipes'?'Для новой техкарты скажи «Создай ТТК»':'Можно выбрать поле и продиктовать текст.')}
  if(c.type==='journal'){show('lab');if(getView()!=='lab')return 'Переход отменён. Техкарта остаётся открытой.';if(!openJournal?.(c.kind))return 'Журнал пока недоступен.';result='Журнал открыт. Заполни фактические данные проверки.'}
  if(c.type==='new-recipe'){
   const editor=document.getElementById('editor');if(!editor.hidden)return 'Сначала сохрани или закрой открытую техкарту, чтобы не потерять изменения.';
   show('recipes');if(getView()!=='recipes')return 'Переход отменён.';openEditor();selected=null;if(c.name)write(document.getElementById('recipe-name'),c.name);result='Открыт черновик техкарты'+(c.name?' «'+c.name+'»':'')+'. Диктуй ингредиенты, нетто и отходы. Сохраню по твоей команде.';
  }
  if(c.type==='save-recipe'){
   const editor=document.getElementById('editor');if(editor.hidden)return 'Сначала открой техкарту.';
   // A voice edit cannot accidentally release a TTK to external documents.
   if(document.getElementById('recipe-status').value==='ready')return 'Для статуса «Рецептура готова» проверь техкарту и сохрани кнопкой. Голосом сохраняю черновики.';
   if(!editor.reportValidity())return 'Техкарта не сохранена. Проверь выделенные обязательные поля, нетто и процент отходов.';
   await saveRecipe();result='Черновик техкарты сохранён на устройстве.';
  }
  if(c.type==='ingredient'){
   if(document.getElementById('editor').hidden)return 'Сначала открой или создай техкарту.';
   const rows=document.getElementById('ingredients');const first=rows.children[0];if(rows.children.length===1&&[...first.querySelectorAll('input')].every(i=>i.dataset.key==='lossPercent'||!i.value))first.querySelector('button').click();
   addIngredient({name:c.name,grams:c.grams,lossPercent:c.lossPercent});
   if(c.lossPercent===null){const row=rows.lastElementChild;row.querySelector('[data-key="lossPercent"]').value='';row.querySelector('[data-key="lossPercent"]').dispatchEvent(new Event('input',{bubbles:true}));}
   refreshRecipe();result='В форму добавлен '+c.name+', нетто '+c.grams+' граммов.'+(c.lossPercent===null?' Укажи процент отходов; брутто пока не рассчитано.':' Отходы '+c.lossPercent+' процентов, брутто рассчитано.');
  }
  if(c.type==='field'){const field=findVoiceField(c.label,visible());if(!field)return 'Не нашёл однозначное поле «'+c.label+'» в открытом разделе. Выбери поле и скажи «Впиши…».';if(field.id==='recipe-status'&&/готов/iu.test(c.value))return 'Статус готовности установи вручную после проверки техкарты.';result=write(field,c.value)}
  if(c.type==='dictate')result=write(selected,c.value,true);
  if(c.type==='help')result=help;
  afterCommand();notify(result);return result;
 }};
}
