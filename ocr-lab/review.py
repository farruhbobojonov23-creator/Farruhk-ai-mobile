"""Conservative extraction of a recognized five-column invoice table."""
from decimal import Decimal, InvalidOperation
import re

UNITS={"кг","г","л","мл","шт","уп","кор"}
# These are review hints only; an OCR substitution never confirms a unit.
UNIT_HINTS={"kf":"кг","kr":"кг","kг":"кг","kг.":"кг"}
def decimal(value):
    s=re.sub(r"\s+","",str(value)).replace(",",".")
    if not re.fullmatch(r"\d+(?:\.\d+)?",s): return None
    try:
        d=Decimal(s)
        return d if d>0 else None
    except InvalidOperation:
        return None

def review_table(rows):
    output=[]
    for row in rows:
        if len(row)!=5: continue
        name,raw,q,p,t=row
        if not name.strip() or name.strip().lower() in {"товар","наименование","итого","всего"}: continue
        qty,price,total=map(decimal,(q,p,t))
        if None in (qty,price,total): continue
        arithmetic_ok=abs(qty*price-total)<=Decimal("0.02")
        u=raw.strip().lower().rstrip(".")
        unit=u if u in UNITS else None
        hint=None if unit else UNIT_HINTS.get(u)
        output.append({"product":name,"quantity":str(qty),"unit":unit,"raw_unit":raw,
            "unit_hint":hint,"price":str(price),"total":str(total),
            "arithmetic_ok":arithmetic_ok,"requires_review":True,
            "issues":(["unknown_unit"] if unit is None else [])+([] if arithmetic_ok else ["sum_mismatch"])})
    return output
