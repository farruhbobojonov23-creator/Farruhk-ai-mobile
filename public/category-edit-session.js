import {categoriesFor} from './category-model.js';
import {validateCategories} from './category-validation.js';
export function beginCategoryEdit(state){
 const categories=structuredClone(categoriesFor(state));
 return {base:JSON.stringify(categories),working:{categories,recipes:categories.map((c,i)=>({id:'link-'+i,originalCategory:c.name,category:c.name}))}};
}
export function applyCategoryEdit(state,session){
 if(JSON.stringify(categoriesFor(state))!==session.base)throw Error('Категории изменились в другой вкладке. Отмени правки и открой настройку заново.');
 const categories=validateCategories(session.working.categories);
 const map=new Map(session.working.recipes.map(r=>[r.originalCategory,r.category]));
 const names=new Set(categories.map(c=>c.name));
 if((state.recipes||[]).some(r=>!names.has(map.get(r.category)||r.category)))throw Error('В удаляемую категорию добавили техкарту. Открой настройку заново и выбери перенос.');
 state.categories=categories;
 for(const recipe of state.recipes||[])if(map.has(recipe.category))recipe.category=map.get(recipe.category);
}
