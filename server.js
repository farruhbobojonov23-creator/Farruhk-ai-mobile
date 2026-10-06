import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

const app = express();
app.use(express.json({limit:'20mb'}));
app.use(express.urlencoded({extended:false,limit:'1mb'}));

app.get(['/', '/index.html'], async (req,res,next)=>{
  try{
    const html=await fs.readFile(new URL('./public/index.html', import.meta.url),'utf8');
    const injected=html.includes('data-chef-studio')?html:html.replace('</body>','<script src="/analytics.js?v=4"></script></body>');
    res.type('html').send(injected);
  }catch(err){next(err);}
});

app.use(express.static('public'));

const geminiKey = String(process.env.GEMINI_API_KEY||'').trim();
const hasKey = Boolean(geminiKey);
const geminiModel = String(process.env.GEMINI_MODEL||'gemini-3.8-flash').trim();

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

app.get('/api/status',(req,res)=>res.json({ok:true,aiConnected:hasKey,aiProvider:hasKey?'gemini':'local',aiModel:hasKey?geminiModel:null,frontpadConfigured:frontpadConfigured(),version:'chef-4.1'}));

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
    {name:'Полярные зори 43/1',units:49,strongCategory:'Роллы',strongCategoryUnits:23,topItem:'Чизкейк Классический',topItemUnits:9},    {name:'Баумана 18',units:30,strongCategory:'Роллы',strongCategoryUnits:12,topItem:'Огурец маки',topItemUnits:3},
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
    const history=(Array.isArray(req.body?.history)?req.body.history:[])
      .slice(-12)
      .filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string')
      .map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content.slice(0,6000)}]}));
    const body={
      systemInstruction:{parts:[{text:buildInstructions(context)}]},
      contents:[...history,{role:'user',parts:[{text:message}]}],
      generationConfig:{temperature:0.5}
    };
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(geminiModel)+':generateContent?key='+encodeURIComponent(geminiKey);
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(30000)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.error?.message||('Gemini HTTP '+r.status));
    const reply=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||'').join('').trim();
    res.json({reply:reply||'Ответ без текста.',mode:'online',provider:'gemini',model:geminiModel});
  }catch(err){
    console.error(err);
    res.status(500).json({error:'Ошибка Gemini API: '+(err?.message||'unknown')});
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
    res.status(502).json({ok:false,error:err.message});  }
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


// ---- SHEF51 Admin + persistent menu ----
const shef51AdminPassword=()=>String(process.env.SHEF51_ADMIN_PASSWORD||'').trim();
const shef51AdminSecret=()=>String(process.env.SHEF51_ADMIN_SECRET||'').trim();
const SHEF51_BASE='/FARRUKH_AI_STORAGE/SHEF51/';
const SHEF51_MENU_PATH=SHEF51_BASE+'menu.json';
const SHEF51_PHOTOS_PATH=SHEF51_BASE+'Photos/';
const SHEF51_DRAFT_PATH=SHEF51_BASE+'site-draft.json';
const SHEF51_PUBLISHED_PATH=SHEF51_BASE+'site-published.json';
const SHEF51_BACKUPS_PATH=SHEF51_BASE+'Backups/';
const SHEF51_BOOKINGS_PATH=SHEF51_BASE+'Bookings/';
const SHEF51_ANALYTICS_PATH=SHEF51_BASE+'Analytics/';
const SHEF51_TELEGRAM_CHAT_PATH=SHEF51_BASE+'telegram-chat.json';

const defaultShef51Config=()=>({
  general:{
    siteName:'SHEF51',
    brandLine:'FARRUKH AKA',
    whatsapp:'+7 966 123-29-92',
    telegram:'',
    footerText:'SHEF51 · FARRUKH AKA'
  },
  navigation:{
    home:'Главная',products:'Товары',services:'Услуги',about:'Обо мне',book:'Забронировать'
  },
  home:{
    eyebrow:'PRIVATE CHEF · JAPANESE & ITALIAN CUISINE',
    title:'Ресторанный вечер у вас дома',
    lead:'Персональный шеф для ужинов, дней рождения, свадеб, вечеринок и особенных событий. Только один заказ в день — всё внимание вашему вечеру.',
    primaryButton:'Выбрать дату',
    secondaryButton:'Смотреть товары',
    heroImage:''
  },
  pages:{
    productsTitle:'Товары',
    productsLead:'Выберите категорию. Актуальное меню и фотографии обновляются владельцем сайта.',
    servicesTitle:'Услуги',
    aboutTitle:'Обо мне',
    bookingTitle:'Забронировать'
  },
  design:{
    background:'#050505',
    surface:'#0b0b0b',
    text:'#ffffff',
    muted:'#9b9b9b',
    accent:'#ef2634',
    border:'#242424',
    radius:24,
    fontScale:100
  },
  sections:{
    products:true,services:true,booking:true
  },
  seo:{
    title:'SHEF51 — Фаррух Ака',
    description:'Персональный шеф японской кухни. Частные ужины, мероприятия и профессиональные услуги.'
  },
  customText:{},
  customImages:{},
  hiddenElements:{}
});

const shef51Descriptions={
  'Филадельфия':'🍣 Нежный лосось, прохладный сливочный сыр и свежий хрустящий огурец — мягкий, сливочный вкус с сочным морским акцентом. Классика, к которой хочется возвращаться. ✨',
  'Филадельфия Премиум':'🔥 Щедрый слой сочного лосося снаружи и ещё больше лосося внутри, нежный сливочный сыр и свежий огурец. Насыщенный, кремовый и по-настоящему премиальный вкус. 🍣',
  'Филадельфия Тигровая':'🦐 Сочная тигровая креветка, нежный сливочный сыр и свежий хрустящий огурец — лёгкое сочетание морского вкуса, кремовой текстуры и свежести. ✨',
  'Филадельфия Тигровая Премиум':'🦐🔥 Тигровая креветка под пикантным сладко-острым соусом, сочный лосось, нежный сливочный сыр и свежий огурец. Яркий, насыщенный ролл с аппетитной остринкой. ✨',
  'Суши лосось':'🍣 Нежный охлаждённый лосось на аккуратной подушке риса — чистый, сочный вкус без лишнего. Простая классика, где главное — качество продукта. ✨',
  'Удон сливочный':'🍜 Упругая лапша удон в нежном сливочном соусе — горячая, кремовая и очень уютная текстура. Мягкий насыщенный вкус, который хочется доесть до последней вилки. 🤍',
  'Удон с креветкой терияки':'🦐🍜 Упругая лапша удон, сочная креветка и насыщенный соус терияки — сладко-солёный вкус, яркий аромат и аппетитная глазировка в каждом кусочке. 🔥',
  'Удон с курицей сливочный':'🍗🤍 Нежная курица, упругая лапша удон и мягкий сливочный соус — горячее, кремовое и очень уютное сочетание с насыщенным вкусом. 🍜',
  'Удон с курицей терияки':'🍗🔥 Сочная курица в ароматном соусе терияки с упругой лапшой удон — насыщенный сладко-солёный вкус и аппетитная карамельная нотка. 🍜',
  'Гейша с креветкой':'🦐✨ Нежная креветка, сливочная текстура и свежие акценты в аккуратном ролле — лёгкий морской вкус, который раскрывается мягко и деликатно. 🍣',
  'Гейша с лососем':'🍣✨ Нежный лосось, мягкая сливочная начинка и свежесть овощей — сбалансированный ролл с сочным морским вкусом и кремовой текстурой. 🤍',
  'Гейша с крабом':'🦀🍣 Нежный краб, сливочная начинка и свежий хрустящий акцент — мягкий, сочный ролл с деликатным вкусом морепродуктов. ✨',
  'Суши с угрем':'🍣🔥 Нежный угорь с аппетитной глазурью на рисе — насыщенный сладковато-копчёный вкус, мягкая текстура и яркий японский акцент. ✨',
  'Суши с креветкой':'🦐🍣 Сочная креветка на аккуратной подушке риса — чистый морской вкус, лёгкая сладость и нежная текстура без лишнего. ✨'
};
const shef51OldDescriptions={
  'Филадельфия':'Нежный лосось, обволакивающий ролл снаружи, сливочный сыр с мягким кремовым вкусом и свежий хрустящий огурец внутри — классическое сочетание, где каждый кусочек получается сочным и сбалансированным.',
  'Филадельфия Премиум':'Щедрый слой нежного лосося снаружи, внутри — ещё больше сочного лосося, мягкий сливочный сыр, свежий хрустящий огурец, рис и нори.',
  'Филадельфия Тигровая':'Нежная тигровая креветка сверху, кремовый сливочный сыр и свежий хрустящий огурец внутри.',
  'Филадельфия Тигровая Премиум':'Тигровая креветка под пикантным сладко-острым соусом, сочный лосось внутри, нежный сливочный сыр и свежий хрустящий огурец.',
  'Суши лосось':'рис, лосось',
  'Удон сливочный':'лапша удон, сливочный соус'
};
const defaultShef51Menu=()=>[
  {id:'philadelphia',category:'rolls',name:'Филадельфия',description:shef51Descriptions['Филадельфия'],portion:'Порция — 8 шт.',visible:true,order:10,imageUrl:''},
  {id:'philadelphia-premium',category:'rolls',name:'Филадельфия Премиум',description:shef51Descriptions['Филадельфия Премиум'],portion:'Порция — 8 шт.',visible:true,order:20,imageUrl:''},
  {id:'philadelphia-tiger',category:'rolls',name:'Филадельфия Тигровая',description:shef51Descriptions['Филадельфия Тигровая'],portion:'Порция — 8 шт.',visible:true,order:30,imageUrl:''},
  {id:'philadelphia-tiger-premium',category:'rolls',name:'Филадельфия Тигровая Премиум',description:shef51Descriptions['Филадельфия Тигровая Премиум'],portion:'Порция — 8 шт.',visible:true,order:40,imageUrl:''},
  {id:'sushi-salmon',category:'sushi',name:'Суши лосось',description:shef51Descriptions['Суши лосось'],portion:'Порция — 8 шт.',visible:true,order:50,imageUrl:''},
  {id:'udon-cream',category:'wok',name:'Удон сливочный',description:shef51Descriptions['Удон сливочный'],portion:'Порция — 8 шт.',visible:true,order:60,imageUrl:''}
];

function shef51Cors(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Cache-Control','no-store');
}

async function yandexDownloadLink(path){
  return yandexRequest('/resources/download?path='+encodeURIComponent(path),{method:'GET'});
}
async function readYandexJson(path){
  try{
    const d=await yandexDownloadLink(path);
    const r=await fetch(d.href,{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('Download HTTP '+r.status);
    return await r.json();
  }catch(err){
    if(err?.status===404)return null;
    throw err;
  }
}
async function writeYandexFile(path,body,contentType='application/octet-stream'){
  const dir=path.slice(0,path.lastIndexOf('/')+1);
  await ensureFolder(SHEF51_BASE);
  if(dir&&dir!==SHEF51_BASE)await ensureFolder(dir);
  const hrefData=await yandexRequest('/resources/upload?path='+encodeURIComponent(path)+'&overwrite=true',{method:'GET'});
  const upload=await fetch(hrefData.href,{method:'PUT',headers:{'Content-Type':contentType},body});
  if(!upload.ok)throw new Error('Yandex upload HTTP '+upload.status);
}
async function getShef51Menu(){
  if(!yandexToken())return defaultShef51Menu();
  try{
    const stored=await readYandexJson(SHEF51_MENU_PATH);
    if(!Array.isArray(stored?.items))return defaultShef51Menu();
    let changed=false;
    const items=stored.items.map(x=>{
      const old=shef51OldDescriptions[x?.name];
      const fresh=shef51Descriptions[x?.name];
      if(fresh && (!x.description || x.description===old)){
        changed=true;
        return {...x,description:fresh};
      }
      return x;
    });
    if(changed){
      writeYandexFile(SHEF51_MENU_PATH,JSON.stringify({items},null,2),'application/json').catch(err=>console.error('SHEF51 description migration',err));
    }
    return items;
  }catch(err){
    console.error('SHEF51 menu read',err);
    return defaultShef51Menu();
  }
}
function cleanText(v,max=500){return String(v??'').trim().slice(0,max);}
function cleanItem(x,i){
  const id=(cleanText(x?.id,80)||('item-'+Date.now()+'-'+i)).toLowerCase().replace(/[^a-z0-9_-]/g,'-');
  const category=['rolls','sushi','wok'].includes(x?.category)?x.category:'rolls';
  return {
    id,category,
    name:cleanText(x?.name,120)||'Без названия',
    description:cleanText(x?.description,1200),
    portion:cleanText(x?.portion,120),
    visible:x?.visible!==false,
    order:Number.isFinite(Number(x?.order))?Number(x.order):i*10,
    imageUrl:cleanText(x?.imageUrl,500)
  };
}

function b64url(input){return Buffer.from(input).toString('base64url');}
function signSession(payload){
  const body=b64url(JSON.stringify(payload));
  const sig=crypto.createHmac('sha256',shef51AdminSecret()).update(body).digest('base64url');
  return body+'.'+sig;
}
function verifySession(token){
  try{
    const [body,sig]=String(token||'').split('.');
    if(!body||!sig||!shef51AdminSecret())return null;
    const expected=crypto.createHmac('sha256',shef51AdminSecret()).update(body).digest('base64url');
    if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
    const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(!p?.exp||Date.now()>p.exp)return null;
    return p;
  }catch{return null;}
}
function cookieValue(req,name){
  const raw=String(req.headers.cookie||'');
  for(const part of raw.split(';')){
    const [k,...rest]=part.trim().split('=');
    if(k===name)return decodeURIComponent(rest.join('='));
  }
  return '';
}
function requireShef51Admin(req,res,next){
  const session=verifySession(cookieValue(req,'shef51_admin'));
  if(!session)return res.status(401).json({ok:false,error:'Нужен вход владельца'});
  req.shef51Admin=session; next();
}
const loginAttempts=new Map();
function loginAllowed(ip){
  const now=Date.now(), row=loginAttempts.get(ip)||{count:0,reset:now+10*60*1000};
  if(now>row.reset){row.count=0;row.reset=now+10*60*1000;}
  loginAttempts.set(ip,row);
  return row.count<8;
}
function noteBadLogin(ip){
  const row=loginAttempts.get(ip)||{count:0,reset:Date.now()+10*60*1000};
  row.count++;loginAttempts.set(ip,row);
}


app.get('/shef51-editor',(req,res)=>res.redirect('/shef51-editor.html'));

app.get('/api/shef51/admin/visual-page',requireShef51Admin,async(req,res)=>{
  const allowed=new Set(['index.html','products.html','services.html','about.html','book.html']);
  const page=allowed.has(String(req.query?.page||''))?String(req.query.page):'index.html';
  try{
    const r=await fetch('https://shef51.onrender.com/'+page,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'SHEF51-Editor/1.0'}});
    if(!r.ok)throw new Error('SHEF51 HTTP '+r.status);
    let html=await r.text();
    const inject=`
<style id="shef51-editor-style">
[data-shef-edit]{outline:2px dashed transparent;outline-offset:5px;transition:.15s;cursor:text}
[data-shef-edit]:hover{outline-color:#ff3344;background:#ff33440b}
[data-shef-photo]{outline:2px dashed transparent;outline-offset:6px;cursor:pointer}
[data-shef-photo]:hover{outline-color:#ff3344}
.shef-editor-selected{outline:2px solid #ff3344!important;box-shadow:0 0 0 4px #ff334422!important}
</style>
<script>
(function(){
 const map=[];
 const tag=(sel,key,all=false)=>{
   const els=all?[...document.querySelectorAll(sel)]:[document.querySelector(sel)].filter(Boolean);
   els.forEach((el,i)=>{el.dataset.shefEdit=all?(key+'.'+i):key;el.contentEditable='true';el.spellcheck=false;});
 };
 const photo=(sel,key)=>{const el=document.querySelector(sel);if(el){el.dataset.shefPhoto=key;}};
 const path=${JSON.stringify(page)};
 if(path==='index.html'||path===''){
   tag('.hero .eyebrow','home.eyebrow');tag('.hero h1','home.title');tag('.hero .lead','home.lead');
   const acts=document.querySelectorAll('.hero .actions .btn');if(acts[0]){acts[0].dataset.shefEdit='home.primaryButton';acts[0].contentEditable='true'};if(acts[1]){acts[1].dataset.shefEdit='home.secondaryButton';acts[1].contentEditable='true'};
   photo('.heroArt img','home.heroImage');
 }
 if(path==='products.html'){tag('.pageHead h1','pages.productsTitle');tag('.pageHead .lead','pages.productsLead');}
 if(path==='services.html')tag('h1','pages.servicesTitle');
 if(path==='about.html')tag('h1','pages.aboutTitle');
 if(path==='book.html')tag('h1','pages.bookingTitle');
 document.querySelectorAll('.links a').forEach(a=>{const href=a.getAttribute('href');const m={'index.html':'navigation.home','products.html':'navigation.products','services.html':'navigation.services','about.html':'navigation.about','book.html':'navigation.book'};if(m[href]){a.dataset.shefEdit=m[href];a.contentEditable='true'}});
 document.addEventListener('click',e=>{
   const a=e.target.closest('a[href]');if(a&&!a.hasAttribute('data-shef-edit')){const href=a.getAttribute('href');if(/^(index|products|services|about|book)\.html$/.test(href)){e.preventDefault();parent.postMessage({type:'shef-nav',page:href},'*');return}}
   const el=e.target.closest('[data-shef-edit],[data-shef-photo],[data-shef-generic],[data-shef-generic-photo]');
   document.querySelectorAll('.shef-editor-selected').forEach(x=>x.classList.remove('shef-editor-selected'));
   if(el){el.classList.add('shef-editor-selected');parent.postMessage({type:'shef-select',edit:el.dataset.shefEdit||null,photo:el.dataset.shefPhoto||null,generic:el.dataset.shefGeneric||null,genericPhoto:el.dataset.shefGenericPhoto||null,text:el.innerText||'',tag:el.tagName},'*')}
 },true);
 document.addEventListener('input',e=>{
   const el=e.target.closest('[data-shef-edit],[data-shef-generic]');if(el)parent.postMessage({type:'shef-change',key:el.dataset.shefEdit||null,generic:el.dataset.shefGeneric||null,value:el.innerText},'*')
 });
 document.addEventListener('keydown',e=>{if(e.target.closest('[data-shef-edit]')&&e.key==='Enter'){e.preventDefault();e.target.blur()}});
})();
<\/script>`;
    html=html.replace(/<script[^>]+src=["']cms\.js[^>]*><\/script>/ig,'');
    html=html.replace('</body>',inject+'</body>');
    res.setHeader('Cache-Control','no-store');
    res.type('html').send(html);
  }catch(err){
    console.error('visual editor page error',err);
    res.status(502).type('html').send('<h1 style="font-family:sans-serif">Не удалось загрузить страницу сайта</h1>');
  }
});
app.get('/shef51-admin',(req,res)=>res.redirect('/shef51-admin.html'));
app.get('/shef51-owner',async(req,res,next)=>{
  try{
    const html=await fs.readFile(new URL('./public/shef51-admin.html', import.meta.url),'utf8');
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    res.type('html').send(html);
  }catch(err){next(err);}
});


app.post('/api/shef51/admin/login',(req,res)=>{
  const ip=String(req.ip||req.socket?.remoteAddress||'unknown');
  if(!loginAllowed(ip))return res.status(429).json({ok:false,error:'Слишком много попыток. Попробуйте позже.'});
  const expected=shef51AdminPassword(), got=String(req.body?.password||'');
  if(!expected||!shef51AdminSecret())return res.status(503).json({ok:false,error:'Админка ещё не настроена на сервере.'});
  const a=Buffer.from(got), b=Buffer.from(expected);
  const ok=a.length===b.length&&crypto.timingSafeEqual(a,b);
  if(!ok){noteBadLogin(ip);return res.status(401).json({ok:false,error:'Неверный пароль'});}
  loginAttempts.delete(ip);
  const token=signSession({role:'owner',exp:Date.now()+7*24*60*60*1000});
  res.setHeader('Set-Cookie','shef51_admin='+encodeURIComponent(token)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800');
  res.json({ok:true});
});
app.post('/shef51-admin-login',(req,res)=>{
  const ip=String(req.ip||req.socket?.remoteAddress||'unknown');
  if(!loginAllowed(ip))return res.status(429).type('html').send('<meta charset="utf-8"><body style="background:#050505;color:#fff;font-family:Arial;padding:30px">Слишком много попыток. Попробуйте позже.<br><br><a style="color:#ff3344" href="/shef51-admin">Назад</a></body>');
  const expected=shef51AdminPassword(), got=String(req.body?.password||'');
  if(!expected||!shef51AdminSecret())return res.status(503).type('html').send('<meta charset="utf-8"><body style="background:#050505;color:#fff;font-family:Arial;padding:30px">Админка ещё не настроена на сервере.<br><br><a style="color:#ff3344" href="/shef51-admin">Назад</a></body>');
  const a=Buffer.from(got), b=Buffer.from(expected);
  const ok=a.length===b.length&&crypto.timingSafeEqual(a,b);
  if(!ok){
    noteBadLogin(ip);
    return res.status(401).type('html').send('<meta charset="utf-8"><body style="background:#050505;color:#fff;font-family:Arial;padding:30px">Неверный пароль.<br><br><a style="color:#ff3344" href="/shef51-admin">Вернуться</a></body>');
  }
  loginAttempts.delete(ip);
  const token=signSession({role:'owner',exp:Date.now()+7*24*60*60*1000});
  res.setHeader('Set-Cookie','shef51_admin='+encodeURIComponent(token)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800');
  res.redirect(303,'/shef51-owner');
});

app.post('/api/shef51/admin/logout',(req,res)=>{
  res.setHeader('Set-Cookie','shef51_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ok:true});
});
app.get('/api/shef51/admin/session',(req,res)=>{
  res.json({ok:Boolean(verifySession(cookieValue(req,'shef51_admin')))});
});

async function getShef51Config(kind='draft'){
  const path=kind==='published'?SHEF51_PUBLISHED_PATH:SHEF51_DRAFT_PATH;
  if(!yandexToken())return defaultShef51Config();
  try{
    const stored=await readYandexJson(path);
    return stored&&typeof stored==='object'?stored:defaultShef51Config();
  }catch(err){
    console.error('SHEF51 config read',kind,err);
    return defaultShef51Config();
  }
}
function mergeShef51Config(raw={}){
  const d=defaultShef51Config();
  const safe=(obj,key,max=300)=>cleanText(obj?.[key],max)||d?.[key];
  const cfg={
    general:{...d.general,...(raw.general||{})},
    navigation:{...d.navigation,...(raw.navigation||{})},
    home:{...d.home,...(raw.home||{})},
    pages:{...d.pages,...(raw.pages||{})},
    design:{...d.design,...(raw.design||{})},
    sections:{...d.sections,...(raw.sections||{})},
    seo:{...d.seo,...(raw.seo||{})},
    customText:{...(raw.customText||{})},
    customImages:{...(raw.customImages||{})},
    hiddenElements:{...(raw.hiddenElements||{})}
  };
  for(const k of Object.keys(cfg.general))cfg.general[k]=cleanText(cfg.general[k],300);
  for(const k of Object.keys(cfg.navigation))cfg.navigation[k]=cleanText(cfg.navigation[k],80);
  for(const k of Object.keys(cfg.home))cfg.home[k]=cleanText(cfg.home[k],1200);
  for(const k of Object.keys(cfg.pages))cfg.pages[k]=cleanText(cfg.pages[k],700);
  cfg.design.background=/^#[0-9a-f]{6}$/i.test(cfg.design.background)?cfg.design.background:d.design.background;
  cfg.design.surface=/^#[0-9a-f]{6}$/i.test(cfg.design.surface)?cfg.design.surface:d.design.surface;
  cfg.design.text=/^#[0-9a-f]{6}$/i.test(cfg.design.text)?cfg.design.text:d.design.text;
  cfg.design.muted=/^#[0-9a-f]{6}$/i.test(cfg.design.muted)?cfg.design.muted:d.design.muted;
  cfg.design.accent=/^#[0-9a-f]{6}$/i.test(cfg.design.accent)?cfg.design.accent:d.design.accent;
  cfg.design.border=/^#[0-9a-f]{6}$/i.test(cfg.design.border)?cfg.design.border:d.design.border;
  cfg.design.radius=Math.max(0,Math.min(60,Number(cfg.design.radius)||d.design.radius));
  cfg.design.fontScale=Math.max(80,Math.min(130,Number(cfg.design.fontScale)||d.design.fontScale));
  for(const k of Object.keys(cfg.sections))cfg.sections[k]=cfg.sections[k]!==false;
  cfg.seo.title=cleanText(cfg.seo.title,180);
  cfg.seo.description=cleanText(cfg.seo.description,320);
  cfg.customText=Object.fromEntries(Object.entries(cfg.customText||{}).slice(0,1000).map(([k,v])=>[cleanText(k,180),cleanText(v,5000)]));
  cfg.customImages=Object.fromEntries(Object.entries(cfg.customImages||{}).slice(0,500).map(([k,v])=>[cleanText(k,180),cleanText(v,600)]));
  cfg.hiddenElements=Object.fromEntries(Object.entries(cfg.hiddenElements||{}).slice(0,1000).map(([k,v])=>[cleanText(k,180),Boolean(v)]));
  return cfg;
}


function shef51MoscowStart(days=7){
  const DAY=86400000,H=3600000;
  const now=Date.now();
  const shifted=new Date(now+3*H);
  const todayStart=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-3*H;
  return todayStart-(Math.max(1,days)-1)*DAY;
}
function shef51MoscowDay(ts){
  return new Date(Number(ts)+3*3600000).toISOString().slice(0,10);
}
async function shef51AnalyticsEvents(days=30){
  if(!yandexToken())return [];
  const DAY=86400000;
  const start=shef51MoscowStart(days);
  const folderStart=Math.floor((start-DAY)/DAY)*DAY;
  const folderEnd=Math.floor(Date.now()/DAY)*DAY;
  const files=[];
  for(let t=folderStart;t<=folderEnd;t+=DAY){
    const day=new Date(t).toISOString().slice(0,10);
    const path=SHEF51_ANALYTICS_PATH+day+'/';
    try{
      const q=encodeURIComponent(path);
      const d=await yandexRequest('/resources?path='+q+'&limit=1000&sort=name',{method:'GET'});
      for(const x of (d?._embedded?.items||[])){
        if(x.type==='file'&&/\.json$/i.test(x.name))files.push(path+x.name);
      }
    }catch(err){
      if(err?.status!==404)console.error('SHEF51 analytics list',day,err?.message||err);
    }
  }
  const rows=[];
  for(let i=0;i<files.length;i+=12){
    const batch=files.slice(i,i+12);
    const got=await Promise.all(batch.map(p=>readYandexJson(p).catch(()=>null)));
    for(const row of got){
      const ts=Date.parse(row?.createdAt||'');
      if(row&&Number.isFinite(ts)&&ts>=start&&ts<=Date.now()+60000)rows.push(row);
    }
  }
  return rows;
}
app.get('/api/shef51/admin/analytics-summary',requireShef51Admin,async(req,res)=>{
  const days=Math.max(1,Math.min(30,Number(req.query?.days)||7));
  try{
    const rows=await shef51AnalyticsEvents(days);
    const byEvent={},byPage={},services={},products={},daily={};
    const visitors=new Set(),sessions=new Set();
    for(const r of rows){
      const ev=String(r.event||'unknown');
      byEvent[ev]=(byEvent[ev]||0)+1;
      const day=shef51MoscowDay(Date.parse(r.createdAt));
      daily[day]??={views:0,bookings:0,cta:0};
      if(ev==='page_view'){
        daily[day].views++;
        const p=String(r.page||'index.html');
        byPage[p]=(byPage[p]||0)+1;
      }
      if(ev==='booking_submit_success')daily[day].bookings++;
      if(ev==='booking_cta')daily[day].cta++;
      const vid=String(r.meta?.visitorId||'').trim();
      const sid=String(r.meta?.sessionId||'').trim();
      if(vid)visitors.add(vid);
      if(sid)sessions.add(sid);
      if(ev==='service_details'){
        const label=String(r.label||'').trim();
        if(label)services[label]=(services[label]||0)+1;
      }
      if(ev==='product_details'){
        const label=String(r.label||'').trim();
        if(label)products[label]=(products[label]||0)+1;
      }
    }
    const views=byEvent.page_view||0;
    const bookingCta=byEvent.booking_cta||0;
    const formStarts=byEvent.form_start||0;
    const bookings=byEvent.booking_submit_success||0;
    const sortObj=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count}));
    const daysOut=Object.entries(daily).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({date,...v}));
    res.json({
      ok:true,days,generatedAt:new Date().toISOString(),
      totals:{
        views,
        visitors:visitors.size||null,
        sessions:sessions.size||null,
        bookingCta,formStarts,bookings,
        conversion:views?Number((bookings/views*100).toFixed(1)):0
      },
      events:byEvent,
      pages:sortObj(byPage),
      services:sortObj(services),
      products:sortObj(products),
      daily:daysOut
    });
  }catch(err){
    console.error('SHEF51 analytics summary error',err);
    res.status(502).json({ok:false,error:'Не удалось загрузить статистику: '+(err?.message||'unknown')});
  }
});

app.get('/api/shef51/admin/site-config',requireShef51Admin,async(req,res)=>{
  res.json({ok:true,config:await getShef51Config('draft')});
});
app.put('/api/shef51/admin/site-config',requireShef51Admin,async(req,res)=>{
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск не подключён.'});
  try{
    const config=mergeShef51Config(req.body?.config||{});
    await writeYandexFile(SHEF51_DRAFT_PATH,JSON.stringify(config,null,2),'application/json');
    res.json({ok:true,config});
  }catch(err){console.error(err);res.status(502).json({ok:false,error:'Не удалось сохранить черновик: '+err.message});}
});
app.post('/api/shef51/admin/publish',requireShef51Admin,async(req,res)=>{
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск не подключён.'});
  try{
    const config=mergeShef51Config(await getShef51Config('draft'));
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    await ensureFolder(SHEF51_BACKUPS_PATH);
    const current=await readYandexJson(SHEF51_PUBLISHED_PATH);
    if(current)await writeYandexFile(SHEF51_BACKUPS_PATH+'site-'+stamp+'.json',JSON.stringify(current,null,2),'application/json');
    await writeYandexFile(SHEF51_PUBLISHED_PATH,JSON.stringify(config,null,2),'application/json');
    res.json({ok:true,publishedAt:new Date().toISOString(),config});
  }catch(err){console.error(err);res.status(502).json({ok:false,error:'Не удалось опубликовать: '+err.message});}
});
app.get('/api/shef51/admin/history',requireShef51Admin,async(req,res)=>{
  try{
    await ensureFolder(SHEF51_BACKUPS_PATH);
    const q=encodeURIComponent(SHEF51_BACKUPS_PATH);
    const data=await yandexRequest('/resources?path='+q+'&limit=50&sort=-modified',{method:'GET'});
    const items=(data?._embedded?.items||[]).filter(x=>x.type==='file'&&/^site-.*\.json$/i.test(x.name)).map(x=>({name:x.name,modified:x.modified||null,size:x.size||0}));
    res.json({ok:true,items});
  }catch(err){res.status(502).json({ok:false,error:err.message});}
});
app.post('/api/shef51/admin/restore',requireShef51Admin,async(req,res)=>{
  const name=String(req.body?.name||'');
  if(!/^site-[a-z0-9T-]+\.json$/i.test(name))return res.status(400).json({ok:false,error:'Неверная версия'});
  try{
    const cfg=await readYandexJson(SHEF51_BACKUPS_PATH+name);
    if(!cfg)return res.status(404).json({ok:false,error:'Версия не найдена'});
    const config=mergeShef51Config(cfg);
    await writeYandexFile(SHEF51_DRAFT_PATH,JSON.stringify(config,null,2),'application/json');
    res.json({ok:true,config});
  }catch(err){res.status(502).json({ok:false,error:err.message});}
});
app.options('/api/shef51/site-config',(req,res)=>{shef51Cors(req,res);res.sendStatus(204);});
app.get('/api/shef51/site-config',async(req,res)=>{
  shef51Cors(req,res);
  res.setHeader('Cache-Control','public, max-age=30, stale-while-revalidate=300');
  res.json({ok:true,config:await getShef51Config('published')});
});

app.get('/api/shef51/admin/menu',requireShef51Admin,async(req,res)=>{
  res.json({ok:true,items:await getShef51Menu(),storage:yandexToken()?'yandex':'fallback'});
});
app.put('/api/shef51/admin/menu',requireShef51Admin,async(req,res)=>{
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск не подключён — постоянное сохранение недоступно.'});
  const raw=Array.isArray(req.body?.items)?req.body.items:[];
  const items=raw.slice(0,200).map(cleanItem).sort((a,b)=>a.order-b.order);
  try{
    await writeYandexFile(SHEF51_MENU_PATH,JSON.stringify({updatedAt:new Date().toISOString(),items},null,2),'application/json');
    res.json({ok:true,items});
  }catch(err){console.error(err);res.status(502).json({ok:false,error:'Не удалось сохранить меню: '+err.message});}
});
app.post('/api/shef51/admin/upload',requireShef51Admin,async(req,res)=>{
  if(!yandexToken())return res.status(503).json({ok:false,error:'Яндекс Диск не подключён.'});
  const data=String(req.body?.data||'');
  const name=cleanText(req.body?.name,80).toLowerCase().replace(/[^a-z0-9_-]/g,'-')||'photo';
  const m=data.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
  if(!m)return res.status(400).json({ok:false,error:'Поддерживаются JPG, PNG и WEBP.'});
  const subtype=m[1]==='jpg'?'jpeg':m[1];
  const ext=subtype==='jpeg'?'jpg':subtype;
  const buf=Buffer.from(m[2].replace(/\s+/g,''),'base64');
  if(!buf.length||buf.length>8*1024*1024)return res.status(400).json({ok:false,error:'Фото должно быть до 8 МБ.'});
  const id=name+'-'+Date.now()+'.'+ext;
  try{
    await writeYandexFile(SHEF51_PHOTOS_PATH+id,buf,'image/'+subtype);
    res.json({ok:true,imageId:id,imageUrl:'/api/shef51/image/'+encodeURIComponent(id)});
  }catch(err){console.error(err);res.status(502).json({ok:false,error:'Не удалось загрузить фото: '+err.message});}
});

app.options('/api/shef51/menu',(req,res)=>{shef51Cors(req,res);res.sendStatus(204);});
app.get('/api/shef51/menu',async(req,res)=>{
  shef51Cors(req,res);
  res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=600');
  const items=(await getShef51Menu()).filter(x=>x.visible!==false).sort((a,b)=>(a.order||0)-(b.order||0));
  res.json({ok:true,items});
});
app.get('/api/shef51/image/:id',async(req,res)=>{
  const id=String(req.params.id||'');
  if(!/^[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(id))return res.sendStatus(400);
  try{
    const d=await yandexDownloadLink(SHEF51_PHOTOS_PATH+id);
    const r=await fetch(d.href,{signal:AbortSignal.timeout(20000),redirect:'follow'});
    if(!r.ok)throw new Error('Image download HTTP '+r.status);
    const type=r.headers.get('content-type')||(
      /\.png$/i.test(id)?'image/png':
      /\.webp$/i.test(id)?'image/webp':'image/jpeg'
    );
    res.setHeader('Content-Type',type);
    const len=r.headers.get('content-length');
    if(len)res.setHeader('Content-Length',len);
    // Image ids are unique on every upload, so the original can be cached for a year safely.
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options','nosniff');

    // Stream the original bytes immediately instead of waiting for the whole file to
    // download to Render first. Quality is unchanged and first paint starts sooner.
    if(r.body){
      Readable.fromWeb(r.body).on('error',err=>{
        console.error('SHEF51 image stream error',id,err?.message||err);
        if(!res.headersSent)res.sendStatus(502); else res.destroy(err);
      }).pipe(res);
    }else{
      const buf=Buffer.from(await r.arrayBuffer());
      res.send(buf);
    }
  }catch(err){
    console.error('SHEF51 image proxy error',id,err?.message||err);
    if(!res.headersSent)res.sendStatus(404);
  }
});

// ---- SHEF51 lightweight first-party analytics ----
function analyticsCors(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
}
app.options('/api/shef51/analytics',(req,res)=>{analyticsCors(req,res);res.sendStatus(204);});
app.post('/api/shef51/analytics',async(req,res)=>{
  analyticsCors(req,res);
  const event=cleanText(req.body?.event,80).replace(/[^a-z0-9_.-]/gi,'_')||'unknown';
  const page=cleanText(req.body?.page,180);
  const label=cleanText(req.body?.label,180);
  const href=cleanText(req.body?.href,300);
  const meta=(req.body?.meta&&typeof req.body.meta==='object')?req.body.meta:{};
  const safeMeta={};
  for(const [k,v] of Object.entries(meta).slice(0,12)){
    safeMeta[cleanText(k,40)]=cleanText(v,160);
  }
  const now=new Date();
  const day=now.toISOString().slice(0,10);
  const item={
    id:'event-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'),
    createdAt:now.toISOString(),
    event,page,label,href,meta:safeMeta
  };
  if(yandexToken()){
    try{
      await ensureFolder(SHEF51_ANALYTICS_PATH);
      await ensureFolder(SHEF51_ANALYTICS_PATH+day+'/');
      await writeYandexFile(
        SHEF51_ANALYTICS_PATH+day+'/'+item.id+'.json',
        JSON.stringify(item,null,2),
        'application/json'
      );
    }catch(err){
      console.error('SHEF51 analytics save error',err?.message||err);
    }
  }
  res.json({ok:true});
});

// ---- SHEF51 Telegram booking ----
const telegramToken=()=>String(process.env.TELEGRAM_BOT_TOKEN||'').trim();

async function telegramRequest(method,payload={}){
  const token=telegramToken();
  if(!token)throw new Error('TELEGRAM_BOT_TOKEN_NOT_CONFIGURED');
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(12000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok)throw new Error(data?.description||`Telegram HTTP ${r.status}`);
  return data.result;
}

async function telegramChatId(){
  const envId=String(process.env.TELEGRAM_CHAT_ID||'').trim();
  if(envId)return envId;

  if(yandexToken()){
    try{
      const saved=await readYandexJson(SHEF51_TELEGRAM_CHAT_PATH);
      const savedId=String(saved?.chatId||'').trim();
      if(savedId)return savedId;
    }catch{}
  }

  const updates=await telegramRequest('getUpdates',{limit:100,timeout:0});
  const chats=(Array.isArray(updates)?updates:[])
    .map(u=>u?.message?.chat||u?.edited_message?.chat||u?.callback_query?.message?.chat)
    .filter(c=>c&&c.type==='private'&&c.id);
  const id=chats.length?String(chats[chats.length-1].id):'';

  if(id&&yandexToken()){
    writeYandexFile(
      SHEF51_TELEGRAM_CHAT_PATH,
      JSON.stringify({chatId:id,savedAt:new Date().toISOString()},null,2),
      'application/json'
    ).catch(err=>console.error('SHEF51 telegram chat save error',err?.message||err));
  }
  return id;
}

function bookingCors(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
}

app.options('/api/telegram/booking',(req,res)=>{
  bookingCors(req,res);
  res.sendStatus(204);
});

app.get('/api/telegram/status',async(req,res)=>{
  try{
    if(!telegramToken())return res.json({configured:false,connected:false,chatReady:false});
    const me=await telegramRequest('getMe',{});
    const chatId=await telegramChatId();
    res.json({configured:true,connected:true,chatReady:Boolean(chatId),botUsername:me?.username||null});
  }catch(err){
    res.status(502).json({configured:Boolean(telegramToken()),connected:false,chatReady:false,error:err.message});
  }
});

app.post('/api/telegram/booking',async(req,res)=>{
  bookingCors(req,res);
  const service=String(req.body?.service||'').trim().slice(0,120);
  const date=String(req.body?.date||'').trim().slice(0,40);
  const guests=String(req.body?.guests||'').trim().slice(0,20);
  const name=String(req.body?.name||'').trim().slice(0,120);
  const contact=String(req.body?.contact||'').trim().slice(0,120);
  const budget=String(req.body?.budget||'').trim().slice(0,120);
  const address=String(req.body?.address||'').trim().slice(0,220);
  const contactMethod=String(req.body?.contactMethod||'').trim().slice(0,80);
  const comment=String(req.body?.comment||'').trim().slice(0,1000);
  if(!service||!date||!guests||!name||!contact)return res.status(400).json({ok:false,error:'Заполните обязательные поля.'});

  const booking={
    id:'booking-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'),
    createdAt:new Date().toISOString(),
    service,date,guests,name,contact,budget,address,contactMethod,comment
  };

  let saved=false,telegramSent=false,lastError='';
  if(yandexToken()){
    try{
      await writeYandexFile(SHEF51_BOOKINGS_PATH+booking.id+'.json',JSON.stringify(booking,null,2),'application/json');
      saved=true;
    }catch(err){
      lastError=err?.message||'booking storage error';
      console.error('SHEF51 booking save error',lastError);
    }
  }

  try{
    const chatId=await telegramChatId();
    if(chatId){
      const text=[
        '🍣 Новая заявка SHEF51',
        '',
        'Услуга: '+service,
        'Дата: '+date,
        'Гостей: '+guests,
        'Имя: '+name,
        'Телефон: '+contact,
        'Бюджет: '+(budget||'—'),
        'Адрес / район: '+(address||'—'),
        'Связаться через: '+(contactMethod||'—'),
        'Пожелания: '+(comment||'—')
      ].join('\n');
      await telegramRequest('sendMessage',{chat_id:chatId,text});
      telegramSent=true;
    }else{
      lastError='Telegram chat is not ready';
    }
  }catch(err){
    lastError=err?.message||'Telegram delivery error';
    console.error('Telegram booking error',lastError);
  }

  if(saved||telegramSent){
    return res.json({ok:true,bookingId:booking.id,saved,telegramSent});
  }
  res.status(502).json({ok:false,error:'Не удалось сохранить заявку. Попробуйте ещё раз чуть позже.',detail:lastError});
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>{
  console.log(`FARRUKH AI Mobile V3.7: http://localhost:${port}`);
  setTimeout(async()=>{
    try{
      console.log('[telegram-check] tokenConfigured='+Boolean(telegramToken()));
      if(telegramToken()){
        const me=await telegramRequest('getMe',{});
        const chatId=await telegramChatId();
        console.log('[telegram-check] botConnected=true username='+(me?.username||'unknown')+' chatReady='+Boolean(chatId));
      }
    }catch(err){
      console.log('[telegram-check] botConnected=false error='+(err?.message||'unknown'));
    }
  },1500);
});

