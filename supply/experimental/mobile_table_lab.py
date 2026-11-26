"""Lightweight table recognizer experiment: only mobile text + table models.

No invoice data leaves the machine. Run on private local images, or fictional CI fixtures.
"""
import json, argparse, time
from pathlib import Path
import cv2
import numpy as np
from ppstructure_lab import normalize_photo

def model_result(model, img):
    r=next(iter(model.predict(input=img))).json
    return r.get("res",r)

def table_crop(img):
    # Detect the largest connected ruled grid, not a document-specific rectangle.
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    bw=cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,15)
    h,w=gray.shape
    horizontal=cv2.morphologyEx(bw,cv2.MORPH_OPEN,np.ones((1,max(20,w//24)),np.uint8))
    vertical=cv2.morphologyEx(bw,cv2.MORPH_OPEN,np.ones((max(20,h//30),1),np.uint8))
    grid=cv2.dilate(cv2.bitwise_or(horizontal,vertical),np.ones((7,7),np.uint8))
    contours,_=cv2.findContours(grid,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    candidates=[cv2.boundingRect(c) for c in contours]
    candidates=[(x,y,ww,hh) for x,y,ww,hh in candidates if ww>w*.45 and hh>h*.09]
    if not candidates: raise ValueError("No reliably located ruled table")
    x,y,ww,hh=max(candidates,key=lambda b:b[2]*b[3])
    return max(0,x-3),max(0,y-3),min(w,x+ww+3),min(h,y+hh+3)

def rect(poly):
    a=np.asarray(poly,dtype=float)
    if a.size==4:return tuple(a.flatten())
    a=a.reshape(-1,2)
    return (a[:,0].min(),a[:,1].min(),a[:,0].max(),a[:,1].max())

def fill_cells(structure, boxes, texts, polys, x,y):
    # Use model cell geometry and structure. Never infer prices or missing rows.
    rows=[]; row=None; index=0
    cell_ids=[]
    for token in structure:
        if token=="<tr>":row=[]
        elif token=="</tr>" and row is not None:rows.append(row);row=None
        elif token=="<td>" or token=="<td" or token.startswith("<td "):
            if row is None:raise ValueError("Invalid table row tokens")
            row.append(index);index+=1
    if index!=len(boxes):raise ValueError(f"Unmatched table cells: {index} vs {len(boxes)}")
    ranges=[rect(b) for b in boxes]; buckets=[[] for _ in boxes]
    for text,poly in zip(texts,polys):
        l,t,r,b=rect(poly); cx=(l+r)/2-x;cy=(t+b)/2-y
        matches=[i for i,(l2,t2,r2,b2) in enumerate(ranges) if l2<=cx<=r2 and t2<=cy<=b2]
        if len(matches)==1:buckets[matches[0]].append((cy,cx,text))
    values=[" ".join(v[2] for v in sorted(bucket)) for bucket in buckets]
    return [[values[i] for i in row] for row in rows]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("photos",nargs="+",type=Path);parser.add_argument("--out",required=True,type=Path)
    args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    from paddleocr import PaddleOCR, TableStructureRecognition
    ocr=PaddleOCR(device="cpu",enable_mkldnn=False,cpu_threads=4,
        use_doc_orientation_classify=False,use_doc_unwarping=False,use_textline_orientation=False,
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="cyrillic_PP-OCRv5_mobile_rec",
        text_det_limit_side_len=2560,text_det_limit_type="max")
    table=TableStructureRecognition(model_name="SLANet_plus",device="cpu",enable_mkldnn=False,cpu_threads=4)
    for i,p in enumerate(args.photos):
        start=time.monotonic(); img=cv2.imread(str(p))
        if img is None:raise ValueError("Invalid photo")
        img=normalize_photo(img)
        x,y,r,b=table_crop(img)
        result=model_result(ocr,img);struct=model_result(table,img[y:b,x:r])
        print("table keys",list(struct),flush=True)
        structure=struct.get("structure",[]);boxes=struct.get("bbox",struct.get("cell_bbox",[]))
        texts=result.get("rec_texts",[]);polys=result.get("rec_polys",[])
        rows=fill_cells(structure,boxes,texts,polys,x,y)
        report={"file":p.name,"seconds":round(time.monotonic()-start,2),"rows":rows,"text":texts,"table_area":[x,y,r,b]}
        (args.out/f"{i:03d}.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print(p.name,"rows",len(rows),"seconds",report["seconds"],flush=True)
if __name__=="__main__":main()
