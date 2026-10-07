export function taskCalendar(tasks,now=new Date()){
  const escape=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const date=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FARRUKH AI//Tasks//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const task of tasks){
    if(task.done||!task.due||!Number.isFinite(Date.parse(task.due)))continue;
    lines.push('BEGIN:VEVENT','UID:'+escape(task.id)+'@farrukh-ai','DTSTAMP:'+date(now),'DTSTART:'+date(task.due),'DTEND:'+date(Date.parse(task.due)+15*60000),'SUMMARY:'+escape(task.text),'DESCRIPTION:Задача FARRUKH AI. Изменения в приложении не синхронизируются с календарём автоматически.','BEGIN:VALARM','TRIGGER:PT0S','ACTION:DISPLAY','DESCRIPTION:'+escape(task.text),'END:VALARM','END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(line=>{let result='',width=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(width+size>75){result+='\r\n ';width=1}result+=char;width+=size}return result}).join('\r\n')+'\r\n';
}
