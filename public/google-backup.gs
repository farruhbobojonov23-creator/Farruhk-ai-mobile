/**
 * FARRUH AI — private backups on a free Google Drive.
 * Standalone Google Apps Script project. Published as a Web App ("Execute as me").
 * No keys in source. The one-time initializeBackup() creates a secret in Script Properties.
 * Existing Yandex Disk files and Google TTK documents are never changed.
 */
const BACKUP_FOLDER_NAME='FARRUH AI — резервные копии';
const BACKUP_PREFIX='FARRUH_AI_backup_';
const MAX_BYTES=7500000;

function initializeBackup(){
 const props=PropertiesService.getScriptProperties();
 let key=props.getProperty('BACKUP_CONNECTION_KEY');
 if(!key){key=Utilities.getUuid()+Utilities.getUuid();props.setProperty('BACKUP_CONNECTION_KEY',key)}
 const folder=backupFolder();
 console.log('Google подключение готово. Папка: '+folder.getName());
 console.log('КЛЮЧ ПОДКЛЮЧЕНИЯ (не делитесь им): '+key);
 console.log('Откройте папку: '+folder.getUrl());
}
function backupFolder(){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty('BACKUP_FOLDER_ID');
 if(id){try{return DriveApp.getFolderById(id)}catch(e){throw Error('Папка резервных копий недоступна. Проверьте доступ Google. Не создавайте новую, пока не проверите предыдущую.')}}
 const folders=DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
 const folder=folders.hasNext()?folders.next():DriveApp.createFolder(BACKUP_FOLDER_NAME);
 props.setProperty('BACKUP_FOLDER_ID',folder.getId());
 return folder;
}
function json(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
function isMember(file,folder){
 const parents=file.getParents();
 while(parents.hasNext())if(parents.next().getId()===folder.getId())return true;
 return false;
}
function doPost(e){
 let lock;
 try{
  const packet=JSON.parse(e&&e.postData&&e.postData.contents||'{}');
  const key=PropertiesService.getScriptProperties().getProperty('BACKUP_CONNECTION_KEY');
  if(!key||typeof packet.key!=='string'||packet.key!==key)return json({ok:false,error:'Неверный ключ подключения Google.'});
  const action=String(packet.action||'');
  const folder=backupFolder();
  if(action==='check')return json({ok:true,folderName:folder.getName()});
  if(action==='list'){
   const iter=folder.getFiles(),items=[];
   while(iter.hasNext()){
    const file=iter.next();
    if(!file.getName().startsWith(BACKUP_PREFIX)||!file.getName().endsWith('.json'))continue;
    items.push({id:file.getId(),name:file.getName(),createdAt:file.getDateCreated().toISOString(),size:file.getSize()});
   }
   items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   return json({ok:true,items:items.slice(0,100)});
  }
  if(action==='fetch'){
   if(typeof packet.backupId!=='string'||!/^[A-Za-z0-9_-]{15,130}$/.test(packet.backupId))throw Error('Некорректная копия.');
   const file=DriveApp.getFileById(packet.backupId);
   if(!isMember(file,folder)||!file.getName().startsWith(BACKUP_PREFIX)||!file.getName().endsWith('.json'))throw Error('Эта копия недоступна.');
   if(file.getSize()>MAX_BYTES)throw Error('Копия слишком большая.');
   const snapshot=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
   if(snapshot.version!==1||!snapshot.state||typeof snapshot.state!=='object')throw Error('Неверный формат резервной копии.');
   return json({ok:true,snapshot});
  }
  if(action!=='backup')throw Error('Неизвестная операция.');
  if(!packet.snapshot||packet.snapshot.version!==1||!packet.snapshot.state||typeof packet.snapshot.state!=='object')
   throw Error('Неверный формат данных.');
  const data=JSON.stringify(packet.snapshot);
  if(data.length>MAX_BYTES)throw Error('Копия превышает допустимый размер.');
  if(packet.snapshot.state.googleBackup||packet.snapshot.state.googleSync||packet.snapshot.state.googleDelivery)
   throw Error('Резервная копия содержит ключи подключения.');
  lock=LockService.getScriptLock();lock.waitLock(20000);
  const now=new Date();
  const name=BACKUP_PREFIX+now.toISOString().replace(/[:.]/g,'-')+'_'+Utilities.getUuid().slice(0,8)+'.json';
  const file=folder.createFile(name,data,'application/json');
  if(file.getSize()<10)throw Error('Google не подтвердил содержимое файла.');
  return json({ok:true,id:file.getId(),name,createdAt:now.toISOString()});
 }catch(err){return json({ok:false,error:String(err.message||'Ошибка Google Диска').slice(0,220)})}
 finally{if(lock&&lock.hasLock())lock.releaseLock()}
}
