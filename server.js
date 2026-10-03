import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import fs from 'node:fs/promises';

const app = express();
app.use(express.json({limit:'20mb'}));

app.get(['/', '/index.html'], async (req,res,next)=>{
  try{
    const html=await fs.readFile(new URL('./public/index.html', import.meta.url),'utf8');
    const injected=html.replace('</body>','<script src="/analytics.js?v=4"></script></body>');
    res.type('html').send(injected);
  }catch(err){next(err);}
});

app.use(express.static('public'));

const hasKey = Boolean(process.env.OPENAI_API_KEY);
const client = hasKey ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;

const frontpadConfigured=()=>Boolean(String(process.env.FRONTPAD_LOGIN||'').trim()&&String(process.env.FRONTPAD_PASSWORD||'').trim());

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
  return `Ты — FARRUKH AI Mobile, персональный рабочий ассистент Фарруха Ака.\nОтвечай по-русски, кратко, профессионально и практично.\n\nПОСТОЯННЫЙ КОНТЕКСТ:\n${JSON.stringify(staticKnowledge, null, 2)}\n\nТЕКУЩИЕ ДАННЫЕ ИЗ ПРИЛОЖЕНИЯ (включая пользовательскую базу знаний, задачи и проекты):\n${JSON.stringify(clientContext, null, 2)}\n\nПравила:\n- Если пользователь спрашивает про задачи — используй текущий список tasks из контекста.\n- Если спрашивает про проекты — используй projects из контекста плюс постоянную базу выше.\n- Если спрашивает \"что сегодня\" — сначала покажи незакрытые важные задачи, затем обычные.\n- Если данные уже есть в контексте, не говори, что у тебя нет к ним доступа.\n- Поле knowledge — это пользовательская база знаний. Считай её главным рабочим контекстом, если она не противоречит текущим данным.\n- Не выдумывай закупочные цены, граммовки, санитарные нормы и факты.\n- Frontpad: всегда называй дату снимка и источник. Это частичная ручная выгрузка, не полный день и не живые данные. Количество единиц не равно заказам или выручке. Не обещай автозагрузку, отправку или напоминания в фоне. Если нет выручки, прибыли или прошлых периодов, прямо скажи об этом. Отделяй факты от гипотез. Не называй точку плохой по одному неполному снимку.\n- Для себестоимости используй только присланные пользователем числа.\n- Можно предлагать готовые сообщения поварам, чек-листы и рабочие планы.\n- Не утверждай, что можешь переключить системный голос сам.`;
}

function localReply(message, ctx={}) {
  const x = message.toLowerCase();
  const tasks = Array.isArray(ctx.tasks) ? ctx.tasks : [];
  const active = tasks.filter(t => !t.done);
  const projects = Array.isArray(ctx.projects) ? ctx.projects : staticKnowledge.projects;

  if (/frontpad|фронтпад|продаж|выручк|аналитик/.test(x)) {
    const d=ctx.frontpad||analyticsSnapshot();
    return `Снимок Frontpad за ${d.date}. Источник: ${d.source}. Период неполный, время выгрузки не указано.\n\n${d.branches.map(b=>`${b.name}: ${b.units} ед.`).join('\n')}\n\nВсего: ${d.totalUnits} ед. Выручка, количество заказов и прошлые периоды не загружены. Автоматическая выгрузка не подключена.`;
  }

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

app.get('/api/status',(req,res)=>res.json({ok:true,aiConnected:hasKey,frontpadConfigured:frontpadConfigured(),version:'chef-4.0'}));

app.get('/api/frontpad/status',async(req,res)=>{
  const configured=frontpadConfigured();
  let reachable=false;
  let loginPageHasCode=false;
  let httpStatus=null;
  try{
    const r=await fetch('https://app.frontpad.ru/login/',{redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'User-Agent':'FARRUKH-AI/1.0'}});
    httpStatus=r.status;
    const html=await r.text();
    reachable=r.ok;
    loginPageHasCode=/Код|captcha|captcha/i.test(html);
  }catch(e){}
  res.json({
    ok:true,
    configured,
    reachable,
    httpStatus,
    loginPageHasCode,
    credentialsStoredOnServer:configured,
    automaticReports:false,
    reason:loginPageHasCode?'interactive_login_code_required':'report_api_not_confirmed',
    message:configured
      ? 'Доступ Frontpad сохранён на сервере. Сервер видит страницу входа. Автоматическое получение отчётов пока не включено: стандартная форма входа Frontpad требует дополнительный код, а публичный API отчётов не подтверждён.'
      : 'Логин и пароль Frontpad ещё не настроены на сервере.'
  });
});

function analyticsSnapshot(){
  const branches=[
    {name:'Полярные зори 43/1',units:49,strongCategory:'Роллы',strongCategoryUnits:23,topItem:'Чизкейк Классический',topItemUnits:9},
    {name:'Баумана 18',units:30,strongCategory:'Роллы',strongCategoryUnits:12,topItem:'Огурец маки',topItemUnits:3},
    {name:'ГС 33а',units:62,strongCategory:'Роллы',strongCategoryUnits:34,topItem:'Филадельфия',topItemUnits:4},
    {name:'Плазма',units:41,strongCategory:'Интеграция Яндекс',strongCategoryUnits:18,topItem:'Запеченная калифорния / Набор на персону',topItemUnits:2}
  ];
  return {
    ok:true,
    automaticReports:false,
    periodComplete:false,
    capturedAt:null,
    date:'03.10.2026',
    source:'ручные выгрузки Frontpad «Товары»',
    totalUnits:182,
    branches,
    summary:'По объёму проданных единиц лидирует ГС 33а — 62. Затем Полярные зори 43/1 — 49, Плазма — 41 и Баумана 18 — 30. На всех точках основная категория — роллы, кроме Плазмы, где заметная доля проходит через категорию «Интеграция Яндекс». Для управленческих выводов по выручке и прибыли нужно дополнительно подключить отчёты «Выручка», «Себестоимость» и «Прибыль и убытки».'
  };
}
app.get('/api/analytics/snapshot',(req,res)=>res.json(analyticsSnapshot()));

app.post('/api/chat',async(req,res)=>{
  const message=String(req.body?.message||'').trim();
  const context={...(req.body?.context||{}),frontpad:analyticsSnapshot()};
  if(!message)return res.status(400).json({error:'Пустая команда'});

  if(!hasKey)return res.json({reply:localReply(message,context),mode:'local'});

  try{
    const response=await client.responses.create({
      model:process.env.OPENAI_MODEL||'gpt-6-luna',
      instructions:buildInstructions(context),
      input:[...(Array.isArray(req.body?.history)?req.body.history:[]).slice(-12).filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,6000)})),{role:'user',content:message}]
    });
    res.json({reply:response.output_text||'Ответ без текста.',mode:'online'});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Ошибка AI API: '+(err?.message||'unknown')});
  }
});

// ---- Yandex Disk integration ----
const YANDEX_API='https://cloud-api.yandex.net/v1/disk';
const yandexToken=()=>String(process.env.YANDEX_DISK_TOKEN||'').trim();
const yandexHeaders=()=>({Authorization:`OAuth ${yandexToken()}`,'Content-Type':'application/json'});

function normalizeDiskPath(input='/FARRUKH_AI_STORAGE/'){
  let p=String(input||'').trim()||'/FARRUKH_AI_STORAGE/';
  if(!p.startsWith('/'))p='/'+p;
  p=p.replace(/\/{2,}/g,'/');
  if(!p.endsWith('/'))p+='/';
  return p;
}

async function yandexRequest(path, options={}){
  if(!yandexToken())throw new Error('YANDEX_DISK_TOKEN_NOT_CONFIGURED');
  const r=await fetch(`${YANDEX_API}${path}`,{...options,headers:{...yandexHeaders(),...(options.headers||{})}});
  if(r.status===204)return {ok:true,status:204};
  const text=await r.text();
  let data={};
  try{data=text?JSON.parse(text):{}}catch{data={message:text}}
  if(!r.ok){const e=new Error(data.message||data.description||`Yandex Disk HTTP ${r.status}`);e.status=r.status;e.data=data;throw e;}
  return data;
}

async function ensureFolder(path){
  const q=encodeURIComponent(path.replace(/\/$/,''));
  try{
    await yandexRequest(`/resources?path=${q}`,{method:'PUT'});
    return true;
  }catch(e){
    if(e.status===409)return true;
    throw e;
  }
}

app.get('/api/yandex/status',async(req,res)=>{
  if(!yandexToken())return res.json({configured:false,connected:false,reason:'token_missing'});
  try{
    const disk=await yandexRequest('/',{method:'GET'});
    res.json({configured:true,connected:true,totalSpace:disk.total_space,usedSpace:disk.used_space,user:disk.user||null});
  }catch(err){
    res.status(502).json({configured:true,connected:false,error:err.message});
  }
});

app.post('/api/yandex/setup',async(req,res)=>{
  const basePath=normalizeDiskPath(req.body?.basePath);
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск ещё не авторизован на сервере.',code:'token_missing'});
  try{
    await ensureFolder(basePath);
    const folders=['Menus','Photos','TechCards','Reports','Backups'];
    for(const folder of folders)await ensureFolder(`${basePath}${folder}/`);
    res.json({ok:true,basePath,folders});
  }catch(err){
    res.status(502).json({ok:false,error:err.message});
  }
});

app.get('/api/yandex/list',async(req,res)=>{
  const basePath=normalizeDiskPath(req.query?.path);
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск ещё не авторизован на сервере.',code:'token_missing'});
  try{
    const q=encodeURIComponent(basePath);
    const data=await yandexRequest(`/resources?path=${q}&limit=100`,{method:'GET'});
    const items=(data?._embedded?.items||[]).map(x=>({name:x.name,type:x.type,path:x.path,size:x.size||0,modified:x.modified||null}));
    res.json({ok:true,path:basePath,items});
  }catch(err){
    res.status(502).json({ok:false,error:err.message});
  }
});

app.post('/api/yandex/upload-json',async(req,res)=>{
  const basePath=normalizeDiskPath(req.body?.basePath);
  const folder=String(req.body?.folder||'Backups').replace(/[^a-zA-Z0-9_-]/g,'')||'Backups';
  const fileName=String(req.body?.fileName||`backup-${Date.now()}.json`).replace(/[^a-zA-Z0-9._-]/g,'_');
  const payload=req.body?.data??{};
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск ещё не авторизован на сервере.',code:'token_missing'});
  try{
    await ensureFolder(basePath);
    await ensureFolder(`${basePath}${folder}/`);
    const diskPath=`${basePath}${folder}/${fileName}`;
    const hrefData=await yandexRequest(`/resources/upload?path=${encodeURIComponent(diskPath)}&overwrite=true`,{method:'GET'});
    const upload=await fetch(hrefData.href,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload,null,2)});
    if(!upload.ok)throw new Error(`Ошибка загрузки файла: HTTP ${upload.status}`);
    res.json({ok:true,path:diskPath});
  }catch(err){
    res.status(502).json({ok:false,error:err.message});
  }
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`FARRUKH AI Mobile V3.7: http://localhost:${port}`));

