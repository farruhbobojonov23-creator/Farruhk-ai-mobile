// Generic reference profiles per 100 g (USDA FoodData Central). These are
// approximate starting values, NOT supplier-label values or guaranteed values
// for the food used at the kitchen. No brand-specific assumptions are made.
// Full metadata/source is returned with every lookup.
const items=[
 {id:'cream-cheese',names:['сыр творожный','творожный сыр','сливочный сыр','сыр сливочный','cream cheese'],
  title:'Сливочный творожный сыр, полножирный (типовой)',
  protein:5.79,fat:33.49,carbs:4.56,kcal:337,
  fdcId:'2346385',description:'Cream cheese, full fat, block (100 г)'},
 {id:'salmon-atlantic',names:['лосось','семга','сёмга','лосось сырой','семга сырая','сёмга сырая','salmon'],
  title:'Лосось атлантический, выращенный, сырой (пример)',
  protein:20.4,fat:13.4,carbs:0,kcal:208,
  fdcId:'175167',description:'Salmon, Atlantic, farmed, raw (100 г)'},
 {id:'rice-cooked',names:['рис вареный','рис варёный','рис готовый','рис отварной','rice cooked','рис белый готовый'],
  title:'Рис белый варёный, без заправки',
  protein:2.5,fat:0.3,carbs:28.2,kcal:130,
  fdcId:'2710788',description:'White rice, cooked (100 г)'},
 {id:'cucumber',names:['огурец','огурцы','огурец свежий','огурцы свежие','cucumber'],
  title:'Огурец свежий, с кожурой',
  protein:0.65,fat:0.11,carbs:3.63,kcal:15,
  fdcId:'168409',description:'Cucumber, with peel, raw (100 г)'},
 {id:'avocado',names:['авокадо','авокадо свежее','avocado'],
  title:'Авокадо свежее',
  protein:2,fat:14.66,carbs:8.53,kcal:160,
  fdcId:'171705',description:'Avocados, raw (100 г)'}
];
export const genericNutritionCatalog=Object.freeze(items.map(item=>Object.freeze({...item,names:Object.freeze([...item.names])})));
export const normalizeNutritionName=value=>String(value||'').trim().replace(/\\s+/g,' ').toLocaleLowerCase('ru-RU');
// Exact normalized aliases only; never guess nutritional values for similar
// but different products (seasoned rice, smoked salmon, light cream cheese).
const byName=new Map(genericNutritionCatalog.flatMap(item=>
 item.names.map(name=>[normalizeNutritionName(name),item])));
export function lookupGenericNutrition(name){
 const item=byName.get(normalizeNutritionName(name));
 if(!item)return null;
 return {
  id:item.id,title:item.title,origin:'reference',
  nutrition:{protein:item.protein,fat:item.fat,carbs:item.carbs,kcal:item.kcal},
  source:'USDA FoodData Central · '+item.fdcId,
  sourceUrl:'https://fdc.nal.usda.gov/food-details/'+item.fdcId+'/nutrients',
  description:item.description
 };
}
