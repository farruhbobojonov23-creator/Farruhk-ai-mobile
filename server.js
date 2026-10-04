import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

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

const defaultShef51Menu=()=>[
  {id:'philadelphia',category:'rolls',name:'Филадельфия',description:'Нежный лосось, обволакивающий ролл снаружи, сливочный сыр с мягким кремовым вкусом и свежий хрустящий огурец внутри — классическое сочетание, где каждый кусочек получается сочным и сбалансированным.',portion:'Порция — 8 шт.',visible:true,order:10,imageUrl:''},
  {id:'philadelphia-premium',category:'rolls',name:'Филадельфия Премиум',description:'Щедрый слой нежного лосося снаружи, внутри — ещё больше сочного лосося, мягкий сливочный сыр, свежий хрустящий огурец, рис и нори.',portion:'Порция — 8 шт.',visible:true,order:20,imageUrl:''},
  {id:'philadelphia-tiger',category:'rolls',name:'Филадельфия Тигровая',description:'Нежная тигровая креветка сверху, кремовый сливочный сыр и свежий хрустящий огурец внутри.',portion:'Порция — 8 шт.',visible:true,order:30,imageUrl:''},
  {id:'philadelphia-tiger-premium',category:'rolls',name:'Филадельфия Тигровая Премиум',description:'Тигровая креветка под пикантным сладко-острым соусом, сочный лосось внутри, нежный сливочный сыр и свежий хрустящий огурец.',portion:'Порция — 8 шт.',visible:true,order:40,imageUrl:''},
  {id:'sushi-salmon',category:'sushi',name:'Суши лосось',description:'рис, лосось',portion:'Порция — 8 шт.',visible:true,order:50,imageUrl:''},
  {id:'udon-cream',category:'wok',name:'Удон сливочный',description:'лапша удон, сливочный соус',portion:'Порция — 8 шт.',visible:true,order:60,imageUrl:''}
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
    return Array.isArray(stored?.items)?stored.items:defaultShef51Menu();
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

app.get('/shef51-admin',(req,res)=>res.redirect('/shef51-admin.html'));

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
app.post('/api/shef51/admin/logout',(req,res)=>{
  res.setHeader('Set-Cookie','shef51_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ok:true});
});
app.get('/api/shef51/admin/session',(req,res)=>{
  res.json({ok:Boolean(verifySession(cookieValue(req,'shef51_admin')))});
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
  const items=(await getShef51Menu()).filter(x=>x.visible!==false).sort((a,b)=>(a.order||0)-(b.order||0));
  res.json({ok:true,items});
});
app.get('/api/shef51/image/:id',async(req,res)=>{
  const id=String(req.params.id||'');
  if(!/^[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(id))return res.sendStatus(400);
  try{
    const d=await yandexDownloadLink(SHEF51_PHOTOS_PATH+id);
    res.setHeader('Cache-Control','public, max-age=300');
    res.redirect(302,d.href);
  }catch(err){res.sendStatus(404);}
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
  const updates=await telegramRequest('getUpdates',{limit:50,timeout:0});
  const chats=(Array.isArray(updates)?updates:[])
    .map(u=>u?.message?.chat||u?.edited_message?.chat||u?.callback_query?.message?.chat)
    .filter(c=>c&&c.type==='private'&&c.id);
  return chats.length?String(chats[chats.length-1].id):'';
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
  const comment=String(req.body?.comment||'').trim().slice(0,1000);
  if(!service||!date||!guests||!name||!contact)return res.status(400).json({ok:false,error:'Заполните обязательные поля.'});
  try{
    const chatId=await telegramChatId();
    if(!chatId)return res.status(503).json({ok:false,error:'Откройте бота в Telegram и отправьте /start.'});
    const text=[
      '🍣 Новая заявка SHEF51',
      '',
      'Услуга: '+service,
      'Дата: '+date,
      'Гостей: '+guests,
      'Имя: '+name,
      'Телефон / WhatsApp: '+contact,
      'Пожелания: '+(comment||'—')
    ].join('\n');
    await telegramRequest('sendMessage',{chat_id:chatId,text});
    res.json({ok:true});
  }catch(err){
    console.error('Telegram booking error',err);
    res.status(502).json({ok:false,error:'Не удалось отправить заявку в Telegram.'});
  }
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

