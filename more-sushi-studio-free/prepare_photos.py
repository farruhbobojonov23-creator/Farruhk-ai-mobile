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

# Retouch legacy black-backed cutouts. Old thresholded silhouettes retain black
# matte pixels at their contours, producing a dark outline on light cards.
# Correct only a narrow 4 px boundary and keep opaque food texture untouched.
# "edge-clean-v2" in the index avoids accidentally reprocessing them repeatedly.
from scipy.ndimage import distance_transform_edt, gaussian_filter
import numpy as np

RETOUCH_VERSION='edge-clean-v2'
for photo_slug,record in by_slug.items():
    photo_file=OUT/(photo_slug+'.webp')
    if not photo_file.is_file() or record.get('quality')==RETOUCH_VERSION:
        continue
    im=Image.open(photo_file).convert('RGBA')
    pixels=np.asarray(im,dtype=np.uint8).copy()
    original_alpha=pixels[:,:,3].astype(np.float32)
    active=original_alpha>35
    if not active.any():
        continue
    inside_dist=distance_transform_edt(active)
    # Find color two or more pixels INSIDE the original edge so the black
    # background is not sampled as foreground color.
    good=(original_alpha>245)&(inside_dist>=4.0)
    if not good.any():
        good=(original_alpha>220)&(inside_dist>=2.0)
    if not good.any():
        continue
    nearest=distance_transform_edt(~good,return_distances=False,return_indices=True)
    near_rgb=pixels[nearest[0],nearest[1],:3].astype(np.float32)
    edge=active&(inside_dist<=4.5)
    # Replace contaminated edge RGB with close interior food colors.
    # Preserve internal details (e.g. nori, salmon marbling, sesame seeds).
    original_rgb=pixels[:,:,:3].astype(np.float32)
    weight=np.clip((5.2-inside_dist)/3.6,0,1)
    weight=np.where(edge,weight,0)[:,:,None]
    restored=original_rgb*(1-weight)+near_rgb*weight
    pixels[:,:,:3]=np.uint8(np.clip(restored,0,255))
    # Recede matte by 1–2 pixels, then antialias over a very narrow feather.
    edge_alpha=np.clip((inside_dist-1.2)*155,0,255)
    new_alpha=np.minimum(original_alpha,edge_alpha)
    new_alpha=gaussian_filter(new_alpha,sigma=.55)
    pixels[:,:,3]=np.uint8(np.clip(new_alpha,0,255))
    Image.fromarray(pixels,'RGBA').save(photo_file,'WEBP',quality=90,method=6)
    record['quality']=RETOUCH_VERSION
    print('Cleaned dark edge:',photo_slug,flush=True)

INDEX.write_text(json.dumps(sorted(by_slug.values(),key=lambda v:v['name']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Total photo index:',len(by_slug),flush=True)
