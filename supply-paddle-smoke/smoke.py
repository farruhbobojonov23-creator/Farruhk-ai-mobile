import json, os, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
state={"status":"starting","test":"synthetic only"}
def test():
    start=time.monotonic()
    try:
        import numpy as np
        from PIL import Image, ImageDraw, ImageFont
        from paddleocr import PaddleOCR
        state["status"]="loading models"
        ocr=PaddleOCR(text_detection_model_name="PP-OCRv5_mobile_det",text_recognition_model_name="eslav_PP-OCRv5_mobile_rec",use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,device="cpu",enable_mkldnn=False,cpu_threads=1)
        state["status"]="recognizing"
        img=Image.new("RGB",(720,180),"white")
        draw=ImageDraw.Draw(img)
        font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",34)
        draw.text((20,20),"Тестовая накладная 123",font=font,fill="black")
        draw.text((20,90),"Рис 5 кг  1250.00",font=font,fill="black")
        texts=[]
        for result in ocr.predict(np.array(img)):
            data=result.json
            texts.extend(data.get("res",data).get("rec_texts",[]))
        joined=" ".join(texts).lower()
        state.update(status="passed" if all(x in joined for x in ("123","рис","1250")) else "recognition mismatch",texts=texts,seconds=round(time.monotonic()-start,1))
        print("SMOKE",json.dumps(state,ensure_ascii=False),flush=True)
    except Exception as e:
        state.update(status="error",error=type(e).__name__,detail=str(e)[:300])
        print("SMOKE",json.dumps(state),flush=True)
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        b=json.dumps(state,ensure_ascii=False).encode()
        self.send_response(200);self.send_header("Content-Type","application/json; charset=utf-8");self.end_headers();self.wfile.write(b)
    def do_POST(self):
        self.send_error(405)
if __name__=="__main__":
    threading.Thread(target=test,daemon=True).start()
    HTTPServer(("0.0.0.0",int(os.environ.get("PORT","10000"))),Handler).serve_forever()
