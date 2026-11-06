export function createLibrary(sb,user,status){
 const $=id=>document.getElementById(id);
 const isAdmin=Boolean(user);
 let assetList=[];
 async function sha256(file){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
 async function verifiedRemote(asset){const {data,error}=await sb.storage.from('fk-paid-ttk').download(asset.object_path);if(error||!data)throw new Error('Файл в хранилище недоступен');const hash=await sha256(data);if(hash!==asset.expected_sha256||data.size!==Number(asset.expected_size_bytes))throw new Error('Файл в хранилище не совпадает с контрольной суммой.');return true}
 async function loadFiles(){
  const {data,error}=await sb.from('fk_paid_assets').select('*').order('asset_key');
  if(error)throw error;assetList=data||[];
  const root=$('assetRows');root.replaceChildren();
  for(const asset of assetList){
   const tr=document.createElement('tr');
   const name=document.createElement('td');name.textContent=asset.filename;
   const size=document.createElement('td');size.textContent=(Number(asset.expected_size_bytes)/1048576).toFixed(2)+' МБ';
   const cloud=document.createElement('td');cloud.textContent='Проверка…';
   const rel=document.createElement('td');rel.textContent=asset.released?'Открыто по доступу':'Закрыто';
   const action=document.createElement('td');
   const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept=asset.asset_key.endsWith('_pdf')?'.pdf,application/pdf':'.zip,application/zip';fileInput.style.maxWidth='210px';fileInput.style.fontSize='12px';
   const upload=document.createElement('button');upload.type='button';upload.textContent='Загрузить';upload.disabled=false;
   const release=document.createElement('button');release.type='button';release.className='subtle';release.textContent='Проверить и разрешить';release.style.marginTop='6px';release.disabled=true;
   const folder=asset.object_path.substring(0,asset.object_path.lastIndexOf('/'));
   async function check(){
    const {data:list,error:listErr}=await sb.storage.from('fk-paid-ttk').list(folder,{limit:100,search:asset.object_path.split('/').pop()});
    const present=!listErr&&Array.isArray(list)&&list.some(f=>f.name===asset.object_path.split('/').pop());
    cloud.textContent=present?'Загружено':'Нет файла';release.disabled=!present||asset.released;
   }
   upload.addEventListener('click',async()=>{
    if(!fileInput.files||!fileInput.files.length){status('Выберите файл для '+asset.filename,true);return}
    const f=fileInput.files[0];upload.disabled=true;
    try{
     status('Проверяю размер и SHA-256 файла '+asset.filename+'…');
     const got=await sha256(f);if(got!==asset.expected_sha256||f.size!==Number(asset.expected_size_bytes))throw new Error('Выбран другой файл: размер или SHA-256 не совпадает с утверждённой версией');
     status('Загружаю '+asset.filename+' в закрытое хранилище…');
     const {error:e}=await sb.storage.from('fk-paid-ttk').upload(asset.object_path,f,{upsert:true,contentType:asset.asset_key.endsWith('_pdf')?'application/pdf':'application/zip',cacheControl:'0'});
     if(e)throw e;
     status('Файл загружен. Можно проверить и разрешить его выдачу.');
     await check();
    }catch(e){status(e.message||'Ошибка загрузки.',true)}finally{upload.disabled=false}
   });
   release.addEventListener('click',async()=>{
    release.disabled=true;
    try{
     status('Проверяю фактическое содержимое в защищённом хранилище…');await verifiedRemote(asset);
     const {error:e}=await sb.from('fk_paid_assets').update({released:true,approved_by:user.id,released_at:new Date().toISOString()}).eq('asset_key',asset.asset_key);
     if(e)throw e;
     status('Выдача '+asset.filename+' разрешена только покупателям с активным доступом.');await loadFiles();
    }catch(e){status(e.message||'Ошибка выпуска файла.',true);release.disabled=false}
   });
   action.append(fileInput,document.createElement('br'),upload,document.createElement('br'),release);
   tr.append(name,size,cloud,rel,action);root.append(tr);
   await check();
  }
 }

 let releaseEditionAssets=[];
 async function loadReleaseEdition(){
  if(!isAdmin)return;
  const {data,error}=await sb.from('fk_release_assets').select('*').eq('edition','2026-11-03').order('asset_key');
  if(error)throw error;
  releaseEditionAssets=data||[];
  // The corrected PF PDF is stored in the 05.11 folder while the other
  // assets stay in the 03.11 folders. List real object paths, not two hard-coded folders.
  const folders=[...new Set(releaseEditionAssets.map(a=>a.object_path.slice(0,a.object_path.lastIndexOf('/'))))];
  const listings=await Promise.all(folders.map(folder=>sb.storage.from('fk-paid-ttk').list(folder,{limit:100})));
  const listingError=listings.find(x=>x.error)?.error;
  if(listingError)throw listingError;
  const present=new Set();
  folders.forEach((folder,i)=>(listings[i].data||[]).forEach(file=>present.add(folder+'/'+file.name)));
  const complete=releaseEditionAssets.filter(a=>present.has(a.object_path)).length;
  const approved=releaseEditionAssets.filter(a=>a.released).length;
  $('releaseStats').textContent='Текущая редакция: '+releaseEditionAssets.length+' файла(ов) · найдено в хранилище: '+complete+' · доступно по оплаченным тарифам: '+approved+'.';
  const root=$('releaseRows');root.replaceChildren();
  for(const asset of releaseEditionAssets){
   const line=document.createElement('div');line.className='file';
   const n=document.createElement('span');n.textContent=asset.filename+' · '+(present.has(asset.object_path)?'загружено':'ожидает загрузки')+(asset.released?' · доступно по тарифу':' · закрыто');
   line.append(n);
   if(present.has(asset.object_path)&&!asset.released){
    const b=document.createElement('button');b.type='button';b.className='subtle';b.textContent='Проверить и разрешить';b.style.maxWidth='190px';
    b.addEventListener('click',async()=>{
     if(!isAdmin)return;
     b.disabled=true;
     try{
      status('Проверка содержимого '+asset.filename+'…');
      const {data:f,error:err}=await sb.storage.from('fk-paid-ttk').download(asset.object_path);
      if(err||!f)throw new Error('Файл недоступен');
      if(f.size!==Number(asset.expected_size_bytes)||(await sha256(f))!==asset.expected_sha256)throw new Error('SHA-256 или размер не соответствует базе');
      const {error:uerr}=await sb.from('fk_release_assets').update({released:true,released_at:new Date().toISOString(),approved_by:user.id}).eq('asset_key',asset.asset_key).eq('released',false);
      if(uerr)throw uerr;
      status(asset.filename+' проверен и доступен только по подтверждённому тарифу.');
      await loadReleaseEdition();
     }catch(e){status('Не удалось разрешить: '+(e.message||'ошибка'),true);b.disabled=false}
    });line.append(b);
   }
   root.append(line);
  }
 }


 async function fkGetVerifiedAsset(asset){
  const {data,error}=await sb.storage.from('fk-paid-ttk').download(asset.object_path);
  if(error||!data)throw new Error('Скачивание не прошло: '+(error?.message||asset.filename));
  if(data.size!==Number(asset.expected_size_bytes))throw new Error('Неверный размер '+asset.filename);
  const sum=await sha256(data);
  if(sum!==asset.expected_sha256.trim())throw new Error('Неверный SHA-256 '+asset.filename);
  const buf=new Uint8Array(await data.slice(0,12).arrayBuffer());
  if(asset.asset_kind==='pdf'&&!(buf[0]===37&&buf[1]===80&&buf[2]===68&&buf[3]===70))throw new Error('Это не PDF: '+asset.filename);
  if(asset.asset_kind==='image'&&!(buf[0]===82&&buf[1]===73&&buf[2]===70&&buf[3]===70&&buf[8]===87&&buf[9]===69&&buf[10]===66&&buf[11]===80))throw new Error('Это не WebP: '+asset.filename);
  return data;
 }
 async function fkRunDiagnostics(all){
  if(!isAdmin){status('Только владелец может проводить проверку.',true);return}
  const ids=['fkTestPdf','fkTestAll','fkOpenStart','fkOpenPro'];
  for(const id of ids)$(id).disabled=true;
  const target=$('fkTestResult');
  try{
   if(releaseEditionAssets.length!==38)await loadReleaseEdition();
   const check=releaseEditionAssets.filter(x=>all||x.asset_kind==='pdf');
   if(check.length!==(all?38:4))throw new Error('Некорректный перечень файлов: '+check.length);
   let total=0,verified=0;
   for(let i=0;i<check.length;i++){
    const asset=check[i];target.textContent='Проверка '+(i+1)+' из '+check.length+': '+asset.filename;
    const data=await fkGetVerifiedAsset(asset);
    total+=data.size;verified++;
   }
   target.textContent='✅ Успешно: '+verified+' из '+check.length+' · '+(total/1048576).toFixed(2)+' МБ прочитано из приватного Supabase. SHA-256 и формат совпали. Права покупателей не изменялись.';
  }catch(e){target.textContent='❌ Проверка прервана: '+(e.message||'ошибка чтения');status('Проверка файлов: '+(e.message||'ошибка'),true)}
  finally{for(const id of ids)$(id).disabled=false}
 }
 async function fkPreviewAsset(id){
  if(!isAdmin)return;
  const win=window.open('about:blank','_blank');
  const el=$('fkTestResult');
  try{
   if(releaseEditionAssets.length!==38)await loadReleaseEdition();
   const asset=releaseEditionAssets.find(x=>x.asset_key===id);
   if(!asset)throw new Error('Файл не зарегистрирован');
   el.textContent='Проверка и открытие '+asset.filename+'…';
   const blob=await fkGetVerifiedAsset(asset);
   const url=URL.createObjectURL(blob);
   if(win){win.location.href=url+'#page=1';}
   else{const l=document.createElement('a');l.href=url;l.download=asset.filename;document.body.append(l);l.click();l.remove()}
   el.textContent='✅ '+asset.filename+' проверен. Просмотр открыт. У покупателей доступ определяется только активным оплаченным тарифом.';
   setTimeout(()=>URL.revokeObjectURL(url),600000);
  }catch(e){if(win)win.close();el.textContent='❌ Не удалось открыть: '+(e.message||'ошибка')}
 }
 $('fkTestPdf').addEventListener('click',()=>fkRunDiagnostics(false));
 $('fkTestAll').addEventListener('click',()=>fkRunDiagnostics(true));
 $('fkOpenStart').addEventListener('click',()=>fkPreviewAsset('start_dishes_pdf'));
 $('fkOpenPro').addEventListener('click',()=>fkPreviewAsset('pro_dishes_pdf'));

 async function uploadAllReleaseFiles(){
  if(!isAdmin||!user){status('Требуется подтверждённый доступ владельца.',true);return}
  const file=$('releaseAllZip').files?.[0],button=$('releaseUploadAll38');
  if(!file){status('Выберите объединённый ZIP с 38 файлами.',true);return}
  if(file.size>65000000){status('Архив превышает допустимый размер.',true);return}
  button.disabled=true;
  try{
   status('Проверяю манифест и контрольные суммы всех 38 файлов…');
   const zip=await (await import("https://esm.sh/jszip@3.10.1")).default.loadAsync(file);
   const mf=zip.file('manifest.json');
   if(!mf)throw new Error('Нет manifest.json.');
   const manifest=JSON.parse(await mf.async('string'));
   if(manifest.format!=='farukh-kitchen-release-v1'||manifest.edition!=='2026-11-03'||manifest.count!==38||!Array.isArray(manifest.assets)||manifest.assets.length!==38)throw new Error('Архив не соответствует редакции 03.11.2026.');
   if(releaseEditionAssets.length!==38)throw new Error('База данных обновления не готова.');
   const expected=new Map(releaseEditionAssets.map(a=>[a.asset_key,a]));
   if(expected.size!==38||new Set(manifest.assets.map(a=>a.asset_key)).size!==38)throw new Error('Дубли или пропуски в манифесте.');
   // Verify the entire release before writing anything.
   for(let i=0;i<manifest.assets.length;i++){
    const a=manifest.assets[i],b=expected.get(a.asset_key);
    if(!b||a.object_path!==b.object_path||a.bundle_path!=='files/'+b.filename||Number(a.size)!==Number(b.expected_size_bytes)||a.sha256!==b.expected_sha256||b.released)throw new Error('Несовпадение манифеста: '+a.asset_key);
    const item=zip.file(a.bundle_path);
    if(!item)throw new Error('Отсутствует '+a.bundle_path);
    const bytes=await item.async('uint8array');
    if(bytes.byteLength!==Number(b.expected_size_bytes)||(await sha256(new Blob([bytes])))!==b.expected_sha256)throw new Error('Неверная контрольная сумма '+a.asset_key);
    if(i%5===4)status('Проверено '+(i+1)+' из 38 файлов…');
   }
   for(let i=0;i<manifest.assets.length;i++){
    const a=manifest.assets[i],b=expected.get(a.asset_key),item=zip.file(a.bundle_path);
    status('Загрузка '+(i+1)+'/38 · '+b.filename);
    const bytes=await item.async('uint8array');
    const blob=new Blob([bytes],{type:b.asset_kind==='pdf'?'application/pdf':'image/webp'});
    const {error:up}=await sb.storage.from('fk-paid-ttk').upload(b.object_path,blob,{upsert:true,contentType:blob.type,cacheControl:'0'});
    if(up)throw new Error('Ошибка записи '+b.filename+': '+up.message);
    const {data:remote,error:down}=await sb.storage.from('fk-paid-ttk').download(b.object_path);
    if(down||!remote||remote.size!==blob.size||(await sha256(remote))!==b.expected_sha256)throw new Error('Повторная проверка не прошла: '+b.filename);
   }
   status('38 из 38 файлов загружены и проверены. До решения владельца выпуск остаётся закрытым.');
   await loadReleaseEdition();
  }catch(e){status('Загрузка не завершена: '+(e.message||'неизвестная ошибка'),true)}
  finally{button.disabled=false}
 }
 $('releaseUploadAll38').addEventListener('click',uploadAllReleaseFiles);

 async function uploadReleaseZip(group){
  if(!isAdmin||!user){status('Загрузка доступна только владельцу',true);return}
  const f=$(group==='docs'?'releaseZipDocs':'releaseZipPhotos').files?.[0], b=$(group==='docs'?'releaseUploadDocs':'releaseUploadPhotos');
  if(!f){status('Выберите ZIP новой редакции',true);return}
  if(f.size>60000000){status('ZIP больше допустимого размера',true);return}
  b.disabled=true;
  try{
    const z=await (await import("https://esm.sh/jszip@3.10.1")).default.loadAsync(f);
    const mf=z.file('manifest.json');if(!mf)throw new Error('В ZIP нет manifest.json');
    const m=JSON.parse(await mf.async('text'));
    const expected=releaseEditionAssets.filter(a=>group==='docs'?a.asset_kind==='pdf':a.asset_kind==='image');
    if(m.format!=='farukh-kitchen-release-v1'||m.edition!=='2026-11-03'||!Array.isArray(m.assets)||m.assets.length!==expected.length||expected.length!==(group==='docs'?4:34))throw new Error('Неправильный пакет обновления');
    const keys=new Set(m.assets.map(x=>x.asset_key));
    if(keys.size!==expected.length)throw new Error('Дубли ключей в манифесте');
    // Verify every file before writing any object.
    for(const a of expected){
      const entry=m.assets.find(x=>x.asset_key===a.asset_key);
      if(!entry||entry.bundle_path!=='files/'+a.filename||entry.sha256!==a.expected_sha256||Number(entry.size)!==Number(a.expected_size_bytes)||entry.object_path!==a.object_path)throw new Error('Несовпадение метаданных '+a.asset_key);
      const file=z.file(entry.bundle_path);if(!file)throw new Error('Не найден файл '+entry.bundle_path);
      const bytes=await file.async('uint8array');
      const raw=new Blob([bytes]);
      if(raw.size!==Number(a.expected_size_bytes)||(await sha256(raw))!==a.expected_sha256)throw new Error('Ошибка контрольной суммы '+a.filename);
    }
    for(let i=0;i<expected.length;i++){
      const a=expected[i],entry=m.assets.find(x=>x.asset_key===a.asset_key);
      status('Загрузка '+(i+1)+' из '+expected.length+': '+a.filename);
      const bytes=await z.file(entry.bundle_path).async('uint8array');
      const blob=new Blob([bytes],{type:a.asset_kind==='pdf'?'application/pdf':'image/webp'});
      const {error:up}=await sb.storage.from('fk-paid-ttk').upload(a.object_path,blob,{upsert:true,contentType:blob.type,cacheControl:'0'});
      if(up)throw up;
      const {data:remote,error:down}=await sb.storage.from('fk-paid-ttk').download(a.object_path);
      if(down||!remote||remote.size!==blob.size||(await sha256(remote))!==a.expected_sha256)throw new Error('Ошибка проверки после загрузки '+a.filename);
    }
    status(expected.length+' файлов загружены и проверены. Публикация ожидает подтверждения владельца.');
    await loadReleaseEdition();
  }catch(e){status('Ошибка загрузки новой редакции: '+(e.message||'неизвестная ошибка'),true)}
  finally{b.disabled=false}
 }
 $('releaseUploadDocs').addEventListener('click',()=>uploadReleaseZip('docs'));
 $('releaseUploadPhotos').addEventListener('click',()=>uploadReleaseZip('images'));

 async function loadReadiness(){
  const el=$('fkReadinessStats');if(!isAdmin||!el)return;
  el.textContent='Проверяю 93 ТТК, структуру и приватные файлы…';
  try{
   const work=[
    sb.from('fk_recipes').select('id',{head:true,count:'exact'}),
    sb.from('fk_recipes').select('id',{head:true,count:'exact'}).eq('status','review'),
    sb.from('fk_ingredients').select('id',{head:true,count:'exact'}),
    sb.from('fk_steps').select('id',{head:true,count:'exact'}),
    sb.from('fk_release_assets').select('asset_key',{head:true,count:'exact'}).eq('released',true),
    sb.from('fk_paid_assets').select('asset_key',{head:true,count:'exact'}).eq('released',true),
    sb.from('fk_document_audit').select('recipe_id',{head:true,count:'exact'}).eq('documentary_checked',true),
    sb.from('fk_release_assets').select('filename,object_path,expected_size_bytes').eq('asset_key','common_preps_pdf').maybeSingle()
   ];
   const data=await Promise.all(work);
   const bad=data.find(x=>x.error);
   if(bad)throw new Error(bad.error?.message||'Нет доступа к реестру');
   const [recipes,review,ingredients,steps,current,legacy,audited]=data.slice(0,7).map(x=>Number(x.count||0));
   const currentPF=data[7]?.data?.object_path||'';
   const correctedPF=currentPF.includes('2026-11-05/docs/PF_34_20261105_corrected.pdf');
   // Document-only audit; do not claim that these recipes have passed HACCP testing.
   const checks=[
    ['Технологических карт',recipes+' из 93',false],
    ['Документально проверено',audited+' из 93',false],
    ['Выпуск: PDF и фото',current+' из 38',current!==38],
    ['Исправление ПФ DUNKAN',correctedPF?'В актуальной версии':'Требует проверки',!correctedPF],
    ['Сырьевых строк',String(ingredients),false],
    ['Шагов приготовления',String(steps),false],
    ['На производственную проверку',review+' ТТК',review>0],
    ['Старый архив, доступно',legacy+' из 4',false]
   ];
   el.replaceChildren();
   const grid=document.createElement('div');grid.className='owner-readiness-grid';
   for(const [label,value,warning] of checks){
    const box=document.createElement('div');box.className='owner-readiness-item'+(warning?' warn':'');
    const lbl=document.createElement('small');lbl.textContent=label;
    const val=document.createElement('strong');val.textContent=value;
    box.append(lbl,val);grid.append(box);
   }
   el.append(grid);


  }catch(err){el.textContent='Не удалось получить текущую сводку: '+(err?.message||'проверьте вход в кабинет')}
 }
 $('fkReadinessRefresh').addEventListener('click',()=>loadReadiness());

 async function access(action){
  if(!isAdmin){status('Доступно только владельцу',true);return}
  const p_email=$('buyerEmail').value.trim(),p_package_code=$('buyerTier').value;
  if(!/^\S+@\S+\.\S+$/.test(p_email)){status('Укажите почту покупателя.',true);return}
  const exp=$('buyerExpiry').value;const p_expires_at=exp?new Date(exp+'T23:59:59').toISOString():null;
  const btn=$(action==='activate'?'grantBuyer':'revokeBuyer');btn.disabled=true;
  try{
   const {data,error}=await sb.rpc('fk_owner_set_buyer_access',{p_email,p_package_code,p_action:action,p_expires_at});
   if(error)throw error;if(!data?.ok)throw new Error('Покупатель ещё не зарегистрировался и не подтвердил email в личном кабинете.');
   status(action==='activate'?'Доступ покупателю активирован.':'Доступ покупателю отозван.');
  }catch(e){status(e.message||'Не удалось изменить доступ.',true)}finally{btn.disabled=false}
 }

 $('uploadReleaseBundle').addEventListener('click',async()=>{
  if(!isAdmin||!user){status('Войдите в подтверждённый аккаунт владельца.',true);return}
  const input=$('releaseBundle');
  if(!input.files||input.files.length!==1){status('Выберите единый ZIP-архив для загрузки.',true);return}
  const button=$('uploadReleaseBundle');button.disabled=true;
  try{
   status('Открываю архив и проверяю его состав…');
   const zip=await (await import("https://esm.sh/jszip@3.10.1")).default.loadAsync(input.files[0]);
   const manifestFile=zip.file('manifest.json');
   if(!manifestFile)throw new Error('Нет manifest.json. Выберите подготовленный для FARUKH KITCHEN архив.');
   const manifest=JSON.parse(await manifestFile.async('string'));
   const rows=Array.isArray(manifest.assets)?manifest.assets:[];
   const expected=['start_pdf','start_zip','pro_pdf','pro_zip'];
   if(rows.length!==4||!expected.every(key=>rows.some(row=>row.key===key)))throw new Error('В архиве отсутствует один из четырёх файлов.');
   const {data:entries,error:entryError}=await sb.from('fk_paid_assets').select('*');
   if(entryError)throw entryError;
   const current=(entries||[]).filter(a=>expected.includes(a.asset_key));
   if(current.length!==4)throw new Error('Манифест закрытой библиотеки не настроен');
   // Validate all four before changing Storage.
   for(const asset of current){
     const row=rows.find(x=>x.key===asset.asset_key);
     if(!row||!row.bundle_path||row.sha256!==asset.expected_sha256||Number(row.size)!==Number(asset.expected_size_bytes))throw new Error('Версия файла '+asset.asset_key+' не совпадает с утверждённой.');
     if(!zip.file(row.bundle_path))throw new Error('Нет файла '+row.bundle_path);
   }
   for(let i=0;i<current.length;i++){
     const a=current[i],row=rows.find(x=>x.key===a.asset_key);
     status('Файл '+(i+1)+'/4: проверка SHA-256 и загрузка…');
     const bytes=await zip.file(row.bundle_path).async('uint8array');
     const blob=new Blob([bytes],{type:a.asset_key.endsWith('_pdf')?'application/pdf':'application/zip'});
     if(blob.size!==Number(a.expected_size_bytes)||(await sha256(blob))!==a.expected_sha256)throw new Error('Ошибка контроля целостности '+a.asset_key);
     const {error:uploadErr}=await sb.storage.from('fk-paid-ttk').upload(a.object_path,blob,{upsert:true,contentType:blob.type,cacheControl:'0'});
     if(uploadErr)throw uploadErr;
     await verifiedRemote(a);
   }
   for(const asset of current){
     if(asset.released)continue;
     const {error:releaseErr}=await sb.from('fk_paid_assets').update({released:true,approved_by:user.id,released_at:new Date().toISOString()}).eq('asset_key',asset.asset_key);
     if(releaseErr)throw releaseErr;
   }
   status('Готово: 4/4 файла загружены и проверены. Их могут скачивать только покупатели с подтверждённым доступом.');
   await loadFiles();
  }catch(e){status('Не удалось завершить загрузку: '+(e.message||'неизвестная ошибка'),true)}
  finally{button.disabled=false}
 });

 $('grantBuyer').addEventListener('click',()=>access('activate'));
 $('revokeBuyer').addEventListener('click',()=>access('revoke'));

 return {loadCurrent:()=>Promise.all([loadReleaseEdition(),loadReadiness()]),loadArchive:loadFiles};
}
