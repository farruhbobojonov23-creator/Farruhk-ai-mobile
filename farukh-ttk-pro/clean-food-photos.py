#!/usr/bin/env python3
"""Turn 11 existing, independently licensed food photos into offline transparent WebP tiles.
Only touches assets within the TTK build workspace. Do not edit the source More Sushi library.
"""
from pathlib import Path
from PIL import Image, ImageDraw

root=Path("app/src/main/assets/food")
for path in sorted(root.glob("*.png")):
    img=Image.open(path).convert("RGBA")
    pixels=img.load()
    for xy in ((0,0),(img.width-1,0),(0,img.height-1),(img.width-1,img.height-1)):
        r,g,b,a=pixels[xy]
        if a>230 and max(r,g,b)<=16:
            ImageDraw.floodfill(img,xy,(0,0,0,0),thresh=48)
    bbox=img.getchannel("A").getbbox()
    if not bbox:raise ValueError(f"Empty source image: {path}")
    img=img.crop(bbox)
    side=max(img.size)
    if side>1000:
        scale=1000/side
        img=img.resize((max(1,round(img.width*scale)),max(1,round(img.height*scale))),Image.Resampling.LANCZOS)
        side=max(img.size)
    padding=max(24,round(side*.07))
    canvas=Image.new("RGBA",(side+2*padding,side+2*padding),(0,0,0,0))
    canvas.alpha_composite(img,((canvas.width-img.width)//2,(canvas.height-img.height)//2))
    dest=path.with_suffix(".webp")
    canvas.save(dest,"WEBP",quality=92,method=6)
    path.unlink() # release artifact only; not the source project's image
    print(f"{dest.name}: {dest.stat().st_size} bytes, transparent background")
