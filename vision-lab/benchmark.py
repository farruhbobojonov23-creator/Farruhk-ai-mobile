"""Offline-weight model comparison. Synthetic documents only; no customer data in GitHub."""
import argparse, json, os, re, time, unicodedata
from pathlib import Path
from decimal import Decimal
from PIL import Image, ImageDraw, ImageFont
import torch
from transformers import AutoProcessor, AutoModelForImageTextToText
from bs4 import BeautifulSoup

MODELS={"paddle":"PaddlePaddle/PaddleOCR-VL-1.6","qwen":"Qwen/Qwen3-VL-2B-Instruct"}
CASES=[
 {"name":"Сыр творожный","pack":"10 кг","unit":"шт","code":"796","vat":"22.00","total":"12,600.00","quantity":"3","gross":"31.2"},
 {"name":"Форель радужная филе Trim C","pack":"1,8 кг+","unit":"кг","code":"166","vat":"10.00","total":"85,680.00","quantity":"47.6","gross":"51.2"},
 {"name":"Майонез для запекания","pack":"9,4 кг/10 л","unit":"шт","code":"796","vat":"22.00","total":"5,580.00","quantity":"3","gross":"29.4"},
]
def fixture(case,out,angled=False):
    img=Image.new("RGB",(1560,640),"white"); d=ImageDraw.Draw(img)
    font="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    title=ImageFont.truetype(font,34); body=ImageFont.truetype(font,26)
    d.text((50,35),"ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ",font=title,fill="black")
    d.text((50,90),"Поставщик: Учебный поставщик",font=body,fill="black")
    xs=[40,500,635,750,870,1110,1320,1520]; ys=[160,275,415,470]
    for y in ys:d.line((xs[0],y,xs[-1],y),fill="black",width=2)
    for x in xs:d.line((x,ys[0],x,ys[-1]),fill="black",width=2)
    headers=["Наименование\nтовара","Ед.\nизм.","Код\nОКЕИ","Ставка\nНДС","Сумма с НДС,\nруб.","Количество\nмест","Масса\nбрутто"]
    for x,h in zip(xs,headers):d.multiline_text((x+9,ys[0]+12),h,font=body,fill="black",spacing=5)
    name=case["name"]
    if len(name)>25:name=name.replace(" филе","\nфиле")
    row=[name+"\n"+case["pack"],case["unit"],case["code"],case["vat"],case["total"],case["quantity"],case["gross"]]
    for x,val in zip(xs,row):d.multiline_text((x+9,ys[1]+15),val,font=body,fill="black",spacing=5)
    d.text((45,430),"Всего к оплате",font=body,fill="black");d.text((xs[4]+9,430),case["total"],font=body,fill="black")
    if angled:
        img=img.rotate(3, resample=Image.Resampling.BICUBIC,expand=True,fillcolor=(44,43,44))
        from PIL import ImageEnhance
        img=ImageEnhance.Contrast(img).enhance(.78)
    img.save(out)
    return img
def canon(s):
    return re.sub(r"[\s.,]", "",unicodedata.normalize("NFKC",str(s)).casefold())
def dec(s):
    s=str(s).replace(" ","").replace("\u00a0","").replace("₽","")
    if "," in s and "." in s:
        if s.rfind(".")>s.rfind(","):s=s.replace(",","")
        else:s=s.replace(".","").replace(",",".")
    else:s=s.replace(",",".")
    try:return Decimal(s)
    except:return None
def evaluate(raw,case,kind):
    # A field counts only if it appears in the corresponding column of the same item.
    rows=[]
    if kind=="qwen":
        try:
            x=json.loads(re.sub(r"^.*?(\{)",r"\1",raw,flags=re.S).rsplit("}",1)[0]+"}")
            rows=x.get("items",[]) if isinstance(x,dict) else []
        except Exception:pass
    else:
        soup=BeautifulSoup(raw,"html.parser")
        for tr in soup.find_all("tr"):
            cells=[c.get_text(" ",strip=True) for c in tr.find_all(["td","th"],recursive=False)]
            if len(cells)==7:
                rows.append(dict(zip(["name","unit","code","vat","total","quantity","gross"],cells)))
    scored=[]
    for row in rows:
        if not isinstance(row,dict):continue
        scores={
            "name":canon(case["name"]) in canon(row.get("name","")),
            "pack":canon(case["pack"]) in canon(str(row.get("name",""))+" "+str(row.get("pack",""))),
            "unit":canon(row.get("unit",""))==canon(case["unit"]),
            "quantity":dec(row.get("quantity",""))==dec(case["quantity"]),
            "total":dec(row.get("total",""))==dec(case["total"]),
            "gross":dec(row.get("gross",""))==dec(case["gross"]),
        }
        scored.append(scores)
    scores=max(scored,key=lambda x:sum(x.values())) if scored else dict.fromkeys(["name","pack","unit","quantity","total","gross"],False)
    return {"fields":scores,"score":sum(scores.values()),"max":6}
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--model",required=True,choices=MODELS)
    parser.add_argument("--out",default="vision-results")
    args=parser.parse_args(); out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    device="cuda" if torch.cuda.is_available() else "cpu"
    torch.set_num_threads(min(4,os.cpu_count() or 1))
    mid=MODELS[args.model]; processor=AutoProcessor.from_pretrained(mid)
    model=AutoModelForImageTextToText.from_pretrained(mid,torch_dtype=torch.bfloat16,low_cpu_mem_usage=True).to(device).eval()
    report=[]
    for i,case in enumerate(CASES):
        img=fixture(case,out/f"fixture-{i}.png",angled=i>0)
        if args.model=="paddle":
            img=img.crop((0,125,img.width,min(img.height,550 if i==0 else 620)))
            prompt="Table Recognition:"
        else:
            prompt='Прочитай товарные строки документа. Верни JSON {"items":[{"name":"название с фасовкой","pack":"фасовка","unit":"единица","quantity":"количество мест","total":"сумма с НДС","gross":"масса брутто"}]}. Переписывай только видимые данные, ничего не вычисляй и не придумывай.'
        messages=[{"role":"user","content":[{"type":"image","image":img},{"type":"text","text":prompt}]}]
        inputs=processor.apply_chat_template(messages,add_generation_prompt=True,tokenize=True,return_dict=True,return_tensors="pt").to(device)
        start=time.monotonic()
        with torch.inference_mode(): output=model.generate(**inputs,max_new_tokens=512,do_sample=False)
        raw=processor.decode(output[0][inputs["input_ids"].shape[-1]:],skip_special_tokens=True)
        result=evaluate(raw,case,args.model)
        report.append({"case":i,"seconds":round(time.monotonic()-start,1),"raw":raw,**result})
        (out/"report.json").write_text(json.dumps({"model":mid,"device":device,"synthetic":True,"cases":report},ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps(report[-1],ensure_ascii=False),flush=True)
    print("FIELD ACCURACY",sum(x["score"] for x in report),"/",sum(x["max"] for x in report))
if __name__=="__main__":main()
