export function rememberReadyRecipe(state,recipe){
 if(recipe.status!=='ready')return;
 state.releasedRecipes??=[];const i=state.releasedRecipes.findIndex(r=>r.id===recipe.id),copy={...structuredClone(recipe),releasedAt:new Date().toISOString()};
 if(i<0)state.releasedRecipes.push(copy);else state.releasedRecipes[i]=copy;
}
export function readyArchive(state){
 const records=new Map((state.releasedRecipes||[]).filter(r=>r.status==='ready').map(r=>[r.id,r]));
 for(const recipe of state.recipes||[])if(recipe.status==='ready'&&!records.has(recipe.id))records.set(recipe.id,recipe);
 return [...records.values()];
}
export async function recipeDigest(recipe){
 const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
 const bytes=new TextEncoder().encode(JSON.stringify(sort(recipe)));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
