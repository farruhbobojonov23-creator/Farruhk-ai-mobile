export const categoryPhotos={
 'Холодные роллы':'/assets/categories/cold.png',
 'Запечённые роллы':'/assets/categories/baked.png',
 'Темпурные роллы':'/assets/categories/tempura.png',
 'Маки-роллы':'/assets/categories/maki.png',
 'Гунканы':'/assets/categories/gunkan.png',
 'Воки':'/assets/categories/wok.png',
 'Суши':'/assets/categories/sushi.png',
 'Беридоги':'/assets/categories/beridog.png',
 'Закуски':'/assets/categories/snacks.png',
 'Полуфабрикаты':'/assets/categories/preparations.svg',
 'Онигири':'/assets/categories/onigiri.png'
};
export function filterCatalog(recipes,category='Все',query=''){
 const needle=query.trim().toLocaleLowerCase('ru-RU');
 return recipes.filter(r=>(category==='Все'||r.category===category)&&(!needle||(r.name||'').toLocaleLowerCase('ru-RU').includes(needle)||(r.category||'').toLocaleLowerCase('ru-RU').includes(needle)));
}
