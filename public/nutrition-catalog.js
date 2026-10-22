// Reference profiles per 100 g from USDA and identified product cards. These are
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
items.push(...[
 {
  "id": "nori",
  "names": [
   "нори",
   "листы нори",
   "водоросли нори",
   "нори сушеные",
   "nori"
  ],
  "title": "Нори сушёные (пример Sen Soy)",
  "protein": 40,
  "fat": 2,
  "carbs": 40,
  "kcal": 338,
  "source": "Магнит · Sen Soy",
  "sourceUrl": "https://magnit.ru/product/1009991110-morskaya_vodorosl_nori_sen_soy_28g",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "tobiko",
  "names": [
   "тобико",
   "тобикко",
   "икра тобико",
   "икра летучей рыбы",
   "тобико оранжевая",
   "tobiko"
  ],
  "title": "Тобико оранжевая (пример CESARS)",
  "protein": 10.3,
  "fat": 1.5,
  "carbs": 4.8,
  "kcal": 74,
  "source": "CESARS · карточка продукта",
  "sourceUrl": "https://austrumuprodukti.lv/ru/produkt/ikra-letuchej-ryby-tobiko-oranzhevaja-zamorozhennye-500g-2",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "masago",
  "names": [
   "масаго",
   "икра масаго",
   "масаго оранжевая",
   "masago"
  ],
  "title": "Масаго оранжевая (пример Путина, икра сельди)",
  "protein": 17.5,
  "fat": 2,
  "carbs": 8.5,
  "kcal": 122,
  "source": "Продстар · Путина",
  "sourceUrl": "https://www.prodstar.com/product/ikra_masago_oranzhevaya_500gr_1_6sht_putina/",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "eel-kabayaki",
  "names": [
   "угорь",
   "угорь жареный",
   "угорь унаги",
   "угорь кабаяки",
   "угорь в соусе унаги"
  ],
  "title": "Угорь жареный в соусе (пример Кабаяки Платинум)",
  "protein": 18,
  "fat": 27,
  "carbs": 5,
  "kcal": 330,
  "source": "Гастрономия · Кабаяки Платинум",
  "sourceUrl": "https://gastronomija.ru/catalog/ryba_moreprodukty/gotovaya_ryba_i_moreprodukty/ugor_zharenyy_unagi_kabayaki_platinum_kitay/",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "unagi-sauce",
  "names": [
   "соус унаги",
   "унаги",
   "унаги соус",
   "unagi sauce"
  ],
  "title": "Соус унаги (пример Sen Soy)",
  "protein": 1,
  "fat": 0,
  "carbs": 34,
  "kcal": 140,
  "source": "Apeti · Sen Soy",
  "sourceUrl": "https://apeti.ru/product/maslo_podsolnechnoe_rafinirovannoe_ideal_1l.html",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "teriyaki",
  "names": [
   "соус терияки",
   "терияки",
   "терияки соус",
   "teriyaki"
  ],
  "title": "Соус терияки (пример Takemura)",
  "protein": 3.26,
  "fat": 0.23,
  "carbs": 35.6,
  "kcal": 160,
  "source": "ThaiBro · Takemura",
  "sourceUrl": "https://thaibro.ru/product/sous-teriyaki-215-ml-tm-takemura-215-ml-kitay",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "panko",
  "names": [
   "панко",
   "сухари панко",
   "панировочные сухари",
   "сухари панировочные",
   "panko"
  ],
  "title": "Панировочные сухари панко (пример Takemura)",
  "protein": 11,
  "fat": 4.6,
  "carbs": 69,
  "kcal": 361,
  "source": "METRO · Takemura",
  "sourceUrl": "https://online.metro-cc.ru/products/suhari-panko-panirovochnye-1kg",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "shrimp-cooked",
  "names": [
   "креветки вареные",
   "креветка вареная",
   "креветки отварные",
   "креветки очищенные вареные"
  ],
  "title": "Креветки очищенные варёные (пример VICI)",
  "protein": 12.4,
  "fat": 0.4,
  "carbs": 0,
  "kcal": 53,
  "source": "VICI · производитель",
  "sourceUrl": "https://vici.ru/products/krevetki-ochishchennye-varyenye-200-300-477",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "sesame-white",
  "names": [
   "кунжут",
   "кунжут белый",
   "семена кунжута",
   "белый кунжут"
  ],
  "title": "Кунжут белый (пример Свежее поле)",
  "protein": 19.4,
  "fat": 48.7,
  "carbs": 12.2,
  "kcal": 565,
  "source": "Свежее поле · производитель",
  "sourceUrl": "https://freshfield.ru/catalog/kunzhut-belii",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 },
 {
  "id": "sesame-roasted",
  "names": [
   "кунжут жареный",
   "кунжут обжаренный"
  ],
  "title": "Кунжут очищенный обжаренный (пример)",
  "protein": 19.2,
  "fat": 51,
  "carbs": 15,
  "kcal": 596,
  "source": "Кондитер44 · карточка продукта",
  "sourceUrl": "https://www.konditer44.ru/katalog/konditerskie-ingredienty/muka-smesi-dlya-vypechki-orekhi-spetsii-sukhofrukty/spetsii/kunzhut-ochishchennyj-obzharennyj-rossiya-100-g",
  "description": "Справочный пример на 100 г, не данные вашего поставщика. Проверено 23.10.2026."
 }
]);
export const genericNutritionCatalog=Object.freeze(items.map(item=>Object.freeze({...item,names:Object.freeze([...item.names])})));
export const normalizeNutritionName=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/[‐‑–—-]/g,' ').replace(/\s+/g,' ').trim();
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
  source:item.source||'USDA FoodData Central · '+item.fdcId,
  sourceUrl:item.sourceUrl||'https://fdc.nal.usda.gov/food-details/'+item.fdcId+'/nutrients',
  description:item.description
 };
}
