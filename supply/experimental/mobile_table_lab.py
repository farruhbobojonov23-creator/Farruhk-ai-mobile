"""Mobile-model feasibility: OCR polygons + compact SLANet-plus, no heavy layout or cell detection."""
import json, sys, time
from pathlib import Path
import cv2
import numpy as np
from paddleocr import PaddleOCR
from rapid_table import RapidTable, RapidTableInput, ModelType
from ppstructure_lab import normalize_photo, Cells

root=Path(sys.argv[1])
ocr=PaddleOCR(device="cpu",enable_mkldnn=False,cpu_threads=4,
    use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="cyrillic_PP-OCRv5_mobile_rec")
table=RapidTable(RapidTableInput(model_type=ModelType.SLANETPLUS))
def recognize(img):
    start=time.monotonic()
    # Find the ruled table without the large layout network.
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    ink=cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,12)
    h,w=gray.shape
    horizontal=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((1,max(20,w//35)),np.uint8))
    vertical=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((max(20,h//35),1),np.uint8))
    mask=cv2.dilate(horizontal|vertical,np.ones((7,7),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    candidates=[cv2.boundingRect(c) for c in contours]
    candidates=[(x,y,bw,bh) for x,y,bw,bh in candidates if bw>w*.4 and bh>h*.18]
    if not candidates: return {"rows":[],"error":"no ruled table","seconds":time.monotonic()-start}
    x,y,bw,bh=max(candidates,key=lambda b:b[2]*b[3])
    crop=img[max(0,y-3):y+bh+3,max(0,x-3):x+bw+3]
    pred=list(ocr.predict(crop))[0].json
    d=pred.get("res",pred)
    boxes=np.asarray(d["rec_polys"],dtype=np.float32)
    texts=d["rec_texts"]
    scores=d["rec_scores"]
    result=table(crop,ocr_results=[(boxes,texts,scores)])
    html=result.pred_htmls[0]
    c=Cells();c.feed(html)
    return {"rows":c.rows,"html":html,"seconds":round(time.monotonic()-start,2)}
def score(rows,expected):
    norm=lambda x:"".join(str(x).lower().split()).replace(".",",")
    matched=0
    for e in expected[1:-1]:
        rs=[r for r in rows if len(r)==len(e) and norm(r[0])==norm(e[0])]
        if len(rs)==1 and all(norm(rs[0][i])==norm(e[i]) for i in [1,2,3,4,5]): matched+=1
    return matched
expected=json.loads((root/"expected.json").read_text())
out={}
for filename in ["clean.png","photo.jpg"]:
    img=cv2.imread(str(root/filename))
    for variant,im in [("raw",img),("normalized",normalize_photo(img))]:
        r=recognize(im)
        r["exact_rows"]=score(r["rows"],expected)
        out[filename+"_"+variant]=r
        print(filename,variant,r["exact_rows"],"/",len(expected)-2,r["seconds"],"s",flush=True)
(root/"mobile-results.json").write_text(json.dumps(out,ensure_ascii=False,indent=2))
assert out["photo.jpg_normalized"]["exact_rows"]==len(expected)-2,"Mobile models have not matched the full CPU model on the same simulated photo"
