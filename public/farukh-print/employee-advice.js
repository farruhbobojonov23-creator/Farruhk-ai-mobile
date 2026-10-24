// Read-only employee guidance shown in FARUKH PRINT; never alters printing,
// catalog, durations or product data. Managed and standalone modes use one UI.
import {storageAdviceFor,PRACTICE_REFERENCES} from './storage-advice.js';
import {guidanceForProduct,REFERENCES} from './shelf-life-guidance.js';
import {advicePicture,neighborPicture,illustrationFor,isCatalogPhoto} from './advice-art.js?v=2';

const norm=v=>String(v||'').toLocaleLowerCase('ru').replace(/ё/g,'е');
const create=(tag,cls,txt)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(txt!==undefined)el.textContent=txt;
 return el;
};
const validateUrl=url=>typeof url==='string'&&url.startsWith('https://');
const BASE_NEIGHBORS={
 yes:['Продукты той же группы — в отдельных чистых закрытых ёмкостях, если температурный режим совпадает.',
      'Партии одного вида продукции — раздельно, с собственными маркировками.'],
 no:['Сырое мясо и птица — без контакта с другими продуктами.',
     'Готовые к употреблению блюда и открытая еда — отдельно от необработанного сырья.',
     'Моющие и дезинфицирующие средства — только в специально отведённой зоне.'],
 note:'Товарное соседство зависит от стадии обработки и упаковки. Даже продукты из одной группы не должны касаться друг друга без соответствующей тары.'
};
export function neighborsFor(product){
 const p=product||{},n=norm(p.name),category=norm(p.category);
 if(p.template){
  return {title:'Служебные материалы ХАССП',
   yes:['Внутри специально выделенной зоны, отдельно по назначению и правилам производителя.',
        'В штатных подписанных ёмкостях, недоступных для попадания в продукты.'],
   no:['Пищевые продукты, напитки, сырьё, готовые блюда.',
       'Чистая пищевая тара и рабочие поверхности для приготовления еды.'],
   note:'Уборочный инвентарь и рабочие растворы должны храниться отдельно от продуктов и посуды.'};
 }
 if(p.kind==='ready'){
  return {...BASE_NEIGHBORS,title:'Готовые роллы и блюда',
   yes:['Другие готовые к употреблению блюда — в отдельной закрытой пищевой упаковке.',
        'Готовая продукция со схожим режимом охлаждения и без перекрёстного контакта.'],
   no:['Сырая рыба, мясо, птица и их соки.',
       'Немытые овощи и сырьё, которое ещё требует обработки.',
       'Химические средства, уборочный инвентарь.'],
   note:'Собранные роллы — готовая продукция, их нельзя хранить вместе с сырым необработанным сырьём без пространственного разделения.'};
 }
 if(/форел|лосос|угор|тунец|рыба|семг/.test(n)){
  return {title:'Рыба · сырьё и нарезка',
   yes:['Другая рыба той же стадии обработки — только в отдельных закрытых контейнерах.',
        'Промаркированные партии рыбы с совместимым режимом хранения — на выделенной полке.'],
   no:['Готовые роллы, суши и другая готовая к употреблению продукция.',
      'Сырая птица, мясо и их соки.',
      'Открытые овощи, соусы, молочные продукты и ингредиенты без защитной тары.'],
   note:'Сырую и готовую к употреблению рыбу также разделяйте. Выбирайте отдельную зону и исключайте перенос жидкостей на соседние продукты.'};
 }
 if(/кревет|краб|сурими|мид|морепродукт/.test(n)){
  return {...BASE_NEIGHBORS,title:'Морепродукты',
   yes:['Продукты аналогичной стадии обработки — в индивидуальных закрытых контейнерах при подходящей температуре.',
        'Однотипные закрытые упаковки морепродуктов — на специально выделенной полке.'],
   no:['Готовые блюда — при наличии сырого морепродукта рядом.',
       'Открытые соусы и подготовленные овощи — без защитной упаковки.',
       'Сырая птица и мясо — без разделения.'],
   note:'Сырые, варёные и размороженные морепродукты — разные технологические категории: не смешивайте их и не переносите между ними сроки.'};
 }
 if(/огур|капуст|морков|перец|такуан|помидор|овощ|зелень/.test(n)){
  return {...BASE_NEIGHBORS,title:'Овощи · чистые и подготовленные',
   yes:['Очищенные и вымытые овощи — в отдельных закрытых контейнерах.',
        'Промаркированные подготовленные овощные заготовки при совпадающем режиме.'],
   no:['Сырое мясо, рыба и птица; их соки и места разделки.',
       'Немытые овощи без разделения от подготовленных.',
       'Химические средства и грязный уборочный инвентарь.'],
   note:'Немытые овощи держите в выделенной зоне. Подготовленные овощи не размещайте под сырыми продуктами.'};
 }
 if(/соус|унаги|терияки|чили|майонез|сливочн|заправк/.test(n)){
  return {...BASE_NEIGHBORS,title:'Соусы и заправки',
   yes:['Другие готовые соусы — в отдельных закрытых маркированных гастроёмкостях.',
        'Заводские упакованные соусы — отдельно от открытых дозаторов.'],
   no:['Сырое мясо, птица и рыба; их соки.',
       'Открытые немытые овощи или продукты с сильным запахом.',
       'Чистящие средства и загрязнённый инвентарь.'],
   note:'Не ставьте открытые соусы под сырым сырьём. Соблюдайте режим после вскрытия заводской упаковки.'};
 }
 if(/куриц|птиц|говяд|омлет|бульон|рис/.test(n)){
  return {...BASE_NEIGHBORS,title:'Готовые заготовки',
   yes:['Другие охлаждённые готовые компоненты — в отдельных закрытых пищевых ёмкостях.',
        'Порционированные готовые продукты с совместимыми условиями хранения.'],
   no:['Сырое мясо, птица и рыба или их соки.',
       'Немытые овощи и непромаркированные продукты.',
       'Открытая химия, уборочный инвентарь.'],
   note:'Готовую птицу, бульон, омлет и рис защищайте от повторного загрязнения после тепловой обработки.'};
 }
 return BASE_NEIGHBORS;
}
const sectionData=(product,tips,norms)=>({
 'Советы':[
  ['Упаковка','Как правильно хранить',tips.packaging],
  ['Форма','Форма хранения',tips.form],
  ['Температура','Температура и охлаждение',tips.temperature],
  ['Порча','Признаки возможной порчи',tips.spoilage],
  ['Контроль','Контроль на смене',tips.control],
  ['Важно','Чего нельзя делать',tips.avoid]
 ],
 'Хранение':[
  ['Температура','При какой температуре',tips.temperature],
  ['Форма','Форма хранения',tips.form],
  ['Тара','Какая упаковка подходит',tips.packaging],
  ['Проверка','Как распознать возможную порчу',tips.spoilage]
 ],
 'Нормы':[
  ['Технология',norms.group,norms.question],
  ['Справка','Условия применения',norms.example]
 ]
});
const rowTone=title=>/порч|нельзя|избег|ошиб/i.test(title)?'danger':/хранить|контрол|вид/i.test(title)?'good':/температур|охлажден/i.test(title)?'cool':'neutral';
const iconSymbol=title=>/порч|нельзя|избег/i.test(title)?'!':/температур|охлажден/i.test(title)?'❄':/контрол|провер/i.test(title)?'✓':/хранить|вид/i.test(title)?'✓':'●';
const picture=(src,cls,alt)=>{const im=create('img',cls);im.src=src;im.alt=alt;im.decoding='async';im.loading='lazy';return im;};

let activeDialog=null;
export function closeAdvice(){
 if(activeDialog){
  try{if(activeDialog.open)activeDialog.close()}catch{}
  activeDialog.remove();activeDialog=null;
 }
}
export function openAdvice(product,{onPrint}={}){
 if(!product)return;
 closeAdvice();
 const tips=storageAdviceFor(product);
 const norms=guidanceForProduct(product);
 const neighbor=neighborsFor(product);
 const dialog=create('dialog','print-advice-dialog');
 dialog.setAttribute('aria-label','Советы по товару: '+product.name);
 const root=create('div','print-advice-layout');
 const aside=create('aside','print-advice-aside');
 const closeBtn=create('button','print-advice-close','×');
 closeBtn.type='button';closeBtn.setAttribute('aria-label','Закрыть советы');
 closeBtn.onclick=closeAdvice;
 const hero=create('div','print-advice-hero');
 const representative=product.kind==='prep'?window.FarukhPrepPhotoLibrary?.find(product):null;
 if(isCatalogPhoto(product.photo)){
  hero.append(picture(product.photo,'print-advice-photo','Фото: '+product.name));
 }else if(representative){
  const img=picture(representative.url,'print-advice-photo','Иллюстративное фото: '+product.name);
  img.referrerPolicy='no-referrer';
  img.onerror=()=>{img.remove();hero.append(create('div','print-advice-photo-blank',window.FarukhPrepPhotoLibrary?.mark(product)||'Фото недоступно'))};
  hero.append(img);
 }else{
  hero.append(create('div','print-advice-photo-blank',window.FarukhPrepPhotoLibrary?.mark(product)||'Фото товара пока не добавлено'));
 }
 aside.append(hero,create('h2','',product.name));
 if(representative&&!isCatalogPhoto(product.photo)){
  const credit=create('a','print-advice-photo-credit','Фото: '+representative.author+' · '+representative.license+' · Wikimedia Commons ↗');
  credit.href=representative.creditUrl;credit.target='_blank';credit.rel='noopener noreferrer';aside.append(credit);
 }
 aside.append(create('p','print-advice-kind',product.template?'Служебная этикетка ХАССП':product.kind==='ready'?'Готовая продукция':'Полуфабрикат'));
 const facts=create('div','print-advice-facts');
 const factsRows=[
  ['Срок хранения',product.template?'По инструкции':product.needsReview?(product.hours?product.hours+' ч · на проверке':'Требует проверки'):product.hours+' часов'],
  ['Условия хранения',product.template?'По инструкции средства':product.storage||'Уточнить по ТТК'],
  ['Форма хранения',product.form|| (product.template?'По инструкции':'См. рекомендации ниже')],
 ];
 for(const [k,v] of factsRows){
  const row=create('div','print-advice-fact');
  const icon=create('span','print-advice-fact-symbol',k==='Срок хранения'?'◷':k==='Условия хранения'?'♧':'▣');
  const val=create('div','print-advice-fact-value');
  val.append(create('span','',k),create('strong','',v));row.append(icon,val);facts.append(row);
 }
 aside.append(facts);
 if(product.kind==='prep'){
  const ref=window.FarukhPrepShelfReference?.get(product.name);
  if(ref){
   const info=create('div','print-advice-norm-ref');
   info.append(create('strong','','Источник: '+ref.category));
   if(ref.clause)info.append(create('p','',ref.clause+(ref.hours?' · '+ref.hours+' ч при '+ref.temp:'')));
   info.append(create('p','',ref.warning));
   const link=create('a','','Действующий СанПиН 2.3/2.4.4282-26 ↗');
   link.href=ref.source;link.target='_blank';link.rel='noopener noreferrer';info.append(link);
   aside.append(info);
  }
 }
 if(typeof onPrint==='function'){
  const printBtn=create('button','print-advice-print','▤  Печатать этикетку');
  printBtn.type='button';
  const available=product.template||(!product.needsReview&&Number(product.hours)>0&&!!product.storage);
  printBtn.disabled=!available;
  if(!available){printBtn.textContent='Срок требует проверки';printBtn.title='Печать недоступна до подтверждения срока и условий хранения владельцем';}
  printBtn.addEventListener('click',()=>{closeAdvice();onPrint(product)});
  aside.append(printBtn);
 }
 const right=create('div','print-advice-main');
 const heading=create('div','print-advice-heading');
 heading.append(create('span','print-advice-overline','FARUKH PRINT · СПРАВОЧНИК'),create('h3','','Рекомендации по хранению'));
 const tabs=create('div','print-advice-tabs');
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Разделы справки');
 const content=create('div','print-advice-content');
 const tabsMap=new Map(),sections=sectionData(product,tips,norms);
 let current='Советы';
 function renderTab(label){
  current=label;
  for(const [name,btn] of tabsMap){const yes=name===label;btn.setAttribute('aria-selected',String(yes));btn.classList.toggle('is-active',yes);}
  content.replaceChildren();
  if(label==='Соседство'){
   content.append(create('h4','print-advice-title','Товарное соседство · '+neighbor.title));
   const grid=create('div','print-advice-neighbor-grid');
   for(const [key,title,items] of [['yes','✓ Можно хранить рядом',neighbor.yes],['no','× Нельзя хранить рядом',neighbor.no]]){
    const group=create('section','print-advice-neighbor '+(key==='yes'?'allowed':'disallowed'));
    group.append(create('h5','',title));
    for(const line of items){
     const block=create('div','print-advice-neighbor-item');
     block.append(picture(neighborPicture(line),'print-advice-neighbor-picture','Иллюстрация товарной группы'));
     block.append(create('span','',line));group.append(block);
    }
    grid.append(group);
   }
   content.append(grid,create('p','print-advice-note',neighbor.note));
  }else{
   const list=create('div','print-advice-rows');
   for(const [icon,title,desc] of sections[label]||[]){
    const row=create('article','print-advice-row tone-'+rowTone(title));
    row.append(picture(advicePicture(product,icon,title),'print-advice-row-picture','Иллюстрация: '+title));
    const wrapper=create('div','print-advice-row-body');
    const h=create('h5','',title);
    h.prepend(create('span','print-advice-status-symbol',iconSymbol(title)));
    wrapper.append(h,create('p','',desc));
    row.append(wrapper);list.append(row);
   }
   content.append(list);
   if(label==='Нормы'){
    const links=create('div','print-advice-links');
    links.append(create('strong','','Нормативные источники'));
    for(const ref of [...REFERENCES,...PRACTICE_REFERENCES]){
     if(!validateUrl(ref.url))continue;
     const a=create('a','',ref.name+' ↗');a.href=ref.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);
    }
    content.append(links);
   }
  }
 }
 for(const [label,icon] of [['Советы','♧'],['Хранение','❄'],['Соседство','▱'],['Нормы','▤']]){
  const button=create('button','print-advice-tab');
  button.append(create('span','print-advice-tab-icon',icon),create('span','',label));
  button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected','false');
  button.onclick=()=>renderTab(label);tabs.append(button);tabsMap.set(label,button);
 }
 const safety=create('p','print-advice-safety',product.template?
  'Служебные средства храните строго по инструкции производителя и отдельно от пищевой продукции.':
  'Важно: отсутствие запаха или изменений внешнего вида не доказывает безопасность продукта. Срок и температура определяются маркировкой изготовителя и утверждённой ТТК. При сомнениях продукт изолируют и списывают.');
 right.append(heading,tabs,content,safety);
 root.append(aside,right);dialog.append(closeBtn,root);
 dialog.addEventListener('close',()=>{dialog.remove();if(activeDialog===dialog)activeDialog=null});
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeAdvice()});
 document.body.append(dialog);activeDialog=dialog;
 renderTab(current);
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 return dialog;
}
