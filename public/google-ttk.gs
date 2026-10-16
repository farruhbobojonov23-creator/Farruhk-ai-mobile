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
function formatBody(body, packet) {
  const r = packet.recipe;
  body.clear().setMarginTop(30).setMarginBottom(30).setMarginLeft(36).setMarginRight(36);
  body.setAttributes({[DocumentApp.Attribute.FONT_FAMILY]:'Arial',[DocumentApp.Attribute.FONT_SIZE]:10,[DocumentApp.Attribute.FOREGROUND_COLOR]:'#000000'});
  const title=body.appendParagraph('ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА').setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);title.editAsText().setFontSize(13).setForegroundColor('#000000');
  const name=body.appendParagraph(String(r.name)).setAlignment(DocumentApp.HorizontalAlignment.CENTER);name.editAsText().setBold(true).setFontSize(15);
  addTable(body,[['Блюдо',String(r.name),'Дата',String(r.cardDate||'—')],['Категория',String(r.category||'—'),'ТТК №',String(r.cardNumber||'—')]],false);
  packet.sections.forEach(section=>{
    const heading=body.appendParagraph(section[0]).setHeading(DocumentApp.ParagraphHeading.HEADING2).setSpacingBefore(9).setSpacingAfter(5);heading.editAsText().setFontSize(11).setForegroundColor('#000000').setBackgroundColor('#FFF3C4');
    addTable(body,section[1],section[1][0].length>1);
  });
  body.appendParagraph('');
  addTable(body,[['Разработал',String(r.chef||'—'),'Утверждаю',String(r.approver||'—')]],false);
}
function addTable(body, rows, header) {
  const table=body.appendTable(rows.map(row=>row.map(cell=>String(cell))));
  table.setBorderColor('#D9D9D9').setBorderWidth(.5);
  const widths={1:[100],2:[24,76],3:[60,20,20],4:[15,45,15,25],5:[28,18,18,18,18]}[rows[0].length];if(widths)widths.forEach((width,column)=>table.setColumnWidth(column,width*5.23));
  for(let i=0;i<table.getNumRows();i++)for(let j=0;j<table.getRow(i).getNumCells();j++){
    const cell=table.getCell(i,j);cell.setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(6).setPaddingRight(6);
    cell.editAsText().setFontFamily('Arial').setFontSize(10).setForegroundColor('#000000');
    if(header&&i===0){cell.setBackgroundColor('#FFF3C4');cell.editAsText().setBold(true)}
  }
  body.appendParagraph('').setSpacingAfter(3);
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
    if(previous.digest!==packet.digest){
      const document=DocumentApp.openById(WORKING_DOCUMENT_ID),body=document.getTab(tabId).asDocumentTab().getBody();
      formatBody(body,packet);document.saveAndClose();
      docsApi(':batchUpdate',{requests:[{updateDocumentTabProperties:{tabProperties:{tabId,title,parentTabId:parentId},fields:'title,parentTabId'}}]});
      properties.setProperty(recordKey,JSON.stringify({tabId,digest:packet.digest}));
    }
    return jsonResponse({ok:true,recipeId:r.id,digest:packet.digest,tabId,documentUrl:'https://docs.google.com/document/d/'+WORKING_DOCUMENT_ID+'/edit?tab='+tabId});
  } catch(error) { return jsonResponse({ok:false,error:String(error.message||error)}) }
  finally { if(lock&&lock.hasLock())lock.releaseLock() }
}
