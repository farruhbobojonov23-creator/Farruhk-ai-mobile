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
  addTable(body,[['Блюдо',String(r.name),'Дата',String(r.cardDate||'—')],['Категория',String(r.category||'—'),'ТТК №',String(r.cardNumber||'—')]],false);
  packet.sections.forEach(section=>{
    const heading=body.appendParagraph(section[0]).setHeading(DocumentApp.ParagraphHeading.HEADING2).setSpacingBefore(9).setSpacingAfter(5);heading.editAsText().setFontSize(11).setForegroundColor('#000000').setBackgroundColor('#FFF3C4');
    addTable(body,section[1],section[1][0].length>1);
  });
  body.appendParagraph('');
  addTable(body,[['Разработал',String(r.chef||'—'),'Утверждаю',String(r.approver||'—')]],false);
  compactCardBody(body);
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
      normalizeCardTextHighlights(tabId);
      properties.setProperty(recordKey,JSON.stringify({tabId,digest:packet.digest}));
    }
    return jsonResponse({ok:true,recipeId:r.id,digest:packet.digest,tabId,documentUrl:'https://docs.google.com/document/d/'+WORKING_DOCUMENT_ID+'/edit?tab='+tabId});
  } catch(error) { return jsonResponse({ok:false,error:String(error.message||error)}) }
  finally { if(lock&&lock.hasLock())lock.releaseLock() }
}

/** Compact A4 layout shared by new cards and already saved cards. */
function layoutColumnShares(columns) {
  return ({1:[1],2:[.25,.75],3:[.60,.20,.20],4:[.15,.45,.15,.25],5:[.28,.18,.18,.18,.18]})[columns] || Array(columns).fill(1/columns);
}
function estimateCardHeight(body, fontSize) {
  const width=532.88;
  let height=12;
  for(let i=0;i<body.getNumChildren();i++){
    const child=body.getChild(i);
    if(child.getType()===DocumentApp.ElementType.PARAGRAPH){
      const text=child.asParagraph().getText().trim();
      if(!text){height+=1.3;continue}
      const heading=/^\d+\./.test(text);
      height+=Math.max(1,Math.ceil(text.length/(width/(fontSize*.52))))*fontSize*1.18+(heading?7:4);
    }else if(child.getType()===DocumentApp.ElementType.TABLE){
      const table=child.asTable(),shares=layoutColumnShares(table.getRow(0).getNumCells());
      for(let row=0;row<table.getNumRows();row++){
        let lines=1;
        for(let col=0;col<table.getRow(row).getNumCells();col++){
          const text=table.getCell(row,col).getText();
          const capacity=Math.max(6,Math.floor((width*shares[col]-8)/(fontSize*.55)));
          const count=text.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/capacity)),0);
          lines=Math.max(lines,count);
        }
        height+=lines*fontSize*1.22+4.5;
      }
    }
  }
  return height;
}
function compactCardBody(body) {
  body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(28.35).setMarginBottom(28.35).setMarginLeft(31.2).setMarginRight(31.2);
  for(let i=1;i<body.getNumChildren()-1;i++){
    const p=body.getChild(i),next=body.getChild(i+1);
    if(p.getType()===DocumentApp.ElementType.PARAGRAPH&&next.getType()===DocumentApp.ElementType.TABLE){
      const table=next.asTable();
      if(table.getRow(0).getNumCells()===4&&table.getCell(0,0).getText()==='Блюдо'&&p.asParagraph().getText().trim()===table.getCell(0,1).getText().trim()){p.removeFromParent();break}
    }
  }
  let font=9;
  for(const candidate of [9,8.5,8,7.5,7]){
    font=candidate;if(estimateCardHeight(body,candidate)<=745)break;
  }
  const gold='#A28D46', pale='#F4E5AB', white='#FFFFFF';
  for(let i=0;i<body.getNumChildren();i++){
    const child=body.getChild(i);
    if(child.getType()===DocumentApp.ElementType.PARAGRAPH){
      const p=child.asParagraph(),text=p.getText().trim();
      p.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
      if(!text){p.editAsText().setFontSize(1);continue}
      p.editAsText().setFontFamily('Arial').setFontSize(font).setForegroundColor('#111111').setBackgroundColor(null);
      if(text.indexOf('ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА')===0){
        p.setText('ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА (Суши Бери)');
        p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(5);
        p.editAsText().setFontFamily('Arial').setFontSize(font+1).setBold(true).setForegroundColor('#65552D');
      }else if(/^\d+\./.test(text)){
        p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(5).setSpacingAfter(3);
        p.editAsText().setBold(true).setForegroundColor(white).setBackgroundColor(gold);
      }else{
        p.setSpacingAfter(3);
      }
    }else if(child.getType()===DocumentApp.ElementType.TABLE){
      const table=child.asTable(),columns=table.getRow(0).getNumCells(),shares=layoutColumnShares(columns);
      table.setBorderColor(gold).setBorderWidth(.5);
      shares.forEach((share,col)=>table.setColumnWidth(col,532.88*share));
      for(let row=0;row<table.getNumRows();row++)for(let col=0;col<table.getRow(row).getNumCells();col++){
        const cell=table.getCell(row,col);
        const text=cell.getText(),first=table.getCell(0,0).getText();
        const header=row===0&&columns>1&&!/^(Блюдо|Разработал)/.test(first);
        const label=/^(Блюдо|Разработал)/.test(first)&&col%2===0;
        cell.setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(4).setPaddingRight(4).setBackgroundColor(header||label?pale:white);
        cell.editAsText().setFontFamily('Arial').setFontSize(font).setForegroundColor('#111111').setBackgroundColor(header||label?pale:white).setBold(header||/^ВЫХОД|^Выход/.test(text));
        for(let n=0;n<cell.getNumChildren();n++){
          const e=cell.getChild(n);if(e.getType()!==DocumentApp.ElementType.PARAGRAPH)continue;
          const p=e.asParagraph();p.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
          p.setAlignment(columns>=3||header?DocumentApp.HorizontalAlignment.CENTER:DocumentApp.HorizontalAlignment.LEFT);
        }
      }
    }
  }
  return font;
}
function reformatExistingTtk() {
  const document=DocumentApp.openById(WORKING_DOCUMENT_ID);
  const tabs=flattenTabs(docsApi('?includeTabsContent=true').tabs);
  let count=0;
  tabs.filter(tab=>tab.tabProperties.parentTabId).forEach(tab=>{
    compactCardBody(document.getTab(tab.tabProperties.tabId).asDocumentTab().getBody());count++;
  });
  document.saveAndClose();
  tabs.filter(tab=>tab.tabProperties.parentTabId).forEach(tab=>normalizeCardTextHighlights(tab.tabProperties.tabId));
  console.log('Обновлено ТТК: '+count);
}

function normalizeCardTextHighlights(tabId) {
  const tab=flattenTabs(docsApi('?includeTabsContent=true').tabs).find(t=>t.tabProperties.tabId===tabId);
  if(!tab||!tab.documentTab||!tab.documentTab.body)return;
  const content=tab.documentTab.body.content,end=content[content.length-1].endIndex-1;
  const requests=[{updateTextStyle:{range:{tabId,startIndex:1,endIndex:end},textStyle:{},fields:'backgroundColor'}}];
  content.forEach(element=>{
    const text=element.paragraph&&(element.paragraph.elements||[]).map(e=>e.textRun?e.textRun.content:'').join('');
    if(text&&/^\d+\./.test(text))requests.push({updateTextStyle:{range:{tabId,startIndex:element.startIndex,endIndex:element.endIndex-1},textStyle:{backgroundColor:{color:{rgbColor:{red:162/255,green:141/255,blue:70/255}}},foregroundColor:{color:{rgbColor:{red:1,green:1,blue:1}}}},fields:'backgroundColor,foregroundColor'}});
  });
  docsApi(':batchUpdate',{requests});
}
