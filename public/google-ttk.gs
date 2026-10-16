/** Farukh AI ready TTK receiver. No account keys are stored in this file. */
const WORKING_DOCUMENT_ID = '1sspXqpkmYnZ9M2V3XX2JVXw7bUk8LL1VNkoRM3gMlnY';
function initialize() {
  const properties = PropertiesService.getScriptProperties();
  let key = properties.getProperty('CONNECTION_KEY');
  if (!key) { key = Utilities.getUuid() + Utilities.getUuid(); properties.setProperty('CONNECTION_KEY', key); }
  DocumentApp.openById(WORKING_DOCUMENT_ID).saveAndClose();
  docsApi('?includeTabsContent=true');
  console.log('Ключ подключения: ' + key);
  console.log('Рабочий документ: https://docs.google.com/document/d/' + WORKING_DOCUMENT_ID + '/edit');
}
function jsonResponse(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function docsApi(suffix, payload) {
  return payload ? Docs.Documents.batchUpdate(payload,WORKING_DOCUMENT_ID) : Docs.Documents.get(WORKING_DOCUMENT_ID,{includeTabsContent:true});
}
function flattenTabs(tabs) { return (tabs || []).reduce((all,tab)=>all.concat([tab], flattenTabs(tab.childTabs)), []); }
function addTab(title, parentTabId) {
  const result = docsApi(':batchUpdate', {requests:[{addDocumentTab:{tabProperties:{title, ...(parentTabId ? {parentTabId} : {})}}}]});
  return result.replies[0].addDocumentTab.tabProperties.tabId;
}
const TTK_LAYOUT_VERSION = 'burgundy-1';
function formatBody(body, packet) {
 const r=packet.recipe,sections=packet.sections.map(s=>[s[0],s[1]]);
 if(sections.length===6)sections.unshift(['1. Область применения',[[String(r.scope||('Блюдо «'+r.name+'». Предприятия изготовления и реализации: [уточнить].'))]]]);
 sections.forEach((s,i)=>s[0]=s[0].replace(/^\d+\./,String(i+1)+'.'));
 body.clear().setPageWidth(595.28).setPageHeight(841.89).setMarginTop(22).setMarginBottom(22).setMarginLeft(25).setMarginRight(25);
 const title=body.appendParagraph('СУШИ БЕРИ • ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА');title.editAsText().setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor('#651D2C');
 if(body.getChild(0).getType()===DocumentApp.ElementType.PARAGRAPH&&!body.getChild(0).asParagraph().getText())body.getChild(0).removeFromParent();
 const name=body.appendParagraph(String(r.name));name.editAsText().setFontFamily('Arial').setFontSize(17).setBold(true).setForegroundColor('#651D2C');
 addTable(body,[['Категория',String(r.category||'—'),'ТТК №',String(r.cardNumber||'—')],['Дата',String(r.cardDate||'—'),'Выход',String(r.netYieldGrams||'—')+' г']],false,545);
 const top=body.appendTable([['','']]);top.setBorderColor('#D9B7A3').setBorderWidth(.4);top.setColumnWidth(0,272.5).setColumnWidth(1,272.5);
 addSection(top.getCell(0,0),sections[0],265);addSection(top.getCell(0,1),sections[1],265);
 body.appendParagraph('');addSection(body,sections[2],545);
 const lower=body.appendTable([['','']]);lower.setBorderColor('#D9B7A3').setBorderWidth(.4);lower.setColumnWidth(0,218).setColumnWidth(1,327);
 addSection(lower.getCell(0,0),sections[3],210);addSection(lower.getCell(0,1),sections[4],319);addSection(lower.getCell(0,1),sections[5],319);
 body.appendParagraph('');addSection(body,sections[6],545);
 addTable(body,[['Разработал',String(r.chef||'—'),'Утверждаю',String(r.approver||'—')]],false,545);
 compactCardBody(body);
}
function addSection(parent,section,width){
 const band=parent.appendTable([[String(section[0])]]);band.setColumnWidth(0,width);band.setBorderWidth(0);band.getCell(0,0).setBackgroundColor('#651D2C');band.getCell(0,0).editAsText().setForegroundColor('#FFF8F1').setBold(true);
 addTable(parent,section[1],section[1][0].length>1,width);parent.appendParagraph('');
}
function addTable(parent,rows,header,width){
 const table=parent.appendTable(rows.map(row=>row.map(String)));table.setBorderColor('#D9B7A3').setBorderWidth(.4);
 const shares=layoutColumnShares(rows[0].length);shares.forEach((share,col)=>table.setColumnWidth(col,(width||545)*share));
 for(let i=0;i<table.getNumRows();i++)for(let j=0;j<table.getRow(i).getNumCells();j++){
  const cell=table.getCell(i,j);cell.setBackgroundColor(header&&i===0?'#F5DCC9':'#FFF1E5');cell.editAsText().setBold(header&&i===0).setForegroundColor('#4A1723');
 }
 return table;
}
function doPost(event) {
  let lock;
  try {
    const packet=JSON.parse(event.postData.contents), properties=PropertiesService.getScriptProperties();
    const key=properties.getProperty('CONNECTION_KEY');
    if(!key||packet.key!==key)return jsonResponse({ok:false,error:'Неверный ключ подключения Google.'});
    if(packet.action==='check'){DocumentApp.openById(WORKING_DOCUMENT_ID).saveAndClose();return jsonResponse({ok:true,documentUrl:'https://docs.google.com/document/d/'+WORKING_DOCUMENT_ID+'/edit'})}
    const r=packet.recipe;
    if(packet.action!=='sync'||!r||r.status!=='ready'||!r.id||!Array.isArray(packet.sections))throw Error('Разрешены только готовые ТТК.');
    if(!/^[a-f0-9]{64}$/.test(packet.digest||''))throw Error('Неверная версия ТТК.');
    lock=LockService.getScriptLock();lock.waitLock(25000);
    const recordKey='recipe_'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(r.id)).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
    const previous=JSON.parse(properties.getProperty(recordKey)||'{}');
    let tabs=flattenTabs(docsApi('?includeTabsContent=true').tabs);
    let category=tabs.find(tab=>!tab.tabProperties.parentTabId&&tab.tabProperties.title===r.category);
    const parentId=category?category.tabProperties.tabId:addTab(String(r.category||'Без категории'));
    // Persist a newly created tab ID BEFORE populating it. A retry repairs the same tab.
    const marker='AI-'+recordKey.slice(7,19),title=(String(r.name)+' №'+String(r.cardNumber||'')).slice(0,95);
    let tabId=previous.tabId;
    if(!tabId||!tabs.some(tab=>tab.tabProperties.tabId===tabId)){
      const interrupted=tabs.find(tab=>tab.tabProperties.title===marker);
      tabId=interrupted?interrupted.tabProperties.tabId:addTab(marker,parentId);
      properties.setProperty(recordKey,JSON.stringify({tabId}));
    }
    if(previous.digest!==packet.digest||previous.layoutVersion!==TTK_LAYOUT_VERSION){
      const document=DocumentApp.openById(WORKING_DOCUMENT_ID),body=document.getTab(tabId).asDocumentTab().getBody();
      formatBody(body,packet);document.saveAndClose();
      docsApi(':batchUpdate',{requests:[{updateDocumentTabProperties:{tabProperties:{tabId,title,parentTabId:parentId},fields:'title,parentTabId'}}]});
      normalizeCardTextHighlights(tabId);
      properties.setProperty(recordKey,JSON.stringify({tabId,digest:packet.digest,layoutVersion:TTK_LAYOUT_VERSION}));
    }
    return jsonResponse({ok:true,recipeId:r.id,digest:packet.digest,tabId,documentUrl:'https://docs.google.com/document/d/'+WORKING_DOCUMENT_ID+'/edit?tab='+tabId});
  } catch(error) { return jsonResponse({ok:false,error:String(error.message||error)}) }
  finally { if(lock&&lock.hasLock())lock.releaseLock() }
}

/** Shared formatting for new and existing cards; identifiers and recipe content survive. */
function layoutColumnShares(columns){return ({1:[1],2:[.28,.72],3:[.60,.20,.20],4:[.15,.40,.15,.30],5:[.30,.175,.175,.175,.175]})[columns]||Array(columns).fill(1/columns)}
function compactCardBody(body){
 const name=body.getChild(1).asParagraph().getText();
 function style(parent,bg){for(let i=0;i<parent.getNumChildren();i++){const e=parent.getChild(i);if(e.getType()===DocumentApp.ElementType.PARAGRAPH){const p=e.asParagraph(),t=p.getText();p.setHeading(DocumentApp.ParagraphHeading.NORMAL).setSpacingBefore(0).setSpacingAfter(t?2:0).setLineSpacing(1);p.editAsText().setFontFamily('Arial').setBackgroundColor(bg||'#FFF1E5').setForegroundColor(bg&&bg.toUpperCase()==='#651D2C'?'#FFF8F1':'#4A1723').setBold((bg&&['#651D2C','#F5DCC9'].includes(bg.toUpperCase()))||t===name||t.indexOf('СУШИ БЕРИ')===0);if(!t)p.editAsText().setFontSize(1);else p.editAsText().setFontSize(t===name?17:t.indexOf('СУШИ БЕРИ')===0?10:8);}else if(e.getType()===DocumentApp.ElementType.TABLE){const table=e.asTable();for(let r=0;r<table.getNumRows();r++)for(let c=0;c<table.getRow(r).getNumCells();c++){const cell=table.getCell(r,c);cell.setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(3).setPaddingRight(3);style(cell,cell.getBackgroundColor()||bg||'#FFF1E5');}}}}
 style(body,'#FFF1E5');return 8;
}
function reformatExistingTtk(){
 const document=DocumentApp.openById(WORKING_DOCUMENT_ID),tabs=flattenTabs(docsApi('?includeTabsContent=true').tabs);let count=0;
 tabs.filter(t=>t.tabProperties.parentTabId).forEach(tab=>{
  const body=document.getTab(tab.tabProperties.tabId).asDocumentTab().getBody(),sections=[];let current;
  const r={name:tab.tabProperties.title,category:'',cardNumber:'',cardDate:'',chef:'',approver:''};
  for(let i=0;i<body.getNumChildren();i++){
   const e=body.getChild(i);
   if(e.getType()===DocumentApp.ElementType.PARAGRAPH){const text=e.asParagraph().getText();if(/^\d+\./.test(text)){current=[text,[]];sections.push(current)}}
   else if(e.getType()===DocumentApp.ElementType.TABLE){const table=e.asTable(),rows=[];for(let n=0;n<table.getNumRows();n++){const row=[];for(let c=0;c<table.getRow(n).getNumCells();c++)row.push(table.getCell(n,c).getText());rows.push(row)}
    if(rows[0][0]==='Блюдо'){r.name=rows[0][1];r.cardDate=rows[0][3];r.category=rows[1][1];r.cardNumber=rows[1][3]}
    else if(/^Разработал/.test(rows[0][0])){r.chef=rows[0][1];r.approver=rows[0][3]}
    else if(current)current[1]=rows;
   }
  }
  // Only migrate the legacy flat layout. Already redesigned cards are left intact.
  if(sections.length===6)sections.unshift(['1. Область применения',[[String(r.name)+'. Предприятия изготовления и реализации: [уточнить].']]]);
  if(sections.length!==7||sections.some(s=>!s[1].length))return;
  sections.forEach((s,i)=>s[0]=s[0].replace(/^\d+\./,String(i+1)+'.'));
  sections[5][0]='6. Показатели качества и безопасности';
  formatBody(body,{recipe:r,sections});count++;
 });document.saveAndClose();console.log('Обновлено ТТК: '+count);
}
function normalizeCardTextHighlights(tabId) {
 // Colors are applied at the cell and paragraph level by formatBody.
}
