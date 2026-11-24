from pathlib import Path
import subprocess, time, re
from xml.etree import ElementTree as ET
out=Path("qa-android-output")
out.mkdir(exist_ok=True)
def adb(*args):
    return subprocess.check_output(["adb",*args],timeout=45)
def read():
    adb("shell","uiautomator","dump","/sdcard/workspace-ui.xml")
    tree=adb("shell","cat","/sdcard/workspace-ui.xml")
    return tree[tree.index(b"<?xml"):]
def locate(label, timeout=40, bottom=False):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        xml=read()
        nodes=[n for n in ET.fromstring(xml).iter("node") if label in (n.get("text"), n.get("content-desc"))]
        if nodes:
            return (nodes[-1] if bottom else nodes[0]),xml
        time.sleep(1)
    (out/"failed.xml").write_bytes(read())
    raise RuntimeError("Missing "+label)
def tap(label,bottom=False):
    node,_=locate(label,bottom=bottom)
    x,y,r,b=map(int,re.findall(r"\d+",node.get("bounds")))
    adb("shell","input","tap",str((x+r)//2),str((y+b)//2))
adb("install","-r","farruh-workspace-android/app/build/outputs/apk/debug/app-debug.apk")
adb("shell","am","start","-n","ai.farukh.workspace/.MainActivity")
locate("Мои проекты",100)
for tab,title,key in [("Главная","Мои проекты","home"),("Проекты","Все проекты","projects"),("ТТК","ТТК и документы","ttk"),("Инструменты","Инструменты","tools"),("Ещё","Настройки","more")]:
    tap(tab,True)
    _,xml=locate({"tools":"PDF / Печать","more":"Добавить проект"}.get(key,title))
    (out/(key+".xml")).write_bytes(xml)
    (out/(key+".png")).write_bytes(adb("exec-out","screencap","-p"))
    print("PASS Android WebView",tab,flush=True)
tap("Добавить проект")
locate("Сохранить")
(out/"form.png").write_bytes(adb("exec-out","screencap","-p"))
print("PASS Android project form",flush=True)
