export function deleteRecipe(state,id){
 const index=(state.recipes||[]).findIndex(r=>r.id===id);
 if(index<0)throw Error('Техкарта уже удалена. Обнови список.');
 const [removed]=state.recipes.splice(index,1);
 return removed;
}
export function upsertRecipe(state,recipe,{editing=false}={}){
 state.recipes=state.recipes||[];
 const index=state.recipes.findIndex(r=>r.id===recipe.id);
 if(index<0&&editing)throw Error('Техкарта уже удалена. Изменения не сохранены.');
 if(index<0)state.recipes.push(recipe);else state.recipes[index]=recipe;
}
