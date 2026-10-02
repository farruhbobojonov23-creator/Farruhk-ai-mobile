import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app=express();
app.use(express.json({limit:'1mb'}));
app.use(express.static('public'));

const hasKey=Boolean(process.env.OPENAI_API_KEY);
const client=hasKey?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;

const instructions=`Ты — FARRUKH AI Mobile, персональный рабочий ассистент бренд-шефа японской кухни.
Отвечай по-русски, кратко и практично.
Контекст: Суши Бери, 4 точки, меню A3, техкарты, себестоимость, food cost, персонал, закупки, проекты.
Не выдумывай отсутствующие цены, граммовки и факты.`;

app.get('/api/status',(req,res)=>res.json({ok:true,aiConnected:hasKey,version:'mobile-1.0'}));

app.post('/api/chat',async(req,res)=>{
 const message=String(req.body?.message||'').trim();
 if(!message)return res.status(400).json({error:'Пустая команда'});
 if(!hasKey)return res.json({reply:'FARRUKH AI Mobile работает. Для полноценного AI добавьте OPENAI_API_KEY на сервере.',mode:'local'});
 try{
  const response=await client.responses.create({
   model:process.env.OPENAI_MODEL||'gpt-6-luna',
   instructions,
   input:message
  });
  res.json({reply:response.output_text||'Ответ без текста.',mode:'online'});
 }catch(err){
  res.status(500).json({error:'Ошибка AI API: '+(err?.message||'unknown')});
 }
});
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`FARRUKH AI Mobile: http://localhost:${port}`));