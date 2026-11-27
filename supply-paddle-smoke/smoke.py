import json, os, threading, time, io, hmac, resource, warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
state={"status":"starting","test":"synthetic table only"}
lock=threading.Lock()
ocr=None
MAX_BYTES=4*1024*1024
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
def recognize(img):
    import cv2, re
    clean=clean_grid(img)
    rows=recognize_array(clean)
    h,w=clean.shape[:2]
    retries=0
    for row in rows:
        if row["confidence"] is None or row["confidence"]>=0.85 or not row["box"] or retries>=6: continue
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
    return rows
def test():
    global ocr
    start=time.monotonic()
    try:
        from PIL import Image, ImageDraw, ImageFont
        from paddleocr import PaddleOCR
        state["status"]="loading models"
        ocr=PaddleOCR(text_detection_model_name="PP-OCRv5_mobile_det",text_recognition_model_name="eslav_PP-OCRv5_mobile_rec",use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,device="cpu",enable_mkldnn=False,cpu_threads=1,text_det_limit_side_len=960,text_det_limit_type="max",text_recognition_batch_size=1)
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
            for row in rows:
                if not row["box"]: continue
                a,b,c,d=row["box"]
                if x1<=(a+c)/2<x2 and y1<=(b+d)/2<y2:
                    observed.append(row["text"])
                    candidates.extend(a["text"] for a in row.get("retry_candidates",[]))
            actual=" ".join(observed)
            ok=actual.casefold().replace(",",".").strip()==target.casefold()
            checks.append({"expected":target,"actual":actual,"pass":ok,"retry_candidates":candidates,"retry_match":any(a.casefold().strip()==target.casefold() for a in candidates)})
        missing=[x for x in checks if not x["pass"]]
        state.update(status="passed" if not missing else "recognition mismatch",checks=checks,matched=len(checks)-len(missing),total=len(checks),rows=rows,seconds=round(time.monotonic()-start,1),peak_rss_mb=rss(),cgroup=memory_cgroup())
        print("TABLE_SMOKE",json.dumps(state,ensure_ascii=False),flush=True)
    except Exception as e:
        ocr=None
        state.update(status="error",error=type(e).__name__,detail=str(e)[:300])
        print("TABLE_SMOKE",json.dumps(state),flush=True)
PAGE=r"""<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FARUKH SUPPLY • OCR тест</title><style>body{background:#10172b;color:#eef2ff;font:17px system-ui;margin:24px auto;padding:0 16px;max-width:650px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0;border-radius:10px}button{background:#7167e8;color:white;border:0;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1e2945;padding:16px;border-radius:10px}</style><h1>FARUKH SUPPLY</h1><p>Закрытый тест OCR. Не бухгалтерская система. Данные не сохраняются сервером.</p><input id="token" type="password" autocomplete="off" placeholder="Тестовый пароль"><input id="photo" type="file" accept="image/jpeg,image/png"><button id="send">Распознать фотографию</button><button id="save" disabled>Скачать результат JSON</button><pre id="out">Выберите фото. Максимум 4 МБ.</pre><script>let result=null;const el=id=>document.getElementById(id);el('send').onclick=async()=>{const f=el('photo').files[0];if(!f||!el('token').value){el('out').textContent='Нужны пароль и фото';return}if(f.size>4194304){el('out').textContent='Файл больше 4 МБ';return}el('send').disabled=true;el('save').disabled=true;result=null;el('out').textContent='Обработка…';try{const r=await fetch('/ocr',{method:'POST',headers:{Authorization:'Bearer '+el('token').value,'Content-Type':f.type},body:f,cache:'no-store'});const d=await r.json();el('out').textContent=r.ok?d.rows.map(x=>x.text+'  ['+x.confidence+']'+(x.needs_review?' — проверить':'')+(x.retry_candidates?.length?' | варианты: '+x.retry_candidates.map(a=>a.text).join(', '):'')).join('\n')+'\nВремя: '+d.seconds+' сек.':(d.error||'Ошибка');if(r.ok){result=d;el('save').disabled=false}}catch(e){el('out').textContent='Ошибка соединения. Повторите позже.'}finally{el('send').disabled=false}};el('save').onclick=()=>{if(!result)return;const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.href=u;a.download='ocr-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}</script></html>"""
class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(30)
    def respond(self,status,data,kind="application/json; charset=utf-8"):
        b=(json.dumps(data,ensure_ascii=False) if kind.startswith("application/json") else data).encode()
        self.send_response(status);self.send_header("Content-Type",kind);self.send_header("Cache-Control","no-store");self.send_header("X-Content-Type-Options","nosniff");self.send_header("Referrer-Policy","no-referrer");self.send_header("Content-Length",str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        if self.path=="/": self.respond(200,PAGE,"text/html; charset=utf-8")
        elif self.path=="/health": self.respond(200,{**state,"upload_enabled":len(os.environ.get("OCR_TEST_TOKEN",""))>=24})
        else: self.respond(404,{"error":"Not found"})
    def do_POST(self):
        if self.path!="/ocr": return self.respond(404,{"error":"Not found"})
        token=os.environ.get("OCR_TEST_TOKEN","")
        if len(token)<24: return self.respond(503,{"error":"Загрузка отключена до настройки пароля"})
        if not hmac.compare_digest(self.headers.get("Authorization","").encode(),("Bearer "+token).encode()): return self.respond(401,{"error":"Неверный пароль"})
        if state.get("status") not in ("passed","recognition mismatch"): return self.respond(503,{"error":"OCR ещё не готов"})
        try: n=int(self.headers.get("Content-Length","0"))
        except ValueError: return self.respond(400,{"error":"Некорректный размер"})
        if not 0<n<=MAX_BYTES: return self.respond(413,{"error":"Максимум 4 МБ"})
        if self.headers.get("Content-Type") not in ("image/jpeg","image/png"): return self.respond(415,{"error":"Только JPEG или PNG"})
        if not lock.acquire(blocking=False): return self.respond(429,{"error":"Сканер занят, повторите позже"})
        try:
            from PIL import Image, ImageOps
            start=time.monotonic()
            Image.MAX_IMAGE_PIXELS=12_000_000
            with warnings.catch_warnings():
                warnings.simplefilter("error",Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(self.rfile.read(n))) as source:
                    if source.format not in ("JPEG","PNG"): raise ValueError("format")
                    img=ImageOps.exif_transpose(source).convert("RGB")
            img.thumbnail((1800,1800))
            rows=recognize(img)
            self.respond(200,{"rows":rows,"width":img.width,"height":img.height,"seconds":round(time.monotonic()-start,1),"peak_rss_mb":rss(),"verified":False})
            print("OCR_REQUEST completed",flush=True)
        except Exception as e:
            print("OCR_REQUEST error",type(e).__name__,flush=True)
            self.respond(422,{"error":"Не удалось обработать фотографию"})
        finally: lock.release()
if __name__=="__main__":
    threading.Thread(target=test,daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0",int(os.environ.get("PORT","10000"))),Handler).serve_forever()
