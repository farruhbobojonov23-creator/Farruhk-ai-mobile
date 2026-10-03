import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json({limit:'2mb'}));
app.use(express.static('public'));

const hasKey = Boolean(process.env.OPENAI_API_KEY);
const client = hasKey ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;

const staticKnowledge = {
  profile: {
    name: "Фаррух Ака",
    role: "бренд-шеф японской кухни",
    brand: "Суши Бери",
    city: "Мурманск",
    points: 4
  },
  projects: [
    "Меню A3: холодные роллы слева, запечённые справа, горизонтальный формат",
    "Экраны в зале: 3 монитора",
    "Шеф на дому: японская кухня",
    "Личный сайт и профессиональный бренд",
    "Техкарты, КБЖУ и себестоимость",
    "Новые блюда и R&D"
  ],
  operations: [
    "Контроль чистоты и маркировок",
    "Контроль персонала и чек-листов",
    "Закупки, поставщики и остатки",
    "Разработка новых блюд"
  ],
  menuNotes: [
    "Во всех составах роллов обязательно указывать рис",
    "Меню A3 — ключевой рабочий проект",
    "Фото блюд — свои, единый стиль и ракурс"
  ]
};

function buildInstructions(clientContext={}) {
  return `Ты — FARRUKH AI Mobile, персональный рабочий ассистент Фарруха Ака.
Отвечай по-русски, кратко, профессионально и практично.

ПОСТОЯННЫЙ КОНТЕКСТ:
${JSON.stringify(staticKnowledge, null, 2)}

ТЕКУЩИЕ ДАННЫЕ ИЗ ПРИЛОЖЕНИЯ (включая пользовательскую базу знаний, задачи и проекты):
${JSON.stringify(clientContext, null, 2)}

Правила:
- Если пользователь спрашивает про задачи — используй текущий список tasks из контекста.
- Если спрашивает про проекты — используй projects из контекста плюс постоянную базу выше.
- Если спрашивает "что сегодня" — сначала покажи незакрытые важные задачи, затем обычные.
- Если данные уже есть в контексте, не говори, что у тебя нет к ним доступа.
- Поле knowledge — это пользовательская база знаний. Считай её главным рабочим контекстом, если она не противоречит текущим данным.
- Не выдумывай закупочные цены, граммовки, санитарные нормы и факты.
- Для себестоимости используй только присланные пользователем числа.
- Можно предлагать готовые сообщения поварам, чек-листы и рабочие планы.
- Не утверждай, что можешь переключить системный голос сам.`;
}

function localReply(message, ctx={}) {
  const x = message.toLowerCase();
  const tasks = Array.isArray(ctx.tasks) ? ctx.tasks : [];
  const active = tasks.filter(t => !t.done);
  const projects = Array.isArray(ctx.projects) ? ctx.projects : staticKnowledge.projects;

  if (x.includes('задач') || x.includes('сегодня')) {
    if (!active.length) return 'Активных задач сейчас нет.';
    const important = active.filter(t=>t.priority==='high');
    const normal = active.filter(t=>t.priority!=='high');
    return [
      important.length ? 'Важные задачи:\n' + important.map((t,i)=>`${i+1}. ${t.text}`).join('\n') : '',
      normal.length ? 'Остальные:\n' + normal.map((t,i)=>`${i+1}. ${t.text}`).join('\n') : ''
    ].filter(Boolean).join('\n\n');
  }

  if (x.includes('проект')) {
    return 'Проекты:\n' + projects.map((p,i)=>`${i+1}. ${typeof p==='string'?p:(p.title||p.name||JSON.stringify(p))}`).join('\n');
  }

  if (x.includes('точк') && x.includes('2')) {
    return 'По точке №2 сейчас в приоритете: проверить чистоту и маркировки. Если добавишь новые задачи по точке №2, я тоже буду учитывать их.';
  }

  return 'Команду принял. Использую задачи, проекты и рабочий контекст FARRUKH AI.';
}

app.get('/api/status',(req,res)=>res.json({ok:true,aiConnected:hasKey,version:'mobile-2.0'}));

app.post('/api/chat',async(req,res)=>{
  const message=String(req.body?.message||'').trim();
  const context=req.body?.context||{};
  if(!message)return res.status(400).json({error:'Пустая команда'});

  if(!hasKey)return res.json({reply:localReply(message,context),mode:'local'});

  try{
    const response=await client.responses.create({
      model:process.env.OPENAI_MODEL||'gpt-6-luna',
      instructions:buildInstructions(context),
      input:message
    });
    res.json({reply:response.output_text||'Ответ без текста.',mode:'online'});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Ошибка AI API: '+(err?.message||'unknown')});
  }
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`FARRUKH AI Mobile V2: http://localhost:${port}`));
