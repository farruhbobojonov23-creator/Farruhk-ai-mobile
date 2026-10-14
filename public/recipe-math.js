export const rollTemplate={
 rawRequirements:'Настоящая ТТК распространяется на блюда, вырабатываемые предприятием «Суши Бери». Сырьё, используемое для приготовления, должно соответствовать требованиям нормативной документации (ТР ТС 021/2011), иметь ветеринарные сертификаты и декларации о соответствии. Входной контроль качества сырья обязателен.',
 preparation:'Рис промывается, варится и заправляется фирменным соусом. Основные ингредиенты подготавливаются согласно санитарным нормам.',
 forming:'На лист нори выкладывается ровный слой риса, затем переворачивается. В центр выкладывается начинка согласно рецептуре.',
 serving:'Ролл сворачивается с помощью циновки, нарезается на 8 равных частей. Блюдо выкладывается на брендированную упаковку.',
 storage:'Блюдо оформляется аккуратно, поверхность чистая, без заветриваний. Условия хранения: при температуре +2…+6 °C. Срок годности: 12 часов с момента окончания технологического процесса. Реализация должна проходить в соответствии с нормами СанПиН.',
 appearance:'Нарезка ровная, форма сохранена, начинка строго по центру.',
 taste:'Рис не разваливается, вкус свойственный ингредиентам.'
};
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
