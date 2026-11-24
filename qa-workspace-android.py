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
    xml=b"<hierarchy/>"
    while time.monotonic()<end:
        try:
            xml=read()
        except (subprocess.SubprocessError, ValueError, ET.ParseError):
            time.sleep(1)
            continue
        nodes=[n for n in ET.fromstring(xml).iter("node") if label in (n.get("text"), n.get("content-desc"))]
        if nodes:
            return (nodes[-1] if bottom else nodes[0]),xml
        time.sleep(1)
    print("Last visible labels:",[(n.get("text"),n.get("content-desc")) for n in ET.fromstring(xml).iter("node") if n.get("text") or n.get("content-desc")],flush=True)
    (out/"failed.png").write_bytes(adb("exec-out","screencap","-p"))
    (out/"failed.xml").write_bytes(xml)
    raise RuntimeError("Missing "+label)
def tap(label,bottom=False):
    node,_=locate(label,bottom=bottom)
    x,y,r,b=map(int,re.findall(r"\d+",node.get("bounds")))
    adb("shell","input","tap",str((x+r)//2),str((y+b)//2))
adb("install","-r","farruh-workspace-android/app/build/outputs/apk/debug/app-debug.apk")
adb("shell","input","keyevent","KEYCODE_WAKEUP")
adb("shell","wm","dismiss-keyguard")
adb("shell","input","keyevent","82")
adb("shell","am","start","-n","ai.farukh.workspace/.MainActivity")
locate("Мои проекты",100)
for tab,title,key in [("Главная","Мои проекты","home"),("Проекты","Все проекты","projects"),("ТТК","ТТК и документы","ttk"),("Инструменты","Инструменты","tools"),("Ещё","Настройки","more")]:
    tap(tab,True)
    _,xml=locate({"tools":"PDF / Печать","more":"＋ Добавить проект Название, ссылка и собственная иконка"}.get(key,title))
    (out/(key+".xml")).write_bytes(xml)
    (out/(key+".png")).write_bytes(adb("exec-out","screencap","-p"))
    print("PASS Android WebView",tab,flush=True)
tap("＋ Добавить проект Название, ссылка и собственная иконка")
locate("Сохранить")
(out/"form.png").write_bytes(adb("exec-out","screencap","-p"))
print("PASS Android project form",flush=True)
