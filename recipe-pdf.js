import {premiumRecipePdf} from './recipe-premium-pdf.js';
import {cleanState} from './assistant-store.js';
export const recipePdf=premiumRecipePdf;
export function installRecipePdfApi(app,{store}){
 app.post('/api/recipes/pdf',(req,res)=>{
  try{const raw=req.body?.recipe;if(!raw||typeof raw.name!=='string'||!raw.name.trim()||!Array.isArray(raw.ingredients)||raw.ingredients.some(i=>!i||typeof i!=='object'))return res.status(400).json({error:'Неверная техкарта.'});const recipe=cleanState({recipes:[raw]}).recipes[0];const doc=recipePdf(recipe);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',"attachment; filename=recipe.pdf; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.pdf'));doc.on('error',()=>{if(!res.headersSent)res.status(500).json({error:'Не удалось подготовить PDF.'});else res.destroy()});doc.pipe(res);doc.end()}catch{res.status(400).json({error:'Не удалось подготовить PDF.'})}
 });
 app.get('/api/recipes/:id/pdf',async(req,res)=>{
  try{const state=await store.state(),recipe=(state.recipes||[]).find(r=>r.id===req.params.id);if(!recipe)return res.status(404).json({error:'Техкарта не найдена.'});const doc=recipePdf(recipe);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',"attachment; filename=recipe.pdf; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.pdf'));doc.on('error',()=>{if(!res.headersSent)res.status(500).json({error:'Не удалось подготовить PDF.'});else res.destroy()});doc.pipe(res);doc.end()}catch(e){res.status(500).json({error:'Не удалось подготовить PDF.'})}
 });
}

