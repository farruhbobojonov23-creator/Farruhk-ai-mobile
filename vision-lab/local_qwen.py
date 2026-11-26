"""Private local invoice vision test. Input photos never enter Git or a cloud API."""
import argparse, base64, json, re, urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

MODEL="qwen3-vl:2b-instruct"
FIELDS=["name","unit","quantity","packKg","lineTotal","unitPrice","vatBasis"]
ITEM={"type":"object","required":FIELDS,"additionalProperties":False,"properties":{
    "name":{"type":"string"},"unit":{"enum":["кг","г","шт","уп","кор","л","мл",None]},
    **{k:{"type":["string","null"]} for k in ["quantity","packKg","lineTotal","unitPrice"]},
    "vatBasis":{"enum":["included","excluded","unknown"]}}}
SCHEMA={"type":"object","required":["supplier","documentTotal","items"],"additionalProperties":False,"properties":{
    "supplier":{"type":["string","null"]},"documentTotal":{"type":["string","null"]},
    "items":{"type":"array","items":ITEM}}}
PROMPT="""Перепиши все товарные строки, не подписи и не итоги, из фото накладной.
supplier — поставщик, не покупатель. unit — единица отгрузки в строке; quantity — количество в этой единице.
packKg — вес нетто одной упаковки, только если явно напечатан в наименовании и единица шт/уп/кор; не масса брутто.
lineTotal — напечатанная сумма строки, unitPrice — напечатанная цена за единицу или null, если колонки нет.
vatBasis — относится к lineTotal: included (с НДС), excluded (без НДС), unknown (неясно).
documentTotal — напечатанный итог документа, только если относится к той же сумме, что и строки.
Не вычисляй числа и не придумывай данные. Не округляй вес. Сохраняй все цифры. Неизвестные поля null.
Если документ ТТН с колонками сумма с НДС, количество мест и масса брутто, не перепутай количество и брутто.
Ответ только JSON по схеме."""
def dec(x):
    if x is None or isinstance(x,bool): return None
    s=str(x).strip().replace(" ","").replace("\u00a0","").replace("\u202f","")
    if "," in s and "." in s:
        s=s.replace(",","") if s.rfind(".")>s.rfind(",") else s.replace(".","").replace(",",".")
    else:s=s.replace(",",".")
    if not re.fullmatch(r"\d+(?:\.\d+)?",s):return None
    try:
        n=Decimal(s)
        return n if n.is_finite() and n>0 else None
    except InvalidOperation:return None
def rub(x):return x.quantize(Decimal(".01"),rounding=ROUND_HALF_UP)
def encode(x):return format(x,"f") if x is not None else None
def normalize(data):
    if not isinstance(data,dict) or not isinstance(data.get("items"),list):raise ValueError("Invalid model response")
    supplier=data.get("supplier"); rows=[]; warnings=[]
    for i,item in enumerate(data["items"],1):
        if not isinstance(item,dict):raise ValueError("Invalid row")
        name=str(item.get("name") or "").strip()
        unit=item.get("unit");q=dec(item.get("quantity"));pack=dec(item.get("packKg"));total=dec(item.get("lineTotal"));p=dec(item.get("unitPrice"))
        basis=item.get("vatBasis") if item.get("vatBasis") in ("included","excluded") else "unknown"
        if unit not in ("кг","г","шт","уп","кор","л","мл"):unit=None
        if unit not in ("шт","уп","кор"):pack=None
        if pack and not re.search(r"\d+(?:[.,]\d+)?\s*(?:кг|г)(?![а-яё])",name,re.I):
            warnings.append(f"Строка {i}: фасовка не подтверждена названием");pack=None
        # Never use a printed price that disagrees with the line total (tax bases may differ).
        if q and total and p and abs(q*p-total)>max(Decimal(".02"),q*Decimal(".005")):
            warnings.append(f"Строка {i}: цена и сумма не совпадают; цена из суммы требует проверки")
            p=None
        derived=False
        if total and q and unit and basis!="unknown" and p is None:
            p=total/q;derived=True
        kg_per=Decimal(1) if unit=="кг" else Decimal(".001") if unit=="г" else pack
        kg=q*kg_per if q and kg_per else None
        pricekg=rub(p/kg_per) if p and kg_per else None
        if not name or not q or not unit or not p: warnings.append(f"Строка {i}: неполные поля")
        rows.append({"name":name,"unit":unit,"quantity":encode(q),"packKg":encode(pack),"price":encode(rub(p) if p else None),"totalKg":encode(kg),"pricePerKg":encode(pricekg),"invoiceTotal":encode(total),"vatBasis":basis,"priceDerived":derived,"uncertain":True})
    expected=dec(data.get("documentTotal"))
    sums=[dec(r["invoiceTotal"]) for r in rows]
    if expected is not None and rows and all(s is not None for s in sums):
        if abs(sum(sums)-expected)>Decimal(".02"):warnings.append("Сумма строк не совпадает с итогом: возможны пропуски")
    else:warnings.append("Итог документа не подтверждён")
    if not supplier or not rows:warnings.append("Поставщик или строки не распознаны")
    return {"supplier":supplier,"items":rows,"warnings":warnings,"requiresReview":True}
def request_photo(path):
    photo=Path(path).read_bytes()
    if len(photo)>20*1024*1024:raise ValueError("Photo too large")
    payload={"model":MODEL,"stream":False,"format":SCHEMA,"options":{"temperature":0,"num_ctx":8192},"messages":[{"role":"user","content":PROMPT,"images":[base64.b64encode(photo).decode()]}]}
    req=urllib.request.Request("http://127.0.0.1:11434/api/chat",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=300) as res:raw=json.load(res)
    return normalize(json.loads(raw["message"]["content"]))
def self_test():
    def row(**kw):
        d=dict(name="Сыр 10 кг",unit="шт",quantity="3",packKg="10",lineTotal="13 500,00",unitPrice=None,vatBasis="included");d.update(kw);return d
    a=normalize(dict(supplier="Тест",documentTotal="13500,00",items=[row()]))
    assert a["items"][0]["totalKg"]=="30" and a["items"][0]["pricePerKg"]=="450.00" and not a["warnings"]
    b=normalize(dict(supplier="Тест",documentTotal="284,659.97",items=[row(name="Форель 1,8 кг+",unit="кг",quantity="149.81",packKg="1.8",lineTotal="284,659.97")]))
    assert b["items"][0]["totalKg"]=="149.81" and b["items"][0]["price"]=="1900.14" and b["items"][0]["packKg"] is None
    c=normalize(dict(supplier="Тест",documentTotal="999",items=[row(name="Нори",packKg="10",vatBasis="unknown")]))
    assert c["items"][0]["packKg"] is None and c["items"][0]["price"] is None and c["warnings"]
    print("PASS: 3 validation scenarios")
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("photos",nargs="*");p.add_argument("--self-test",action="store_true");args=p.parse_args()
    if args.self_test:self_test()
    for photo in args.photos:print(json.dumps({"file":Path(photo).name,**request_photo(photo)},ensure_ascii=False,indent=2))
