"""Private single-user OCR service. Run behind HTTPS with a trusted certificate."""
import hmac, os, threading, tempfile, json
from pathlib import Path
from html.parser import HTMLParser
from flask import Flask, request, jsonify
from werkzeug.exceptions import RequestEntityTooLarge
os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK','True')
os.environ.setdefault('OMP_NUM_THREADS','4')

class Cells(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.spans={}; self.row=None; self.cell=None; self.col=0
    def handle_starttag(self, tag, attrs):
        if tag=='tr':
            self.row=[]; self.col=0
        elif tag in ('td','th') and self.row is not None:
            self.cell=[]; a=dict(attrs)
            try:
                self.rs=min(100,max(1,int(a.get('rowspan','1'))))
                self.cs=min(100,max(1,int(a.get('colspan','1'))))
            except ValueError:
                self.rs=self.cs=1
    def handle_data(self, data):
        if self.cell is not None:self.cell.append(data)
    def fill_spans(self):
        while self.col in self.spans:
            value, left=self.spans[self.col];self.row.append(value)
            if left==1:del self.spans[self.col]
            else:self.spans[self.col]=(value,left-1)
            self.col+=1
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None:
            self.fill_spans()
            value=' '.join(' '.join(self.cell).split())
            for i in range(self.cs):
                self.fill_spans()
                v=value if i==0 else ''
                self.row.append(v)
                if self.rs>1:self.spans[self.col]=(v,self.rs-1)
                self.col+=1
            self.cell=None
        elif tag=='tr' and self.row is not None:
            self.fill_spans();self.rows.append(self.row);self.row=None

def make_engine():
    from paddleocr import PPStructureV3
    return PPStructureV3(device='cpu',enable_mkldnn=False,cpu_threads=4,text_detection_model_name='PP-OCRv5_mobile_det',text_recognition_model_name='cyrillic_PP-OCRv5_mobile_rec',use_doc_orientation_classify=True,use_doc_unwarping=False,use_textline_orientation=True,use_formula_recognition=False,use_chart_recognition=False,use_seal_recognition=False,use_table_recognition=True)

def create_app(engine_factory=make_engine,token=None,origin=None):
    token=token or os.environ.get('SUPPLY_OCR_TOKEN','')
    if len(token)<32:raise RuntimeError('Set a random SUPPLY_OCR_TOKEN (32+ characters)')
    origin=origin or 'https://appassets.androidplatform.net'
    app=Flask(__name__);app.config['MAX_CONTENT_LENGTH']=16*1024*1024
    lock=threading.Lock();engine=None
    @app.after_request
    def cors(response):
        if request.headers.get('Origin')==origin:
            response.headers['Access-Control-Allow-Origin']=origin
            response.headers['Access-Control-Allow-Headers']='Authorization, Content-Type'
            response.headers['Access-Control-Allow-Methods']='POST, OPTIONS'
            response.headers['Vary']='Origin'
        response.headers['Cache-Control']='no-store'
        return response
    @app.errorhandler(RequestEntityTooLarge)
    def large(e):return jsonify(error='Photo too large'),413
    @app.route('/v1/ocr',methods=['POST','OPTIONS'])
    def ocr():
        nonlocal engine
        if request.headers.get('Origin') not in (None,origin):return jsonify(error='Origin denied'),403
        if request.method=='OPTIONS':return '',204
        if not hmac.compare_digest(request.headers.get('Authorization',''), 'Bearer '+token):return jsonify(error='Unauthorized'),401
        image=request.files.get('image')
        if not image:return jsonify(error='Image required'),400
        from PIL import Image
        if not lock.acquire(blocking=False):return jsonify(error='OCR busy'),429
        try:
            with tempfile.TemporaryDirectory() as tmp:
                path=Path(tmp)/'image.png'
                try:
                    im=Image.open(image.stream)
                    if im.format not in ('JPEG','PNG','WEBP') or im.width*im.height>25000000:raise ValueError()
                    from PIL import ImageOps
                    ImageOps.exif_transpose(im).convert('RGB').save(path)
                except Exception:return jsonify(error='Unsupported image'),400
                if engine is None:engine=engine_factory()
                report=[]
                for i,r in enumerate(engine.predict(input=str(path),use_chart_recognition=False),1):
                    raw=r.json
                    if callable(raw):raw=raw()
                    if isinstance(raw,str):raw=json.loads(raw)
                    raw=raw.get('res',raw)
                    tables=[]
                    for t in raw.get('table_res_list',[]):
                        parser=Cells();parser.feed(t.get('pred_html',''))
                        if parser.rows:tables.append(parser.rows)
                    report.append({'file':'invoice.png','page':i,'text':raw.get('overall_ocr_res',{}).get('rec_texts',[]),'tables':tables})
                return jsonify(report)
        except Exception:
            return jsonify(error='OCR failed'),500
        finally:lock.release()
    return app

if __name__=='__main__':
    create_app().run(host='127.0.0.1',port=8787,debug=False)
