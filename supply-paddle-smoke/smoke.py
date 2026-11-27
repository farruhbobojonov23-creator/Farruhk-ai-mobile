import json, os, threading, time, io, hmac, resource, warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
state={"status":"starting","test":"synthetic table only"}
lock=threading.Lock()
ocr=None
MAX_BYTES=4*1024*1024
def rss():
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,1)
def recognize(img):
    import numpy as np
    rows=[]
    for result in ocr.predict(np.array(img)):
        d=result.json
        d=d.get("res",d)
        texts=d.get("rec_texts",[])
        scores=d.get("rec_scores",[])
        boxes=d.get("rec_boxes",[])
        for i,t in enumerate(texts):
            rows.append({"text":str(t),"confidence":round(float(scores[i]),4) if i<len(scores) else None,"box":[int(x) for x in boxes[i]] if i<len(boxes) else None})
    return rows
def test():
    global ocr
    start=time.monotonic()
    try:
        from PIL import Image, ImageDraw, ImageFont
        from paddleocr import PaddleOCR
        state["status"]="loading models"
        ocr=PaddleOCR(text_detection_model_name="PP-OCRv5_mobile_det",text_recognition_model_name="eslav_PP-OCRv5_mobile_rec",use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,device="cpu",enable_mkldnn=False,cpu_threads=1,text_det_limit_side_len=1600,text_det_limit_type="max",text_recognition_batch_size=1)
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
        joined=" ".join(r["text"] for r in rows).lower().replace(",",".")
        expected=("123","рис","васаби","1250","260","1510","6.50")
        missing=[x for x in expected if x not in joined]
        state.update(status="passed" if not missing else "recognition mismatch",missing=missing,rows=rows,seconds=round(time.monotonic()-start,1),peak_rss_mb=rss())
        print("TABLE_SMOKE",json.dumps(state,ensure_ascii=False),flush=True)
    except Exception as e:
        ocr=None
        state.update(status="error",error=type(e).__name__,detail=str(e)[:300])
        print("TABLE_SMOKE",json.dumps(state),flush=True)
PAGE=r"""<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FARUKH SUPPLY • OCR тест</title><style>body{background:#10172b;color:#eef2ff;font:17px system-ui;margin:24px auto;padding:0 16px;max-width:650px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0;border-radius:10px}button{background:#7167e8;color:white;border:0;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1e2945;padding:16px;border-radius:10px}</style><h1>FARUKH SUPPLY</h1><p>Закрытый тест OCR. Не бухгалтерская система. Данные не сохраняются сервером.</p><input id="token" type="password" autocomplete="off" placeholder="Тестовый пароль"><input id="photo" type="file" accept="image/jpeg,image/png"><button id="send">Распознать фотографию</button><button id="save" disabled>Скачать результат JSON</button><pre id="out">Выберите фото. Максимум 4 МБ.</pre><script>let result=null;const el=id=>document.getElementById(id);el('send').onclick=async()=>{const f=el('photo').files[0];if(!f||!el('token').value){el('out').textContent='Нужны пароль и фото';return}if(f.size>4194304){el('out').textContent='Файл больше 4 МБ';return}el('send').disabled=true;el('save').disabled=true;result=null;el('out').textContent='Обработка…';try{const r=await fetch('/ocr',{method:'POST',headers:{Authorization:'Bearer '+el('token').value,'Content-Type':f.type},body:f,cache:'no-store'});const d=await r.json();el('out').textContent=r.ok?d.rows.map(x=>x.text+'  ['+x.confidence+']').join('\n')+'\nВремя: '+d.seconds+' сек.':(d.error||'Ошибка');if(r.ok){result=d;el('save').disabled=false}}catch(e){el('out').textContent='Ошибка соединения. Повторите позже.'}finally{el('send').disabled=false}};el('save').onclick=()=>{if(!result)return;const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.href=u;a.download='ocr-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}</script></html>"""
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
            img.thumbnail((2200,2200))
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
