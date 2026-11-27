import json, os, threading, time, io, hmac, resource, warnings, secrets, gc, hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
state={"status":"starting","test":"synthetic table only"}
lock=threading.Lock()
ocr=None
MAX_BYTES=4*1024*1024
public_remaining=14
jobs={}
job_lock=threading.Lock()
def prune_jobs():
    now=time.monotonic()
    for key in list(jobs):
        if jobs[key].get('finished',now)+600<now: jobs.pop(key,None)
def benchmark_amounts(payload, rows, width):
    from collections import Counter
    from decimal import Decimal, InvalidOperation
    import re
    reference=json.loads(os.environ.get("OCR_REFERENCE","{}")).get(hashlib.sha256(payload).hexdigest())
    if not reference: return {"status":"unknown_photo"}
    def amount(s):
        s=re.sub(r"[\s\u00a0\u202f]","",str(s)).replace(",",".")
        if not re.fullmatch(r"\d+(?:\.\d{1,2})?",s): return None
        try: return int(Decimal(s)*100)
        except InvalidOperation: return None
    seen=Counter(amount(r["text"]) for r in rows if r.get("box") and (r["box"][0]+r["box"][2])/2 >= width*reference.get("min_x",0.66))
    expected=Counter(amount(a) for a in reference["amounts"])
    matched=sum((seen & expected).values())
    total=reference.get("total")
    result={"status":"numeric_presence_only","sample":reference["id"],"matched_amounts":matched,"expected_amounts":sum(expected.values()),"total_found":None if total is None else seen[amount(total)]>0,"verified":False}
    print("REAL_BENCHMARK",json.dumps(result),flush=True)
    return result
def process_job(key, payload):
    start=time.monotonic()
    try:
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS=12_000_000
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as source:
                if source.format not in ('JPEG','PNG'): raise ValueError('format')
                source.thumbnail((1400,1400))
                img=ImageOps.exif_transpose(source).convert('RGB')
        rows=recognize_page(img)
        benchmark=benchmark_amounts(payload,rows,img.width)
        del payload
        result={'status':'done','rows':rows,'width':img.width,'height':img.height,'seconds':round(time.monotonic()-start,1),'verified':False,'memory':memory_cgroup(),'benchmark':benchmark}
        del img
        print('OCR_REQUEST completed',json.dumps({'seconds':result['seconds'],'cells':len(rows),'memory':result['memory']}),flush=True)
    except Exception as e:
        result={'status':'error','error':'Не удалось обработать фотографию'}
        print('OCR_REQUEST error',type(e).__name__,flush=True)
    finally:
        gc.collect()
        with job_lock:
            jobs[key]={**result,'finished':time.monotonic()}
        lock.release()
def public_test_open():
    return time.time()<1795778400 and public_remaining>0
def rss():
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,1)
def clean_grid(img):
    import cv2, numpy as np
    a=np.array(img)
    gray=cv2.cvtColor(a,cv2.COLOR_RGB2GRAY)
    ink=cv2.threshold(gray,0,255,cv2.THRESH_BINARY_INV|cv2.THRESH_OTSU)[1]
    h,w=gray.shape
    horizontal=cv2.morphologyEx(ink,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(max(45,w//7),1)))
    vertical=cv2.morphologyEx(ink,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(1,max(45,h//5))))
    grid=cv2.bitwise_or(horizontal,vertical)
    return cv2.inpaint(a,grid,2,cv2.INPAINT_TELEA)
def memory_cgroup():
    out={}
    for key in ("current","peak","max"):
        try:
            with open("/sys/fs/cgroup/memory."+key) as f: out[key+"_mb"]=round(int(f.read().strip())/1048576,1)
        except (OSError,ValueError): pass
    return out
def recognize_array(array):
    rows=[]
    for result in ocr.predict(array):
        d=result.json
        d=d.get("res",d)
        texts=d.get("rec_texts",[])
        scores=d.get("rec_scores",[])
        boxes=d.get("rec_boxes",[])
        for i,t in enumerate(texts):
            rows.append({"text":str(t),"confidence":round(float(scores[i]),4) if i<len(scores) else None,"box":[int(x) for x in boxes[i]] if i<len(boxes) else None})
    return rows
def parse_quantity(value):
    import re
    m=re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*([A-Za-zА-Яа-яΓ.]+)\s*",value)
    if not m: return None
    number,unit=m.groups()
    unit=unit.casefold().rstrip(".")
    aliases={"кг":"кг","kг":"кг","kg":"кг","kγ":"кг","шт":"шт","шt":"шт","шт.":"шт","л":"л","l":"л"}
    if unit not in aliases: return None
    return number.replace(",",".")+" "+aliases[unit]
def quantity_suggestion(row):
    raw=row["text"]
    retry=" ".join(a["text"] for a in row.get("retry_candidates",[]))
    suggestions={s for s in (parse_quantity(raw),parse_quantity(retry)) if s}
    return next(iter(suggestions)) if len(suggestions)==1 else None
def recognize(img, retry_limit=2):
    import cv2, re
    clean=clean_grid(img)
    rows=recognize_array(clean)
    h,w=clean.shape[:2]
    retries=0
    for row in rows:
        if row["confidence"] is None or row["confidence"]>=0.85 or not row["box"] or retries>=retry_limit: continue
        if not re.search(r"\d",row["text"]) or not re.search(r"[A-Za-zА-Яа-яΓ]",row["text"]): continue
        x1,y1,x2,y2=row["box"]
        crop=clean[max(0,y1-3):min(h,y2+3),max(0,x1-3):min(w,x2+3)]
        if crop.size==0 or crop.shape[1]>500: continue
        retries+=1
        factor=min(3,max(1,96/max(1,crop.shape[0])))
        crop=cv2.resize(crop,None,fx=factor,fy=factor,interpolation=cv2.INTER_CUBIC)
        crop=cv2.copyMakeBorder(crop,24,24,24,24,cv2.BORDER_CONSTANT,value=(255,255,255))
        alternatives=recognize_array(crop)
        row["retry_candidates"]=[{"text":a["text"],"confidence":a["confidence"]} for a in alternatives]
        row["needs_review"]=True
    for row in rows:
        row.setdefault("needs_review",row["confidence"] is None or row["confidence"]<0.85)
        suggestion=quantity_suggestion(row)
        if suggestion and suggestion!=row["text"]:
            row["quantity_suggestion"]=suggestion
            row["needs_review"]=True
    return rows
def recognize_page(img):
    import numpy as np
    clean=clean_grid(img)
    h,w=clean.shape[:2]
    def starts(size, tile, stride):
        return sorted(set(list(range(0,max(1,size-tile+1),stride))+[max(0,size-tile)]))
    collected=[]
    xs=starts(w,640,480)
    ys=starts(h,480,360)
    for y in ys:
        for x in xs:
            current=memory_cgroup().get("current_mb",0)
            if current>440:
                gc.collect()
                if memory_cgroup().get("current_mb",0)>440:
                    raise MemoryError("Insufficient headroom for next tile")
            tile=np.ascontiguousarray(clean[y:y+480,x:x+640])
            rows=recognize_array(tile)
            th,tw=tile.shape[:2]
            for row in rows:
                if not row["box"]: continue
                a,b,d,e=row["box"]
                edge=(x>0 and a<8) or (x+tw<w and d>tw-8) or (y>0 and b<8) or (y+th<h and e>th-8)
                row["box"]=[a+x,b+y,d+x,e+y]
                row["edge_review"]=edge
                row["needs_review"]=edge or row["confidence"] is None or row["confidence"]<0.85
                suggestion=quantity_suggestion(row)
                if suggestion and suggestion!=row["text"]:
                    row["quantity_suggestion"]=suggestion
                    row["needs_review"]=True
                collected.append(row)
            del tile,rows
            print("PAGE_TILE",x,y,memory_cgroup(),flush=True)
    def overlap(a,b):
        ax,ay,az,aw=a["box"];bx,by,bz,bw=b["box"]
        intersection=max(0,min(az,bz)-max(ax,bx))*max(0,min(aw,bw)-max(ay,by))
        return intersection/max(1,min((az-ax)*(aw-ay),(bz-bx)*(bw-by)))
    unique=[]
    for row in sorted(collected,key=lambda a:(not a["edge_review"],a["confidence"] or 0),reverse=True):
        if any(row["text"].casefold()==other["text"].casefold() and overlap(row,other)>0.5 for other in unique): continue
        if row["edge_review"] and any(not other["edge_review"] and overlap(row,other)>0.8 for other in unique): continue
        unique.append(row)
    return sorted(unique,key=lambda a:(a["box"][1],a["box"][0]))
def full_page_test():
    from PIL import Image, ImageDraw, ImageFont
    start=time.monotonic()
    img=Image.new("RGB",(1120,1400),"white")
    draw=ImageDraw.Draw(img)
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",26)
    draw.text((28,25),"Учебная накладная 48291",font=font,fill="black")
    names=["Рис","Васаби","Имбирь","Сыр","Майонез","Креветка","Форель","Нори","Кунжут","Мидии","Соус"]
    targets=[]
    for i,name in enumerate(names):
        y=160+82*i
        amount=f"{(i+2)*(132+i*7)}.00"
        targets.append((amount,y))
        for x,value in [(35,name),(355,str(i+2)+" кг"),(650,f"{132+i*7}.00"),(900,amount)]:
            draw.text((x,y),value,font=font,fill="black")
        draw.line((20,y+62,1090,y+62),fill="gray",width=1)
    for x in (20,320,600,860,1090): draw.line((x,130,x,1070),fill="gray",width=1)
    with lock: rows=recognize_page(img)
    checks=[]
    for target,y in targets:
        candidates=[r["text"] for r in rows if 870<(r["box"][0]+r["box"][2])/2<1110 and y-10<(r["box"][1]+r["box"][3])/2<y+45]
        checks.append({"expected":target,"actual":candidates,"pass":target in candidates})
    return {"status":"passed" if all(x["pass"] for x in checks) else "recognition mismatch","matched":sum(x["pass"] for x in checks),"total":len(checks),"cells":len(rows),"checks":checks,"seconds":round(time.monotonic()-start,1),"cgroup":memory_cgroup()}
def test():
    global ocr
    start=time.monotonic()
    try:
        from PIL import Image, ImageDraw, ImageFont
        from paddleocr import PaddleOCR
        state["status"]="loading models"
        ocr=PaddleOCR(text_detection_model_name="PP-OCRv5_mobile_det",text_recognition_model_name="eslav_PP-OCRv5_mobile_rec",use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,device="cpu",enable_mkldnn=False,cpu_threads=1,text_det_limit_side_len=640,text_det_limit_type="max",text_recognition_batch_size=1)
        state["status"]="recognizing"
        img=Image.new("RGB",(1100,400),"white")
        draw=ImageDraw.Draw(img)
        font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",32)
        draw.text((20,15),"Тестовая накладная 123",font=font,fill="black")
        for y in (75,140,205,270,335): draw.line((10,y,1090,y),fill="gray",width=1)
        for x in (10,370,570,790,1090): draw.line((x,75,x,335),fill="gray",width=1)
        for y,values in [(90,("Товар","Кол-во","Цена","Сумма")),(155,("Рис","5 кг","250.00","1250.00")),(220,("Васаби","40 шт","6.50","260.00")),(285,("Итого","","","1510.00"))]:
            for x,t in zip((20,380,580,800),values): draw.text((x,y),t,font=font,fill="black")
        with lock: rows=recognize(img)
        expected=[("Тестовая накладная 123",(0,0,1100,75)),("Рис",(10,140,370,205)),("5 кг",(370,140,570,205)),("250.00",(570,140,790,205)),("1250.00",(790,140,1100,205)),("Васаби",(10,205,370,270)),("40 шт",(370,205,570,270)),("6.50",(570,205,790,270)),("260.00",(790,205,1100,270)),("1510.00",(790,270,1100,335))]
        checks=[]
        for target,(x1,y1,x2,y2) in expected:
            observed=[]
            candidates=[]
            suggestions=[]
            for row in rows:
                if not row["box"]: continue
                a,b,c,d=row["box"]
                if x1<=(a+c)/2<x2 and y1<=(b+d)/2<y2:
                    observed.append(row["text"])
                    candidates.extend(a["text"] for a in row.get("retry_candidates",[]))
                    if row.get("quantity_suggestion"): suggestions.append(row["quantity_suggestion"])
            actual=" ".join(observed)
            ok=actual.casefold().replace(",",".").strip()==target.casefold()
            checks.append({"expected":target,"actual":actual,"pass":ok,"retry_candidates":candidates,"retry_match":any(a.casefold().strip()==target.casefold() for a in candidates),"suggestion_match":len(suggestions)==1 and suggestions[0]==target})
        missing=[x for x in checks if not x["pass"]]
        state.update(status="passed" if not missing else "recognition mismatch",checks=checks,matched=len(checks)-len(missing),with_review_candidates=sum(x["pass"] or x["suggestion_match"] for x in checks),total=len(checks),rows=rows,seconds=round(time.monotonic()-start,1),peak_rss_mb=rss(),cgroup=memory_cgroup())
        print("TABLE_SMOKE",json.dumps(state,ensure_ascii=False),flush=True)
        state["status"]="full page test"
        gc.collect()
        full=full_page_test()
        state["full_page"]=full
        state["status"]="recognition mismatch" if full["status"]=="passed" else "full page mismatch"
        print("FULL_PAGE_SMOKE",json.dumps(full,ensure_ascii=False),flush=True)
    except Exception as e:
        ocr=None
        state.update(status="error",error=type(e).__name__,detail=str(e)[:300])
        print("TABLE_SMOKE",json.dumps(state),flush=True)
PAGE=r"""<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FARUKH SUPPLY • OCR тест</title><style>body{background:#10172b;color:#eef2ff;font:16px system-ui;margin:24px auto;padding:0 16px;max-width:700px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0;border-radius:10px}button{background:#7167e8;color:white;border:0;font-weight:bold}button:disabled{opacity:.5}article,pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1e2945;padding:16px;border-radius:10px}article{margin:12px 0}progress{width:100%}.warning{color:#ffd279}</style></head><body><h1>FARUKH SUPPLY</h1><p>Закрытый тест сканера. Выберите до 7 фотографий. Они обрабатываются по очереди; фото не записываются на диск; результат временно хранится в памяти до 10 минут.</p><p id="health">Проверяем готовность сервера…</p><input id="token" type="password" autocomplete="off" placeholder="Тестовый пароль"><input id="photo" type="file" accept="image/jpeg,image/png" multiple><button id="send">Распознать накладные</button><progress id="progress" max="7" value="0"></progress><button id="save" disabled>Скачать общий отчёт JSON</button><p id="out">JPEG/PNG, до 4 МБ каждый.</p><section id="results"></section><script>
let result=null,openTest=false,ready=false,running=false;const el=id=>document.getElementById(id);
async function health(){try{const r=await fetch('/health',{cache:'no-store'});const d=await r.json();openTest=d.public_test===true;ready=['passed','recognition mismatch'].includes(d.status)&&d.full_page?.status==='passed'&&d.upload_enabled&&!d.busy;el('send').disabled=running||!ready;el('token').hidden=openTest;el('health').textContent=!d.upload_enabled?'Загрузка пока закрыта':(['passed','recognition mismatch'].includes(d.status)?(d.busy?'Сканер обрабатывает документ':'Сканер доступен для теста'):(d.status==='full page mismatch'?'Тест полной страницы не пройден':d.status==='error'?'Сбой теста сервера':d.status==='full page test'?'Проверяем документ полного размера…':'Загрузка моделей…'))}catch(e){ready=false;el('send').disabled=true;el('health').textContent='Сервер запускается или недоступен';}}
el('send').disabled=true;health();setInterval(health,5000);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitJob(key){for(let k=0;k<120;k++){await delay(2500);let r;try{r=await fetch('/job',{headers:{'X-Job-Key':key},cache:'no-store'});}catch(e){continue;}let d;try{d=await r.json()}catch(e){continue;}if(r.status===404)throw Error('Сервер перезапустился или результат истёк');if(d.status==='done')return d;if(d.status==='error')throw Error(d.error); }throw Error('Превышено время ожидания обработки');}
function show(item){const a=document.createElement('article');const title=document.createElement('strong');title.textContent=item.file;a.append(title);const p=document.createElement('pre');p.textContent=item.ok?item.rows.map(x=>x.text+' ['+x.confidence+']'+(x.needs_review?' — проверить':'')+(x.quantity_suggestion?' | вариант: '+x.quantity_suggestion:'')).join('\n')+'\nВремя: '+item.seconds+' сек.':item.error;a.append(p);el('results').append(a);}
el('send').onclick=async()=>{
 if(!ready||running)return;
 const files=Array.from(el('photo').files),token=el('token').value;
 if(!files.length||files.length>7||(!token&&!openTest)){el('out').textContent='Выберите 1–7 фото; если тест закрыт, введите пароль.';return}
 if(files.some(f=>f.size>4194304||!['image/jpeg','image/png'].includes(f.type))){el('out').textContent='Допустимы JPEG/PNG до 4 МБ.';return}
 running=true;el('send').disabled=true;el('save').disabled=true;el('photo').disabled=true;el('token').disabled=true;el('results').replaceChildren();el('progress').max=files.length;el('progress').value=0;
 result={schema:'farukh-ocr-batch-v1',verified:false,documents:[]};
 try{for(let i=0;i<files.length;i++){
  const f=files[i];el('out').textContent='Обработка '+(i+1)+' из '+files.length+' — '+f.name;
  let item;
  try{const r=await fetch('/ocr',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':f.type},body:f,cache:'no-store'});let d;try{d=await r.json()}catch(e){d={error:'Сервер вернул HTTP '+r.status}}
  if(r.status===202&&d.key){el('out').textContent='Распознавание '+(i+1)+' из '+files.length+' — ожидаем результат';d=await waitJob(d.key);}
  item={...d,file:f.name,ok:r.ok&&d.status==='done',http_status:r.status};if(!r.ok&&!item.error)item.error='Ошибка HTTP '+r.status;
  }catch(e){item={file:f.name,ok:false,error:e.message||'Соединение прервано'};}
  result.documents.push(item);show(item);el('progress').value=i+1;
  if(!item.ok){el('out').textContent='Пакет остановлен на файле '+(i+1)+'. Скачайте отчёт; неотправленные файлы сохранены на телефоне.';return}
 }
 el('out').textContent='Обработано '+result.documents.length+' из '+files.length+'. Данные требуют сверки с оригиналами. Для контрольных фото числовая сверка выполняется автоматически.';
 }finally{running=false;health();el('photo').disabled=false;el('token').disabled=false;el('save').disabled=!result.documents.length;}
};
el('save').onclick=()=>{if(!result)return;const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.href=u;a.download='farukh-ocr-batch.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
</script></body></html>"""
class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(30)
    def respond(self,status,data,kind="application/json; charset=utf-8"):
        b=(json.dumps(data,ensure_ascii=False) if kind.startswith("application/json") else data).encode()
        self.send_response(status);self.send_header("Content-Type",kind);self.send_header("Cache-Control","no-store");self.send_header("X-Content-Type-Options","nosniff");self.send_header("Referrer-Policy","no-referrer");self.send_header("Content-Length",str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        if self.path=="/": self.respond(200,PAGE,"text/html; charset=utf-8")
        elif self.path=="/health": self.respond(200,{**state,"upload_enabled":public_test_open() or len(os.environ.get("OCR_TEST_TOKEN",""))>=24,"public_test":public_test_open(),"busy":lock.locked()})
        elif self.path=="/job":
            key=self.headers.get("X-Job-Key","")
            with job_lock:
                prune_jobs()
                job=jobs.get(key)
                data={k:v for k,v in job.items() if k!="finished"} if job else None
            self.respond(200,data) if data else self.respond(404,{"error":"Задача не найдена"})
        else: self.respond(404,{"error":"Not found"})
    def do_HEAD(self):
        self.send_response(200 if self.path in ("/","/health") else 404);self.end_headers()
    def do_POST(self):
        global public_remaining
        if self.path!="/ocr": return self.respond(404,{"error":"Not found"})
        token=os.environ.get("OCR_TEST_TOKEN","")
        authorized=len(token)>=24 and hmac.compare_digest(self.headers.get("Authorization","").encode(),("Bearer "+token).encode())
        if not authorized and not public_test_open(): return self.respond(401,{"error":"Тест без пароля завершён. Требуется пароль."})
        if state.get("status") not in ("passed","recognition mismatch") or state.get('full_page',{}).get('status')!='passed': return self.respond(503,{"error":"OCR ещё не готов"})
        try: n=int(self.headers.get("Content-Length","0"))
        except ValueError: return self.respond(400,{"error":"Некорректный размер"})
        if not 0<n<=MAX_BYTES: return self.respond(413,{"error":"Максимум 4 МБ"})
        if self.headers.get("Content-Type") not in ("image/jpeg","image/png"): return self.respond(415,{"error":"Только JPEG или PNG"})
        if not lock.acquire(blocking=False): return self.respond(429,{"error":"Сканер занят, повторите позже"})
        handed_off=False
        try:
            if not authorized:
                if not public_test_open(): return self.respond(401,{"error":"Лимит теста исчерпан"})
                public_remaining-=1
            payload=self.rfile.read(n)
            if len(payload)!=n: return self.respond(400,{"error":"Неполная загрузка"})
            key=secrets.token_urlsafe(32)
            with job_lock:
                prune_jobs()
                if len(jobs)>=20: return self.respond(429,{"error":"Слишком много результатов, повторите позже"})
                jobs[key]={"status":"processing"}
            threading.Thread(target=process_job,args=(key,payload),daemon=True).start()
            handed_off=True
            self.respond(202,{"status":"processing","key":key})
        except (BrokenPipeError,ConnectionResetError):
            print("OCR upload connection closed",flush=True)
        except Exception as e:
            print("OCR upload error",type(e).__name__,flush=True)
            self.respond(422,{"error":"Ошибка загрузки"})
        finally:
            if not handed_off: lock.release()
if __name__=="__main__":
    threading.Thread(target=test,daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0",int(os.environ.get("PORT","10000"))),Handler).serve_forever()
