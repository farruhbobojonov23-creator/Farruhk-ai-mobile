"""Local-only invoice recognition experiment. No network inference, no upload of documents."""
import argparse, json, time, os
from pathlib import Path
from html.parser import HTMLParser
import cv2
import numpy as np

class Cells(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows=[]; self.row=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=="tr": self.row=[]
        if tag in ("td","th") and self.row is not None: self.cell=[]
        if tag=="br" and self.cell is not None: self.cell.append(" ")
    def handle_data(self,data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ("td","th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split())); self.cell=None
        if tag=="tr" and self.row is not None:
            self.rows.append(self.row); self.row=None

def normalize_photo(img):
    # Correct shadows while preserving the original pixels and fine printed rules.
    channels=cv2.split(img)
    result=[]
    for ch in channels:
        kernel=max(21,(min(ch.shape)//45)|1)
        bg=cv2.morphologyEx(ch,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_RECT,(kernel,kernel)))
        bg=cv2.GaussianBlur(bg,(0,0),kernel/3)
        result.append(cv2.divide(ch,np.maximum(bg,1),scale=245))
    return cv2.merge(result)

def engine():
    from paddleocr import PPStructureV3
    return PPStructureV3(
        device="cpu", use_doc_orientation_classify=True,
        use_doc_unwarping=False, use_textline_orientation=True,
        text_detection_model_name="PP-OCRv5_server_det",
        text_recognition_model_name="cyrillic_PP-OCRv5_mobile_rec",
        use_seal_recognition=False,use_formula_recognition=False,
        use_chart_recognition=False,use_region_detection=False,
        use_table_recognition=True,
    )

def recognize(model,img):
    start=time.monotonic()
    pages=[]
    for p in model.predict(input=img):
        d=p.json.get("res",p.json)
        tables=[]
        for t in d.get("table_res_list",[]):
            c=Cells(); c.feed(t.get("pred_html",""))
            tables.append({"rows":c.rows,"cell_boxes":t.get("cell_box_list",[]),"html":t.get("pred_html","")})
        o=d.get("overall_ocr_res",{})
        pages.append({"tables":tables,"texts":o.get("rec_texts",[]),"scores":o.get("rec_scores",[]),"boxes":o.get("rec_polys",[])})
    return {"seconds":round(time.monotonic()-start,2),"pages":pages}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("photos",nargs="+",type=Path)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    model=engine()
    for i,p in enumerate(args.photos):
        img=cv2.imread(str(p))
        if img is None: raise ValueError(f"Cannot read {p}")
        result={"file":p.name,"original":recognize(model,img),"normalized":recognize(model,normalize_photo(img))}
        (args.out/f"{i:03d}.json").write_text(json.dumps(result,ensure_ascii=False,indent=2,default=lambda a:a.tolist() if hasattr(a,"tolist") else str(a)),encoding="utf-8")
        print(f"{p.name}: {result['original']['seconds']}s / {result['normalized']['seconds']}s",flush=True)
if __name__=="__main__":main()
