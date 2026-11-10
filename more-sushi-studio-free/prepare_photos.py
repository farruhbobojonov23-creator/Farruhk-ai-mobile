#!/usr/bin/env python3
"""Create isolated photo-realistic WebP food cutouts from the owner's generated studio pictures.
Only reads the explicit generation manifest. Publishes normalized images and a public index.
"""
from pathlib import Path
from io import BytesIO
import json, time
import requests
import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes, binary_closing, label, gaussian_filter

ROOT=Path(__file__).resolve().parent
PATH=ROOT/'photo-download-manifest.json'
OUT=ROOT/'photos'
INDEX=ROOT/'photo-index.json'
OUT.mkdir(exist_ok=True)
with PATH.open(encoding='utf-8') as f: entries=json.load(f)
assert isinstance(entries,list) and len(entries)<=100
existing=[]
if INDEX.exists():
    existing=json.loads(INDEX.read_text(encoding='utf-8'))
by_slug={o['slug']:o for o in existing}
print('Items to import:',len(entries),flush=True)
for i,item in enumerate(entries,1):
    slug=item['slug']
    assert slug and all(c.isascii() and (c.islower() or c.isdigit() or c in '-_') for c in slug)
    url=item['url']
    assert url.startswith('https://dnznrvs05pmza.cloudfront.net/') and '_jwt=' in url
    target=OUT/(slug+'.webp')
    if target.exists() and target.stat().st_size>4000:
        print(i,slug,'exists; skipping')
    else:
        data=None
        for retry in range(3):
            try:
                resp=requests.get(url,timeout=50,headers={'User-Agent':'MoreSushi-PhotoEditor/1.0'})
                resp.raise_for_status()
                if len(resp.content)>15_000_000 or 'image' not in resp.headers.get('Content-Type','image/jpeg'):
                    raise ValueError('Unsupported picture')
                data=resp.content
                break
            except Exception as e:
                if retry==2:raise
                print('Retry download',slug,str(e)[:100],flush=True);time.sleep(3*(retry+1))
        img=Image.open(BytesIO(data)).convert('RGB')
        img.thumbnail((1024,1024),Image.Resampling.LANCZOS)
        arr=np.asarray(img,dtype=np.uint8)
        light=np.max(arr,axis=2)
        # Segmentation: everything above near-black, fill holes inside the food subject.
        foreground=light>38
        foreground=binary_closing(foreground,structure=np.ones((5,5)),iterations=2)
        lbl,components=label(foreground)
        if components:
            counts=np.bincount(lbl.ravel());counts[0]=0
            fg=lbl==counts.argmax()
        else: fg=foreground
        fg=binary_fill_holes(fg)
        smooth=gaussian_filter(fg.astype('float32'),sigma=1.1)
        alpha=np.uint8(np.clip(smooth*255,0,255))
        rgba=Image.fromarray(np.dstack([arr,alpha]),'RGBA')
        bbox=rgba.getbbox()
        if not bbox:raise ValueError('Empty foreground '+slug)
        rgba=rgba.crop(bbox)
        box=600;max_dim=max(rgba.size);scale=min(1,box/max_dim)
        sz=(max(1,round(rgba.width*scale)),max(1,round(rgba.height*scale)))
        if sz!=rgba.size:rgba=rgba.resize(sz,Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(640,640),(0,0,0,0))
        canvas.alpha_composite(rgba,((640-rgba.width)//2,(640-rgba.height)//2))
        canvas.save(target,'WEBP',quality=82,method=5)
        print(i,slug,'saved',target.stat().st_size,'bytes',flush=True)
    by_slug[slug]={
        'id':-10000-len(by_slug) if slug not in by_slug else by_slug[slug]['id'],
        'slug':slug,
        'name':item['name'],
        'category':item.get('category','Прочее'),
        'keywords':item.get('keywords',item['name']),
        'image_data':'./photos/'+slug+'.webp',
        'local':True,
    }
INDEX.write_text(json.dumps(sorted(by_slug.values(),key=lambda v:v['name']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Total photo index:',len(by_slug),flush=True)
