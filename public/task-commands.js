export function zonedDate(date,timeZone='Europe/Moscow'){
  const values=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p=Object.fromEntries(values.filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
  return new Date(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
}
export function zonedToUtc(wall,timeZone='Europe/Moscow'){
  const desired=Date.UTC(wall.getFullYear(),wall.getMonth(),wall.getDate(),wall.getHours(),wall.getMinutes(),wall.getSeconds());
  let guess=desired;
  for(let i=0;i<4;i++){const actual=zonedDate(new Date(guess),timeZone);const scalar=Date.UTC(actual.getFullYear(),actual.getMonth(),actual.getDate(),actual.getHours(),actual.getMinutes(),actual.getSeconds());const diff=desired-scalar;if(diff===0)return new Date(guess);guess+=diff}
  throw Error('Это время недоступно из-за перевода часов. Выберите другое.');
}
export function parseTaskCommand(raw,now=new Date(),timeZone='Europe/Moscow'){
  let text=String(raw||'').trim();
  if(!/^(?:добавь|добавить|создай|создать|напомни|запиши|поставь|сделай)(?:\s|$)/iu.test(text))return null;
  if(/(?:техкарт|ттк|рецепт|документ|заметк|памят)/iu.test(text))return null;
  text=text.replace(/^(?:добавь|добавить|создай|создать|напомни|запиши|поставь|сделай)\s*/iu,'').replace(/^задач[уа]\s*/iu,'').replace(/^мне\s+/iu,'');
  const word=w=>new RegExp('(^|[^\\p{L}\\p{N}_])(?:'+w+')(?=$|[^\\p{L}\\p{N}_])','iu');
  const take=w=>{const re=word(w),found=re.test(text);if(found)text=text.replace(re,' ');return found};
  const target=zonedDate(now,timeZone),tomorrow=take('завтра'),today=take('сегодня');
  let dated=tomorrow||today;
  if(tomorrow)target.setDate(target.getDate()+1);
  if(!dated){for(const [name,day] of Object.entries({'понедельник':1,'вторник':2,'среду|среда':3,'четверг':4,'пятницу|пятница':5,'субботу|суббота':6,'воскресенье':0})){if(take(name)){target.setDate(target.getDate()+((day-target.getDay()+7)%7||7));dated=true;break}}}
  let hour=null,minute=0;
  const time=text.match(/(?:^|\s)(?:в|к)\s*(\d{1,2})(?::(\d{2}))?(?=$|[^\d])/iu);
  if(time){hour=+time[1];minute=+(time[2]||0);if(hour>23||minute>59)throw new Error('Укажите время от 00:00 до 23:59.');text=text.replace(time[0],' ')}
  else for(const [name,h] of [['утром',9],['дн[её]м',14],['вечером',19]])if(take(name)){hour=h;break}
  let due=null;
  if(dated||hour!==null){target.setHours(hour??9,minute,0,0);if(!dated&&zonedToUtc(target,timeZone)<=now)target.setDate(target.getDate()+1);due=zonedToUtc(target,timeZone).toISOString()}
  const priority=take('важно|важная|срочно|приоритет')?'high':'normal';
  text=text.replace(/^(?:на|в)\s+/iu,'').replace(/\s+/g,' ').replace(/^[,.:;\-–—\s]+|[,.:;\-–—\s]+$/g,'').trim();
  if(!text)return null;
  return {id:globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random(),text,due,priority,done:false,createdAt:now.toISOString(),notifiedAt:null};
}
