import {recipeCategories} from './recipe-math.js';
import {categoryPhotos} from './recipe-catalog.js';
export const categoryColors=['#eef2e9','#faeee2','#f6e7e1','#e8eef5','#eee9f6'];
export function categoriesFor(state={}){
 const source=Array.isArray(state.categories)?state.categories:recipeCategories.map((name,i)=>({id:'default-'+i,name,image:categoryPhotos[name]||'',color:categoryColors[i%5],visible:true}));
 const categories=source.map(c=>({...c}));
 for(const r of state.recipes||[])if(r.category&&!categories.some(c=>c.name===r.category))categories.push({id:'legacy-'+r.category,name:r.category,image:'',color:categoryColors[0],visible:true});
 return categories;
}
export function updateCategory(state,category){
 const list=categoriesFor(state),name=String(category.name||'').trim();
 if(!name||name.length>100||name==='Все')throw Error('Укажи название от 1 до 100 символов, кроме «Все».');
 if(list.some(c=>c.id!==category.id&&c.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))throw Error('Категория с таким названием уже есть.');
 const previous=list.find(c=>c.id===category.id);
 if(previous&&previous.name!==name)for(const recipe of state.recipes||[])if(recipe.category===previous.name)recipe.category=name;
 const next={...category,name};if(previous)list[list.indexOf(previous)]=next;else list.push(next);
 state.categories=list;
}
export function deleteCategory(state,id,target=''){
 const list=categoriesFor(state),category=list.find(c=>c.id===id);if(!category)return;
 const linked=(state.recipes||[]).filter(r=>r.category===category.name);
 if(linked.length){if(!list.some(c=>c.id!==id&&c.name===target))throw Error('Выбери категорию для переноса техкарт.');for(const r of linked)r.category=target}
 state.categories=list.filter(c=>c.id!==id);
}
