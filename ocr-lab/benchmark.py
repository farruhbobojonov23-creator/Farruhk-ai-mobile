"""Local CPU experiment. Synthetic documents only in public CI."""
import argparse, json, time, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from html.parser import HTMLParser
from review import review_table

class Cells(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows=[]; self.row=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=="tr": self.row=[]
        if tag in ("td","th"): self.cell=[]
    def handle_data(self,data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ("td","th") and self.cell is not None:
            if self.row is not None: self.row.append(" ".join("".join(self.cell).split()))
            self.cell=None
        if tag=="tr" and self.row is not None:
            self.rows.append(self.row); self.row=None

def fixture(path):
    im=Image.new("RGB",(1600,750),"white")
    draw=ImageDraw.Draw(im)
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",29)
    draw.text((65,45),"Учебная накладная № 1234 от 17.11.2026",fill="black",font=font)
    draw.text((65,95),"Поставщик: ООО Тест",fill="black",font=font)
    rows=[["Товар","Ед.","Кол-во","Цена","Сумма"],
          ["Рис для суши","кг","25,000","100,00","2500,00"],
          ["Сыр творожный","кг","4,900","600,00","2940,00"],
          ["Соус рисовый","шт","2,000","300,00","600,00"]]
    xs=[65,660,800,1020,1250,1535]; y=180; h=85
    for i,row in enumerate(rows):
        for j,s in enumerate(row):
            draw.text((xs[j]+12,y+i*h+22),s,font=font,fill="black")
    for x in xs: draw.line((x,y,x,y+h*len(rows)),fill="black",width=2)
    for i in range(len(rows)+1): draw.line((xs[0],y+i*h,xs[-1],y+i*h),fill="black",width=2)
    draw.text((1000,550),"Всего: 6040,00",font=font,fill="black")
    im.save(path)
    return rows[1:]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",help="Optional local private document; never commit invoices")
    ap.add_argument("--out",default="ocr-result")
    args=ap.parse_args()
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    expected=None
    if args.input: source=Path(args.input)
    else:
        source=out/"synthetic-invoice.png"; expected=fixture(source)
    from paddleocr import PPStructureV3
    start=time.monotonic()
    pipe=PPStructureV3(device="cpu", text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="cyrillic_PP-OCRv5_mobile_rec",
        use_doc_orientation_classify=False,use_doc_unwarping=False,
        use_textline_orientation=False,use_formula_recognition=False,
        use_seal_recognition=False,use_chart_recognition=False,use_table_recognition=True)
    initialization=time.monotonic()-start
    start=time.monotonic(); tables=[]
    for result in pipe.predict(input=str(source)):
        result.save_to_json(save_path=str(out))
        obj=result.json
        if callable(obj): obj=obj()
        if isinstance(obj,str): obj=json.loads(obj)
        obj=obj.get("res",obj)
        for table in obj.get("table_res_list",[]):
            html=table.get("pred_html","")
            parser=Cells(); parser.feed(html); tables.append(parser.rows)
    actual=[row for table in tables for row in table]
    normalize=lambda s: re.sub(r"\s+","",s).lower()
    matches=0
    if expected:
        for exp in expected:
            if any([normalize(x) for x in row]==[normalize(x) for x in exp] for row in actual): matches+=1
    reviewed=[row for table in tables for row in review_table(table)]
    numeric_matches=0
    if expected:
        for exp in expected:
            if any(len(row)==5 and [normalize(row[i]) for i in (0,2,3,4)]==[normalize(exp[i]) for i in (0,2,3,4)] for row in actual):
                numeric_matches+=1
    report={"reviewed_rows":reviewed,"name_and_numeric_matches":numeric_matches if expected else None,"engine":"PP-StructureV3 / Cyrillic PP-OCRv5","initialization_s":round(initialization,2),
            "inference_s":round(time.monotonic()-start,2),"tables":tables,
            "exact_rows":matches if expected else None,"expected_rows":len(expected) if expected else None,
            "scope":"CPU experiment, not Android validation"}
    (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if expected and matches!=len(expected): raise SystemExit("Synthetic table accuracy gate not passed")
if __name__=="__main__": main()
