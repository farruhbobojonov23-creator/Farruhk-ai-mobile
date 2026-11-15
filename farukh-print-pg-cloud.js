// FARUKH PRINT Cloud: private PostgreSQL bridge for the isolated owner panel.
// Credentials exist only as Render environment secrets; all routes require the
// validated owner PIN session. Production printing and FARUKH AI are untouched.
import {Pool} from 'pg';
import crypto from 'node:crypto';

const url=String(process.env.FARUKH_PRINT_PG_URL||'');
const pool=url?new Pool({
  connectionString:url, max:2, connectionTimeoutMillis:9000,
  idleTimeoutMillis:15000, statement_timeout:14000, query_timeout:17000
}):null;
pool?.on('error',err=>console.error('[print-db] idle connection error',err.code||'error'));
const allowedOrigin=String(process.env.FARUKH_PRINT_APP_ORIGIN||'https://farukh-print-cloud-test-20261115.onrender.com');
function failure(res,err){
  console.error('[print-db] database request failed',String(err?.code||err?.name||'error'));
  return res.status(503).json({ok:false,error:'Облако временно недоступно. Изменения не подтверждены — повтори сохранение.'});
}
function positiveInt(v){
  if(v===null||v===''||v===undefined)return null;
  const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=8760?n:NaN;
}
function short(v,max){return String(v??'').trim().slice(0,max);}
async function stats(db=pool){
  const q=await db.query(`SELECT
    (SELECT count(*)::int FROM farukh_print.products WHERE active) products,
    (SELECT count(*)::int FROM farukh_print.product_photos ph JOIN farukh_print.products p ON p.id=ph.product_id WHERE p.active) photos,
    (SELECT count(*)::int FROM farukh_print.locations WHERE active) locations,
    (SELECT count(*)::int FROM farukh_print.staff_accounts WHERE status='active') employees,
    (SELECT count(*)::int FROM farukh_print.devices WHERE status='approved') devices,
    (SELECT count(*)::int FROM farukh_print.catalog_backups) backups,
    (SELECT coalesce(max(id),0)::bigint FROM farukh_print.catalog_revisions) revision`);
  return q.rows[0];
}
export async function printPgSelfCheck(){
  if(!pool){console.warn('[print-db] not configured');return}
  try{
    const data=await stats();
    console.info('[print-db] connected',JSON.stringify({target:process.env.FARUKH_PRINT_PG_TARGET||'unspecified',products:data.products,photos:data.photos,locations:data.locations}));
  }catch(e){console.error('[print-db] connection failed',e.code||e.name||'error')}
}
export function mountPrintPgBridge(app,authPin){
  app.use('/api/owner/db',authPin,async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(!pool)return res.status(503).json({ok:false,error:'База ещё не подключена.'});
    if(req.method==='POST'&&req.get('origin')!==allowedOrigin)
      return res.status(403).json({ok:false,error:'Запрос не из панели владельца.'});
    const route=req.path;
    try{
      if(req.method==='GET'&&route==='/status'){
        return res.json({ok:true,cloudConnected:true,target:process.env.FARUKH_PRINT_PG_TARGET||'unspecified',staffConnected:false,...await stats()});
      }
      if(req.method==='GET'&&route==='/catalog'){
        const q=await pool.query(`SELECT p.id,p.kind,p.name,p.category,p.composition,p.storage,
          p.shelf_life_hours AS hours,p.net_weight AS weight,p.weight_unit AS "weightUnit",p.tolerance,p.nutrition,p.needs_review AS "needsReview",p.updated_at AS "updatedAt",
          (ph.product_id IS NOT NULL) AS "hasPhoto"
          FROM farukh_print.products p
          LEFT JOIN farukh_print.product_photos ph ON ph.product_id=p.id
          WHERE p.active ORDER BY p.name,p.id`);
        return res.json({ok:true,products:q.rows});
      }
      if(req.method==='GET'&&route.startsWith('/photo/')){
        const id=decodeURIComponent(route.slice(7));
        if(id.length>128||!(/^[\w-]+$/).test(id))return res.status(400).end();
        const q=await pool.query('SELECT mime_type,image_data,external_url FROM farukh_print.product_photos WHERE product_id=$1',[id]);
        if(!q.rows.length)return res.status(404).end();
        const p=q.rows[0];
        if(p.image_data){
          if(!['image/png','image/jpeg','image/webp'].includes(p.mime_type))return res.status(415).end();
          res.setHeader('Content-Type',p.mime_type);res.setHeader('X-Content-Type-Options','nosniff');
          return res.send(p.image_data);
        }
        if(/^https:\/\/[^@\s]+$/.test(p.external_url||''))return res.redirect(302,p.external_url);
        return res.status(404).end();
      }

      // DEMO ONLY. New mutation routes refuse any environment not tagged DEMO.
      const isDemo=String(process.env.FARUKH_PRINT_PG_TARGET||'').startsWith('DEMO');
      if(req.method==='GET'&&route==='/archive'){
        if(!isDemo)return res.status(403).json({ok:false,error:'Архив доступен только в тестовой копии.'});
        const q=await pool.query('SELECT id,name,kind,updated_at AS "updatedAt" FROM farukh_print.products WHERE NOT active ORDER BY updated_at DESC LIMIT 150');
        return res.json({ok:true,products:q.rows});
      }
      if(req.method==='POST'&&route==='/create'){
        if(!isDemo)return res.status(403).json({ok:false,error:'Создание товаров доступно только в тестовой копии.'});
        const b=req.body||{},name=short(b.name,91),kind=b.kind;
        if(!name||name.length>90||!['ready','prep'].includes(kind))return res.status(400).json({ok:false,error:'Проверь название и тип товара.'});
        const id='fpdemo-'+crypto.randomUUID(),client=await pool.connect();
        try{
          await client.query('BEGIN');
          const q=await client.query("INSERT INTO farukh_print.products (id,name,kind,category,composition,storage,shelf_life_hours,net_weight,weight_unit,tolerance,nutrition,payload,active,needs_review,approved_for_print) VALUES ($1,$2,$3,NULL,NULL,NULL,NULL,NULL,'г',NULL,'{}'::jsonb,$4::jsonb,true,true,false) RETURNING id,updated_at",[id,name,kind,JSON.stringify({source:'neon-premium-demo',name,kind})]);
          const counts=await client.query("SELECT count(*)::int all_count,count(*) FILTER(WHERE kind='ready')::int ready,count(*) FILTER(WHERE kind='prep')::int prep FROM farukh_print.products WHERE active");
          const n=counts.rows[0];
          await client.query("INSERT INTO farukh_print.catalog_revisions(source,products_count,ready_count,prep_count,note) VALUES ('demo-owner-create',$1,$2,$3,'New demo item created from Premium V2')",[n.all_count,n.ready,n.prep]);
          await client.query('COMMIT');
          return res.json({ok:true,id,updatedAt:q.rows[0].updated_at,cloudSaved:true});
        }catch(e){await client.query('ROLLBACK').catch(()=>{});return failure(res,e)}
        finally{client.release()}
      }
      if(req.method==='POST'&&['/archive','/restore'].includes(route)){
        if(!isDemo)return res.status(403).json({ok:false,error:'Управление архивом только в тестовой копии.'});
        const b=req.body||{},id=String(b.id||'');
        if(id.length>128||!/^[\w-]+$/.test(id))return res.status(400).json({ok:false,error:'Неверный код товара.'});
        const restore=route==='/restore',client=await pool.connect();
        try{
          await client.query('BEGIN');
          const q=await client.query("UPDATE farukh_print.products SET active=$2,needs_review=true,approved_for_print=false,updated_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1 AND active<>$2 RETURNING id",[id,restore]);
          if(!q.rows.length){await client.query('ROLLBACK');return res.status(409).json({ok:false,error:'Товар отсутствует или уже изменён. Обнови список.'})}
          const counts=await client.query("SELECT count(*)::int all_count,count(*) FILTER(WHERE kind='ready')::int ready,count(*) FILTER(WHERE kind='prep')::int prep FROM farukh_print.products WHERE active");
          const n=counts.rows[0];
          await client.query("INSERT INTO farukh_print.catalog_revisions(source,products_count,ready_count,prep_count,note) VALUES ($1,$2,$3,$4,$5)",[restore?'demo-owner-restore':'demo-owner-archive',n.all_count,n.ready,n.prep,'Owner changed demo catalog; production Neon main unchanged']);
          await client.query('COMMIT');
          return res.json({ok:true,id,archived:!restore});
        }catch(e){await client.query('ROLLBACK').catch(()=>{});return failure(res,e)}
        finally{client.release()}
      }
      if(req.method==='POST'&&route==='/photo-upload'){
        if(!isDemo)return res.status(403).json({ok:false,error:'Замена фото разрешена только в тестовой копии.'});
        const b=req.body||{},id=String(b.id||''),mime=String(b.mime||''),raw=String(b.base64||'');
        if(id.length>128||!/^[\w-]+$/.test(id)||
          !['image/png','image/jpeg','image/webp'].includes(mime)||
          raw.length>1390000||raw.length<100||!/^[-A-Za-z0-9+/]+={0,2}$/.test(raw))
          return res.status(400).json({ok:false,error:'Выбери фото PNG, JPG или WebP до 1 МБ.'});
        const data=Buffer.from(raw,'base64');
        const valid=mime==='image/png'?data.subarray(0,8).toString('hex')==='89504e470d0a1a0a':
          mime==='image/jpeg'?data.subarray(0,3).toString('hex')==='ffd8ff':
          data.subarray(0,4).toString('ascii')==='RIFF'&&data.subarray(8,12).toString('ascii')==='WEBP';
        if(!valid||data.length>1040000||data.length<24)return res.status(400).json({ok:false,error:'Некорректное или слишком большое изображение.'});
        const sha=crypto.createHash('sha256').update(data).digest('hex');
        const client=await pool.connect();
        try{
          await client.query('BEGIN');
          const row=await client.query("SELECT id FROM farukh_print.products WHERE id=$1 AND active FOR UPDATE",[id]);
          if(!row.rows.length){await client.query('ROLLBACK');return res.status(404).json({ok:false,error:'Товар не найден.'})}
          const photoSql=[
            'INSERT INTO farukh_print.product_photos',
            '(product_id,mime_type,image_data,external_url,sha256,byte_size,updated_at)',
            'VALUES($1,$2,$3,NULL,$4,$5,now()) ON CONFLICT(product_id) DO UPDATE SET',
            'mime_type=EXCLUDED.mime_type,image_data=EXCLUDED.image_data,external_url=NULL,',
            'sha256=EXCLUDED.sha256,byte_size=EXCLUDED.byte_size,updated_at=now()'
          ].join(' ');
          await client.query(photoSql,[id,mime,data,sha,data.length]);
          await client.query("UPDATE farukh_print.products SET approved_for_print=false,needs_review=true,updated_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1",[id]);
          await client.query('COMMIT');
          return res.json({ok:true,id,hasPhoto:true,bytes:data.length});
        }catch(e){await client.query('ROLLBACK').catch(()=>{});return failure(res,e)}
        finally{client.release()}
      }

      if(req.method==='POST'&&route==='/save'){
        const b=req.body;
        if(!b||typeof b!=='object'||Array.isArray(b))
          return res.status(400).json({ok:false,error:'Неверный формат карточки.'});
        const id=String(b.id||'');
        const updatedAt=String(b.updatedAt||'');
        const name=short(b.name,91),kind=b.kind,category=short(b.category,120)||null;
        const composition=short(b.composition,600)||null,storage=short(b.storage,60)||null;
        const hours=positiveInt(b.hours);
        if(id.length<1||id.length>128||!/^[\w-]+$/.test(id)||
          name.length<1||name.length>90||!['ready','prep'].includes(kind)||
          (b.category!=null&&String(b.category).length>120)||
          (b.composition!=null&&String(b.composition).length>600)||
          (b.storage!=null&&String(b.storage).length>60)||
          Number.isNaN(hours)||!Number.isFinite(Date.parse(updatedAt)))
          return res.status(400).json({ok:false,error:'Проверь название, срок хранения и обязательные поля.'});
        const client=await pool.connect();
        try{
          await client.query('BEGIN');
          const current=await client.query('SELECT updated_at,net_weight,weight_unit,tolerance,nutrition FROM farukh_print.products WHERE id=$1 AND active=true FOR UPDATE',[id]);
          if(!current.rows.length){await client.query('ROLLBACK');return res.status(404).json({ok:false,error:'Товар в облаке не найден.'})}
          if(new Date(current.rows[0].updated_at).getTime()!==new Date(updatedAt).getTime()){
            await client.query('ROLLBACK');
            return res.status(409).json({ok:false,conflict:true,error:'Карточка уже изменена в облаке. Обнови список перед повторным сохранением.'});
          }
          // Keep the previous fields if the client did not provide these new options.
          const before=current.rows[0],isSet=key=>Object.prototype.hasOwnProperty.call(b,key);
          const parseNumber=(val,{allowZero=false,max=100000}={})=>{
            if(val===null||val===''||val===undefined)return null;
            const n=Number(val);
            return Number.isFinite(n)&&(allowZero?n>=0:n>0)&&n<=max?n:NaN;
          };
          const weight=isSet('weight')?parseNumber(b.weight):before.net_weight;
          const tolerance=isSet('tolerance')?parseNumber(b.tolerance,{allowZero:true,max:10000}):before.tolerance;
          const weightUnit=isSet('weightUnit')?String(b.weightUnit||'г'):before.weight_unit;
          if(Number.isNaN(weight)||Number.isNaN(tolerance)||!['г','кг','мл','л','шт'].includes(weightUnit||'г')){
            await client.query('ROLLBACK');
            return res.status(400).json({ok:false,error:'Проверь массу, отклонение и единицу измерения.'});
          }
          const nutrients={...(before.nutrition||{})};
          if(isSet('nutrition')){
            if(!b.nutrition||typeof b.nutrition!=='object'||Array.isArray(b.nutrition)){
              await client.query('ROLLBACK');
              return res.status(400).json({ok:false,error:'Неверный формат КБЖУ.'});
            }
            for(const key of ['kcal','p','f','c']){
              if(!Object.prototype.hasOwnProperty.call(b.nutrition,key))continue;
              const value=parseNumber(b.nutrition[key],{allowZero:true,max:1000});
              if(Number.isNaN(value)){
                await client.query('ROLLBACK');
                return res.status(400).json({ok:false,error:'КБЖУ: только неотрицательные числа.'});
              }
              if(value===null)delete nutrients[key];else nutrients[key]=value;
            }
          }
          const patch={name,kind,category:category||'',composition:composition||'',storage:storage||'',hours,
            ...(isSet('weight')?{weight}:{}),...(isSet('tolerance')?{tolerance}:{}),
            ...(isSet('weightUnit')?{weightUnit}:{}),...(isSet('nutrition')?{nutrition:nutrients}:{}),
            needsReview:true};
          const q=await client.query(`UPDATE farukh_print.products SET name=$2,kind=$3,category=$4,
             composition=$5,storage=$6,shelf_life_hours=$7,needs_review=true,
             approved_for_print=false,payload=payload||$8::jsonb,
             net_weight=$9,tolerance=$10,weight_unit=$11,nutrition=$12::jsonb,
             updated_at=date_trunc('milliseconds',clock_timestamp())
             WHERE id=$1 RETURNING updated_at`,[
              id,name,kind,category,composition,storage,hours,JSON.stringify(patch),weight,tolerance,weightUnit||null,JSON.stringify(nutrients)
          ]);
          const totals=await client.query(`SELECT count(*)::int total,
             count(*) FILTER(WHERE kind='ready')::int ready,
             count(*) FILTER(WHERE kind='prep')::int prep
             FROM farukh_print.products WHERE active`);
          const n=totals.rows[0];
          await client.query(`INSERT INTO farukh_print.catalog_revisions
             (source,products_count,ready_count,prep_count,note)
             VALUES ('owner-web-save',$1,$2,$3,'Owner panel saved to private Neon PostgreSQL')`,[n.total,n.ready,n.prep]);
          await client.query('COMMIT');
          return res.json({ok:true,id,updatedAt:q.rows[0].updated_at,cloudSaved:true});
        }catch(e){await client.query('ROLLBACK').catch(()=>{});return failure(res,e)}
        finally{client.release()}
      }
      return res.status(404).json({ok:false,error:'Неизвестная операция.'});
    }catch(e){return failure(res,e)}
  });
}
