#!/usr/bin/env python3
"""Compare master artboards with real browser screenshots, 1672×941.
No metrics or data are invented or inserted into the browser. Differences are
reported as measured, not masked or presented as a perfect reconstruction.
"""
import json
import numpy as np
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
OUT=Path('reference-v21-output')
results={}
for page in ('home','routines','account','progress'):
 master=Image.open(ROOT/'.reference-v21'/f'{page}.jpg').convert('RGB')
 old=Image.open(OUT/f'{page}-before.png').convert('RGB')
 new=Image.open(OUT/f'{page}-after.png').convert('RGB')
 if not (master.size==old.size==new.size==(1672,941)):
  raise SystemExit(f'{page}: mismatched viewport')
 a=np.asarray(master,dtype=np.float32)
 diffs={}
 for name,im in (('before',old),('after',new)):
  b=np.asarray(im,dtype=np.float32)
  diffs[name]={'mae':round(float(np.abs(a-b).mean()),2),'rmse':round(float(np.sqrt(((a-b)**2).mean())),2)}
 results[page]={'reference_px':[1672,941],**diffs,'mae_improvement':round(diffs['before']['mae']-diffs['after']['mae'],2)}
 heat=np.minimum(255,np.abs(np.asarray(new,dtype=np.int16)-np.asarray(master,dtype=np.int16))*3).astype(np.uint8)
 heatmap=Image.fromarray(heat,'RGB')
 thumb_size=(836,471)
 panels=[('RÉFÉRENCE',master),('AVANT · SITE PUBLIC',old),('APRÈS · BRANCHE V21',new),('DIFFÉRENCES ×3',heatmap)]
 canvas=Image.new('RGB',(thumb_size[0]*2,thumb_size[1]*2+62),'#09151e')
 draw=ImageDraw.Draw(canvas)
 for i,(label,im) in enumerate(panels):
  x=(i%2)*thumb_size[0];y=(i//2)*(thumb_size[1]+31)
  draw.rectangle((x,y,x+thumb_size[0]-1,y+28),fill='#132b38')
  draw.text((x+12,y+8),label,fill='#f7f9fc')
  canvas.paste(im.resize(thumb_size,Image.Resampling.LANCZOS),(x,y+31))
 canvas.save(OUT/f'compare-{page}.png',optimize=True)
 print(page,diffs,'improvement',results[page]['mae_improvement'])
(OUT/'scores.json').write_text(json.dumps(results,indent=2),encoding='utf-8')