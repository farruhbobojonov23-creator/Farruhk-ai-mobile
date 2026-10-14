export const regulatoryBasis='Нормативная основа: СанПиН 2.3/2.4.3590-20, ТР ТС 021/2011; структура ТТК — ГОСТ 31987-2012. Применяются действующие редакции.';
export const rollTemplate={
 scope:'Настоящая ТТК распространяется на блюдо «{name}», изготавливаемое и реализуемое предприятием «Суши Бери», включая отпуск на вынос и доставку.',
 rawRequirements:'Сырьё соответствует применимым техническим регламентам ЕАЭС. При приёмке проверяют маркировку, целостность упаковки, срок годности, условия перевозки и сопроводительные документы; ветеринарные документы — для подконтрольной продукции. Не допускается сырьё с признаками порчи или истёкшим сроком годности.',
 preparation:'Сырьё и готовые компоненты обрабатывают раздельно маркированным инвентарём. Рис и начинки готовят по утверждённым инструкциям на соответствующие полуфабрикаты. Соблюдают личную гигиену и исключают перекрёстное загрязнение.',
 forming:'На нори распределяют готовый заправленный рис и начинку по рецептуре. Формуют ролл с помощью подготовленной циновки. Расположение нори и наружного покрытия соответствует конкретному изделию.',
 serving:'Ролл нарезают на 8 равных частей, сохраняя форму. Оформляют согласно рецептуре, подают на чистой посуде или упаковывают в тару для контакта с пищей.',
 storage:'Срок годности, установленный предприятием: 12 часов с момента приготовления при +2…+6 °C. Маркируют дату и время приготовления и окончания срока годности. Хранят защищённым от загрязнения, соблюдая товарное соседство и холодовую цепь при доставке. По истечении срока реализация запрещена.',
 appearance:'Форма сохранена, нарезка ровная; состав, цвет и оформление соответствуют рецептуре. Без заветривания и посторонних включений.',
 taste:'Вкус и запах свойственны составу, без посторонних оттенков; рис держит форму, начинка имеет характерную для подготовленных компонентов консистенцию.',
 safety:'Показатели безопасности соответствуют применимым требованиям ТР ТС 021/2011 и профильных регламентов. Контроль — по программе производственного контроля и процедурам ХАССП. Срок годности и режимы технологии требуют обоснования и утверждения предприятием.'
};
export function nextCardNumber(recipes=[]){const used=new Set(recipes.map(r=>String(r.cardNumber||'')));let n=1;while(used.has(String(n).padStart(3,'0')))n++;return String(n).padStart(3,'0')}
export function cardDateNow(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export const nutritionKeys=['protein','fat','carbs','kcal'];
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
export function grossFromNet(net,loss){if(!number(net)||!number(loss)||Number(net)<0||Number(loss)<0||Number(loss)>=100)return null;return Math.round(Number(net)/(1-Number(loss)/100)*10000)/10000}
export function calculateNutrition(ingredients,yieldGrams){
 if(!ingredients.length||!number(yieldGrams)||Number(yieldGrams)<=0)return null;
 const total=Object.fromEntries(nutritionKeys.map(k=>[k,0]));
 for(const i of ingredients){
  if(!number(i.grams)||!number(i.grossGrams)||Number(i.grams)<0||Number(i.grossGrams)<=0||Number(i.grossGrams)<Number(i.grams)||nutritionKeys.some(k=>!number(i.nutrition?.[k])||Number(i.nutrition[k])<0))return null;
  // Gross purchase weight adjusted for the discarded fraction. Nutrient data describe the edible ingredient.
  const edibleFraction=Number(i.grams)/Number(i.grossGrams);
  for(const k of nutritionKeys)total[k]+=Number(i.nutrition[k])*Number(i.grossGrams)*edibleFraction/100;
 }
 return Object.fromEntries(nutritionKeys.map(k=>[k,total[k]/Number(yieldGrams)*100]));
}
export const recipeCategories=['Холодные роллы','Запечённые роллы','Темпурные роллы','Маки-роллы','Гунканы','Воки','Суши','Беридоги'];
export function lossFromWeights(gross,net){if(!number(gross)||!number(net)||Number(gross)<=0||Number(net)<0||Number(net)>Number(gross))return null;return Math.round((1-Number(net)/Number(gross))*1000000)/10000}
export function netYield(ingredients){if(!ingredients.length||ingredients.some(i=>!number(i.grams)||Number(i.grams)<=0))return null;return Math.round(ingredients.reduce((sum,i)=>sum+Number(i.grams),0)*10000)/10000}
export function templateFor(category,pieces=8){
 const count=[4,8,16].includes(Number(pieces))?Number(pieces):8;
 const t={...rollTemplate,serving:rollTemplate.serving.replace('8 равных',count+' равных')};
 const cooling=' При холодильном хранении охлаждают по утверждённой инструкции с контролем времени и температуры. Охлаждение входит в 12 часов срока годности; повторный нагрев срок не продлевает.';
 if(category==='Запечённые роллы'){
  t.forming+=' Нарезают, наносят шапочку по рецептуре, запекают по утверждённой инструкции с контролем времени, температуры и готовности.';
  t.serving='Подготовленный ролл делят на '+count+' равных частей до запекания. После запекания оформляют и отпускают по утверждённому режиму горячей подачи.';t.storage+=cooling;
 }
 if(category==='Темпурные роллы'){
  t.forming+=' Покрывают кляром и панировкой по рецептуре, обжаривают по утверждённой инструкции с контролем фритюрного жира, времени, температуры и готовности. Удаляют избыток масла.';
  t.serving='После обжаривания ролл нарезают на '+count+' равных частей, оформляют и отпускают по утверждённому режиму горячей подачи.';t.storage+=cooling;
 }
 if(category==='Маки-роллы')t.forming='На нори распределяют готовый рис и начинку по рецептуре. Формуют ролл нори наружу с помощью подготовленной циновки.';
 if(['Гунканы','Суши','Воки','Беридоги'].includes(category)){
  t.forming=({Гунканы:'Формуют порцию готового риса, оборачивают нори и выкладывают подготовленную начинку согласно рецептуре. Запекание, если предусмотрено, выполняют по отдельной утверждённой инструкции.',Суши:'Формуют порцию готового риса; сверху укладывают подготовленный компонент согласно рецептуре. Для рыбы без тепловой обработки используют сырьё, пригодность которого для такого применения подтверждена.',Воки:'Подготовленные компоненты готовят в воке в последовательности по рецептуре. Соус и гарнир добавляют по рецептуре; время, температура и контроль готовности — по утверждённой инструкции.',Беридоги:'Подготовленную основу и начинку собирают согласно рецептуре, добавляют предусмотренные соусы и топпинги. Тепловую обработку, если предусмотрена, выполняют по утверждённой инструкции.'})[category];
  t.serving='Порционируют согласно рецептуре, оформляют и отпускают на чистой посуде или в пищевой упаковке.';
  t.appearance='Форма и выкладка аккуратные; состав, цвет и оформление соответствуют рецептуре. Без посторонних включений.';
  if(['Воки','Беридоги','Гунканы'].includes(category))t.storage+=cooling;
 }
 return t;
}
