/* Shared allergen indicators for A4 print and the in-app preview.
 * Flags are screening hints from ingredient names, never a verified label
 * declaration. Empty squares do not certify allergen absence.
 * Explicit confirmed ingredient metadata, when provided, takes priority. */
export const TTK_ALLERGENS=Object.freeze([
 {id:'fish',name:'Рыба',label:'Рыба и продукты из рыбы',symbol:'♧',rx:/лосос|форел|с[её]мг|угор|тунец|треск|скумбр|рыб|fish|salmon|eel|tuna/i},
 {id:'milk',name:'Молоко',label:'Молоко и молочные продукты',symbol:'◉',rx:/сыр|творог|сливк|молок|лактоз|йогурт|сметан|масл[оа] слив|cheese|cream|milk|butter/i},
 {id:'gluten',name:'Глютен',label:'Злаки, содержащие глютен',symbol:'≋',rx:/пшен|глютен|мук[аи]|панир|пшенич|булгур|ячмен|рожь|сухар|wheat|gluten|barley/i},
 {id:'egg',name:'Яйца',label:'Яйца и продукты из них',symbol:'◯',rx:/яйц|яичн|меланж|омлет|egg/i},
 {id:'crustacean',name:'Ракообразные',label:'Ракообразные',symbol:'✺',rx:/кревет|краб|лангуст|омар|рак[^у]|shrimp|prawn|crab/i},
 {id:'soy',name:'Соя',label:'Соя и продукты из сои',symbol:'❀',rx:/соев|соя|тофу|эдамам|soy|tofu|edamame/i},
 {id:'sesame',name:'Кунжут',label:'Кунжут и продукты из него',symbol:'✿',rx:/кунжут|тахин|sesame|tahini/i},
 {id:'nuts',name:'Орехи',label:'Орехи',symbol:'◇',rx:/арахис|фундук|миндал|кешью|грецк|фисташ|макадам|пекан|nuts|almond|walnut|peanut/i}
]);
const POSSIBLE_MIX=/терияки|унаги соус|спайси соус|фирменный соус|соус готовый|соус поке|майонез|сухая смесь|маринад|заправка|приправа|tempura sauce/i;
export function validAllergenOverrides(input){
 const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 return Object.fromEntries(TTK_ALLERGENS.filter(group=>typeof source[group.id]==='boolean')
  .map(group=>[group.id,source[group.id]]));
}
export function recipeAllergenMatrix(recipe={}){
 const overrides=validAllergenOverrides(recipe.allergenOverrides);
 const ingredients=Array.isArray(recipe.ingredients)?recipe.ingredients:[];
 const explicit=new Set(),screened=new Set(),possible=new Set();
 for(const item of ingredients){
  const name=String(item?.name||'').trim();
  const tags=Array.isArray(item?.allergens)?item.allergens:[];
  for(const tag of tags)if(TTK_ALLERGENS.some(group=>group.id===tag))explicit.add(tag);
  if(POSSIBLE_MIX.test(name))for(const tag of ['soy','gluten','egg','sesame'])possible.add(tag);
  for(const group of TTK_ALLERGENS)if(group.rx.test(name))screened.add(group.id);
 }
 const groups=TTK_ALLERGENS.map(({rx,...group})=>{
  const edited=Object.hasOwn(overrides,group.id);
  const matched=explicit.has(group.id)||screened.has(group.id);
  const checked=edited?overrides[group.id]:matched;
  return {...group,checked,confirmed:!edited&&explicit.has(group.id),
   manual:edited,possible:!checked&&(possible.has(group.id)||edited&&matched)};
 });
 return {groups,hasUnverified:groups.some(g=>g.checked&&!g.confirmed||g.possible||g.manual),
  note:'Аллергены отмечены предварительно по составу или вручную. Сверь этикетки и ПФ: пустые клетки НЕ подтверждают отсутствие аллергена.'};
}
